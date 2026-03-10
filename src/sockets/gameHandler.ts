import { Server, Socket } from "socket.io";
import { redis } from "../config/redis.js";
import { GameStatus, LudoEngine, PieceColor, RoomState } from "../modules/game/LudoGame.js";
import { AppDataSource } from "../data-source.js";
import { User } from "../entities/User.js";
import { RewardHistory, RewardType } from "../entities/RewardHistory.js";
import { RewardService } from "../modules/rewards/rewardService.js";
import { GameHistoryService } from "../modules/game/gameHistoryService.js";
import { GameResultStatus } from "../entities/GameHistory.js";

export const setupGameHandlers = (io: Server, socket: Socket) => {

    const _fetchPublicRooms = async (): Promise<RoomState[]> => {
        try {
            const publicRoomIds = await redis.sMembers("ludo:public_rooms");
            const rooms: RoomState[] = [];
            for (const roomId of publicRoomIds) {
                const roomData = await redis.get(`room:${roomId}`);
                if (roomData) {
                    try {
                        const room: RoomState = JSON.parse(roomData);
                        // FILTER: public rooms, status waiting, players < max
                        if (!room.isPrivate && room.status === GameStatus.WAITING && room.players.length < (room.totalPlayerCount || 4)) {
                            rooms.push(room);
                        } else {
                            // Automatically remove if not joinable
                            await redis.sRem("ludo:public_rooms", roomId);
                        }
                    } catch (e) {
                        await redis.sRem("ludo:public_rooms", roomId);
                    }
                } else {
                    await redis.sRem("ludo:public_rooms", roomId);
                }
            }
            return rooms;
        } catch (error) {
            console.error("Error in _fetchPublicRooms:", error);
            return [];
        }
    };

    const _broadcastLobbyUpdate = async () => {
        const rooms = await _fetchPublicRooms();
        io.to("public_lobby").emit("publicRoomsList", rooms);
    };

    // ── Get Public Rooms ──────────────────────────────────────────
    socket.on("getPublicRooms", async () => {
        const rooms = await _fetchPublicRooms();
        socket.join("public_lobby"); // Subscribe to updates
        socket.emit("publicRoomsList", rooms);
    });

    // ── Create Room (Combined logic for Public/Private) ───────────
    socket.on("createRoom", async (data: { roomId?: string, userId?: string, username?: string, isPrivate?: boolean, playerCount?: number, clientGender?: string }) => {
        try {
            const roomId = data.roomId || Math.floor(100000 + Math.random() * 900000).toString();
            const user = (socket as any).user;
            const userId = (user?.id || data.userId || `guest_${Math.floor(Math.random() * 1000)}`).toString();
            const username = user?.display_name || user?.username || data.username || `Guest_${userId.substring(0, 5)}`;
            const gender = user?.gender || data.clientGender;

            (socket as any).userId = userId;
            (socket as any).roomId = roomId;

            const roomState: RoomState = {
                roomId,
                players: [{
                    userId,
                    username,
                    color: PieceColor.RED,
                    pieces: [0, 0, 0, 0],
                    isReady: true
                }],
                status: GameStatus.WAITING,
                turn: 0,
                diceValue: 1,
                lastRollTime: Date.now(),
                messages: [],
                isRolling: false,
                hasRolled: false,
                totalPlayerCount: data.playerCount || 4,
                requiredGender: gender ? gender.toUpperCase() : null,
                isPrivate: data.isPrivate ?? false,
            };

            await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });

            if (!roomState.isPrivate) {
                await redis.sAdd("ludo:public_rooms", roomId);
                _broadcastLobbyUpdate();
            }

            await socket.join(roomId);
            socket.emit("roomCreated", roomState);
            console.log(`🏠 Room ${roomId} created by ${username} [Gender: ${roomState.requiredGender || "ANY"}]`);
        } catch (error) {
            console.error("Error in createRoom:", error);
            socket.emit("error", "Failed to create room");
        }
    });

    // ── Alias for frontend specifically asking for createPublicRoom
    socket.on("createPublicRoom", (data) => {
        socket.emit("createRoom", { ...data, isPrivate: false });
    });

    // ── Join Room ─────────────────────────────────────────────────
    socket.on("joinRoom", async (data: { roomId: string, userId?: string, username?: string, clientGender?: string } | string) => {
        try {
            const roomId = typeof data === 'string' ? data : data.roomId;
            const roomData = await redis.get(`room:${roomId}`);
            if (!roomData) return socket.emit("error", "Room not found");

            const roomState: RoomState = JSON.parse(roomData);

            // Gender Check
            const user = (socket as any).user;
            const clientUserId = typeof data === 'string' ? null : data.userId;
            const clientUsername = typeof data === 'string' ? null : data.username;
            const clientGender = typeof data === 'string' ? null : data.clientGender;

            const userId = (user?.id || clientUserId || `guest_${Math.floor(Math.random() * 1000)}`).toString();
            const username = user?.display_name || user?.username || clientUsername || `Guest_${userId.substring(0, 5)}`;
            const resolvedGender = (user?.gender || clientGender)?.toString().toUpperCase();

            (socket as any).userId = userId;
            (socket as any).roomId = roomId;

            // Strict Gender Enforcement
            if (roomState.requiredGender) {
                if (!resolvedGender) {
                    return socket.emit("error", "Profile incomplete. Please set your gender in settings to join this room.");
                }
                if (resolvedGender !== roomState.requiredGender.toUpperCase()) {
                    return socket.emit("error", `This room is restricted to ${roomState.requiredGender} players only.`);
                }
            }

            // Already in room?
            if (roomState.players.some(p => p.userId === userId)) {
                await socket.join(roomId);
                return socket.emit("roomUpdated", roomState);
            }

            // Room status check
            if (roomState.status !== GameStatus.WAITING) return socket.emit("error", "Match already in progress");
            if (roomState.players.length >= roomState.totalPlayerCount) return socket.emit("error", "Room is full");

            const colors = [PieceColor.RED, PieceColor.GREEN, PieceColor.YELLOW, PieceColor.BLUE];
            const assignedColor = colors[roomState.players.length];

            roomState.players.push({
                userId, username, color: assignedColor, pieces: [0, 0, 0, 0], isReady: true
            });

            await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });

            // Remove from lobby if full
            if (roomState.players.length >= roomState.totalPlayerCount) {
                await redis.sRem("ludo:public_rooms", roomId);
            }
            _broadcastLobbyUpdate();

            await socket.join(roomId);
            io.to(roomId).emit("roomUpdated", roomState);
            console.log(`👤 ${username} joined room ${roomId}`);

            // Auto-start if 4 players (as requested)
            if (roomState.players.length === 4 && roomState.status === GameStatus.WAITING) {
                roomState.status = GameStatus.PLAYING;
                await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });
                io.to(roomId).emit("gameStarted", roomState);
            }

        } catch (error) {
            console.error("Error in joinRoom:", error);
            socket.emit("error", "Failed to join room");
        }
    });

    // ── Alias for frontend specifically asking for joinPublicRoom
    socket.on("joinPublicRoom", (data) => {
        socket.emit("joinRoom", data);
    });

    // ── Leave Room ────────────────────────────────────────────────
    socket.on("leaveRoom", async (roomId: string) => {
        const userId = (socket as any).userId;
        if (!roomId || !userId) return;

        try {
            const roomData = await redis.get(`room:${roomId}`);
            if (!roomData) return;

            const roomState: RoomState = JSON.parse(roomData);
            const playerIndex = roomState.players.findIndex(p => p.userId === userId);

            if (playerIndex !== -1) {
                const player = roomState.players[playerIndex];
                roomState.players.splice(playerIndex, 1);

                if (roomState.players.length === 0) {
                    await redis.del(`room:${roomId}`);
                    await redis.sRem("ludo:public_rooms", roomId);
                } else {
                    // Host Migration: Implicitly the first player in the list
                    // If the host was removed, index 0 is now a new host.

                    // Reset game if not enough players? No, just update state
                    await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });

                    // Add back to public lobby if it was full but now has space
                    if (!roomState.isPrivate && roomState.status === GameStatus.WAITING) {
                        await redis.sAdd("ludo:public_rooms", roomId);
                    }

                    io.to(roomId).emit("roomUpdated", roomState);
                    io.to(roomId).emit("playerLeft", { userId: player.userId, username: player.username });
                }

                _broadcastLobbyUpdate();
                socket.leave(roomId);
                (socket as any).roomId = null;
            }
        } catch (e) {
            console.error("Error in leaveRoom:", e);
        }
    });

    // ── Dice & Game Logic Aliases ─────────────────────────────────
    socket.on("rollDice", async (roomId: string) => {
        try {
            const roomData = await redis.get(`room:${roomId}`);
            if (!roomData) return;
            const roomState: RoomState = JSON.parse(roomData);
            if (roomState.status !== GameStatus.PLAYING) return;

            const userId = (socket as any).userId;
            const currentPlayer = roomState.players[roomState.turn % roomState.players.length];
            if (currentPlayer.userId !== userId) return;
            if (roomState.hasRolled || roomState.isRolling) return;

            // Mark as rolling
            roomState.isRolling = true;
            await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });
            io.to(roomId).emit("roomUpdated", roomState);

            // Wait 1s for rolling animation
            setTimeout(async () => {
                const updatedRoomData = await redis.get(`room:${roomId}`);
                if (!updatedRoomData) return;
                const rState: RoomState = JSON.parse(updatedRoomData);

                const roll = Math.floor(Math.random() * 6) + 1;
                rState.diceValue = roll;
                rState.isRolling = false;
                rState.hasRolled = true;

                // Check if player can move ANY piece
                const player = rState.players[rState.turn % rState.players.length];
                const canMoveAny = player.pieces.some((_, idx) => LudoEngine.canMove(player, idx, roll));

                if (!canMoveAny) {
                    // Pass turn after 1.5s delay
                    setTimeout(async () => {
                        const rData = await redis.get(`room:${roomId}`);
                        if (!rData) return;
                        const rs: RoomState = JSON.parse(rData);
                        rs.turn = (rs.turn + 1) % rs.players.length;
                        rs.hasRolled = false;
                        await redis.set(`room:${roomId}`, JSON.stringify(rs), { EX: 3600 });
                        io.to(roomId).emit("roomUpdated", rs);
                    }, 1500);
                }

                await redis.set(`room:${roomId}`, JSON.stringify(rState), { EX: 3600 });
                io.to(roomId).emit("diceRolled", { roll, turn: rState.turn });
                io.to(roomId).emit("roomUpdated", rState);
            }, 600);

        } catch (error) {
            console.error("Error rolling dice:", error);
        }
    });

    socket.on("movePiece", async (data: { roomId: string, pieceIndex: number }) => {
        try {
            const roomData = await redis.get(`room:${data.roomId}`);
            if (!roomData) return;
            const roomState: RoomState = JSON.parse(roomData);
            if (roomState.status !== GameStatus.PLAYING || !roomState.hasRolled) return;

            const userId = (socket as any).userId;
            const playerIdx = roomState.turn % roomState.players.length;
            const player = roomState.players[playerIdx];

            if (player.userId !== userId) return;

            if (LudoEngine.canMove(player, data.pieceIndex, roomState.diceValue)) {
                LudoEngine.movePiece(roomState, data.pieceIndex);

                if (LudoEngine.checkWinner(roomState)) {
                    roomState.status = GameStatus.FINISHED;
                    roomState.winner = player.userId;

                    // Award gems to winner
                    try {
                        await RewardService.updateGameRewards(Number(player.userId), true);
                    } catch (e) { }
                } else {
                    // Turn passes unless it was a 6
                    if (roomState.diceValue !== 6) {
                        roomState.turn = (roomState.turn + 1) % roomState.players.length;
                    }
                    roomState.hasRolled = false;
                }

                await redis.set(`room:${data.roomId}`, JSON.stringify(roomState), { EX: 3600 });
                io.to(data.roomId).emit("roomUpdated", roomState);
            }
        } catch (error) {
            console.error("Error moving piece:", error);
        }
    });

    socket.on("sendMessage", async (data: { roomId: string, message: string }) => {
        const roomData = await redis.get(`room:${data.roomId}`);
        if (!roomData) return;
        const roomState: RoomState = JSON.parse(roomData);
        io.to(data.roomId).emit("newMessage", {
            userId: (socket as any).userId,
            username: roomState.players.find(p => p.userId === (socket as any).userId)?.username || "Guest",
            message: data.message,
            timestamp: Date.now()
        });
    });

    socket.on("disconnect", async () => {
        const roomId = (socket as any).roomId;
        if (roomId) {
            socket.emit("leaveRoom", roomId); // reuse logic
        }
    });

    // ── Helper ────────────────────────────────────────────────────
    socket.on("startGame", async (roomId: string) => {
        const roomData = await redis.get(`room:${roomId}`);
        if (!roomData) return;
        const roomState: RoomState = JSON.parse(roomData);
        if (roomState.players.length < 2) return socket.emit("error", "Need at least 2 players");

        roomState.status = GameStatus.PLAYING;
        await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });
        await redis.sRem("ludo:public_rooms", roomId);
        _broadcastLobbyUpdate();
        io.to(roomId).emit("gameStarted", roomState);
    });
};

