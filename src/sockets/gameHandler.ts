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
    // ── Get Public Rooms ──────────────────────────────────────────
    socket.on("getPublicRooms", async () => {
        try {
            const user = (socket as any).user;
            let rooms = await _fetchPublicRooms();

            // Islamic Restrictions: Filter rooms by user gender if they are logged in
            if (user && user.gender) {
                rooms = rooms.filter(r => !r.requiredGender || r.requiredGender === user.gender);
            }

            socket.join("public_lobby"); // Join for live updates
            socket.emit("publicRoomsList", rooms);
        } catch (error) {
            console.error("Error fetching public rooms:", error);
        }
    });

    const _fetchPublicRooms = async (): Promise<RoomState[]> => {
        try {
            const publicRoomIds = await redis.sMembers("ludo:public_rooms");
            const rooms: RoomState[] = [];
            for (const roomId of publicRoomIds) {
                const roomData = await redis.get(`room:${roomId}`);
                if (roomData) {
                    try {
                        const room: RoomState = JSON.parse(roomData);
                        if (room.status === GameStatus.WAITING && room.players.length < (room.totalPlayerCount || 4)) {
                            rooms.push(room);
                        } else {
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

    // ── Create Room ───────────────────────────────────────────────
    socket.on("createRoom", async (data: { roomId?: string, userId?: string, username?: string, isPrivate?: boolean, playerCount: number, requiredGender?: string }) => {
        try {
            const roomId = data.roomId || Math.floor(100000 + Math.random() * 900000).toString();
            const user = (socket as any).user;
            const userId = user?.id || data.userId || `guest_${Math.floor(Math.random() * 1000)}`;
            (socket as any).userId = userId.toString();
            (socket as any).roomId = roomId;
            const username = user?.display_name || user?.username || data.username || `Guest_${userId.toString().substring(0, 5)}`;

            // Host gender as requirement if provided or from profile
            const hostGender = data.requiredGender || user?.gender;

            // Check if room already exists to prevent overwriting joined players
            const existingRoomData = await redis.get(`room:${roomId}`);
            if (existingRoomData) {
                try {
                    const existingRoom: RoomState = JSON.parse(existingRoomData);
                    await socket.join(roomId);

                    if (!existingRoom.players.some(p => p.userId === userId)) {
                        const colors = [PieceColor.RED, PieceColor.GREEN, PieceColor.YELLOW, PieceColor.BLUE];
                        const assignedColor = colors[existingRoom.players.length % 4];
                        existingRoom.players.push({
                            userId, username, color: assignedColor, pieces: [0, 0, 0, 0], isReady: true
                        });
                        await redis.set(`room:${roomId}`, JSON.stringify(existingRoom), { EX: 3600 });
                        console.log(`👤 Re-joined/Added to existing room: ${roomId} as ${username}`);
                    }

                    io.to(roomId).emit("roomUpdated", existingRoom);
                    return socket.emit("roomCreated", existingRoom);
                } catch (e) { }
            }

            const roomState: RoomState = {
                roomId,
                players: [{
                    userId: userId,
                    username: username,
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
                requiredGender: hostGender,
                isPrivate: data.isPrivate ?? false,
            };

            await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });
            if (!roomState.isPrivate) {
                await redis.sAdd("ludo:public_rooms", roomId);
                _broadcastLobbyUpdate();
            }
            await socket.join(roomId);
            socket.emit("roomCreated", roomState);
            console.log(`🏠 Room created: ${roomId} by ${username} (Max: ${roomState.totalPlayerCount})`);
        } catch (error) {
            console.error("Error in createRoom:", error);
            socket.emit("error", "Failed to create room");
        }
    });

    // ── Join Room ─────────────────────────────────────────────────
    socket.on("joinRoom", async (data: { roomId: string, userId?: string, username?: string } | string) => {
        try {
            const roomId = typeof data === 'string' ? data : data.roomId;
            const clientUserId = typeof data === 'string' ? null : data.userId;
            const clientUsername = typeof data === 'string' ? null : data.username;

            const roomData = await redis.get(`room:${roomId}`);
            if (!roomData) return socket.emit("error", "Room not found");

            const roomState: RoomState = JSON.parse(roomData);
            const user = (socket as any).user;
            const userId = user?.id || clientUserId || `guest_${Math.floor(Math.random() * 1000)}`;
            (socket as any).userId = userId.toString();
            (socket as any).roomId = roomId;
            const username = user?.display_name || user?.username || clientUsername || `Guest_${userId.toString().substring(0, 5)}`;

            // GENDER CHECK - Same gender only requirement
            if (roomState.requiredGender && (!user || user.gender !== roomState.requiredGender)) {
                console.log(`🚫 Join rejected: Gender mismatch for room ${roomId}. Need ${roomState.requiredGender}, player is ${user?.gender}`);
                return socket.emit("error", `This room is for ${roomState.requiredGender} players only.`);
            }

            // Check if player is already in room
            if (roomState.players.some(p => p.userId === userId)) {
                await socket.join(roomId);
                return io.to(roomId).emit("roomUpdated", roomState);
            }

            if (roomState.players.length >= (roomState.totalPlayerCount || 4)) return socket.emit("error", "Room full");
            if (roomState.status !== GameStatus.WAITING) return socket.emit("error", "Game already started");

            const colors = [PieceColor.RED, PieceColor.GREEN, PieceColor.YELLOW, PieceColor.BLUE];
            const assignedColor = colors[roomState.players.length];

            roomState.players.push({
                userId: userId,
                username: username,
                color: assignedColor,
                pieces: [0, 0, 0, 0],
                isReady: true
            });

            await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });

            // Remove from public rooms if full
            if (roomState.players.length >= (roomState.totalPlayerCount || 4)) {
                await redis.sRem("ludo:public_rooms", roomId);
            }
            _broadcastLobbyUpdate();

            await socket.join(roomId);

            // Broadcast to all in room
            io.to(roomId).emit("roomUpdated", roomState);
            io.to(roomId).emit("playerJoined", { roomId, userId, username });
            console.log(`👤 User ${username} joined room: ${roomId}`);
        } catch (error) {
            console.error("Error in joinRoom:", error);
            socket.emit("error", "Failed to join room");
        }
    });

    // ── Chat Messaging ────────────────────────────────────────────
    socket.on("sendMessage", async (data: { roomId: string, message: string }) => {
        const roomData = await redis.get(`room:${data.roomId}`);
        if (!roomData) return;

        const roomState: RoomState = JSON.parse(roomData);
        const userId = (socket as any).userId;
        const player = roomState.players.find(p => p.userId === userId);
        const username = player?.username || `Guest_${userId?.toString().substring(0, 5)}`;

        const chatMsg = {
            userId,
            username,
            message: data.message,
            timestamp: Date.now()
        };

        roomState.messages.push(chatMsg);
        // Keep only last 50 messages
        if (roomState.messages.length > 50) roomState.messages.shift();

        await redis.set(`room:${data.roomId}`, JSON.stringify(roomState), { EX: 3600 });
        io.to(data.roomId).emit("newMessage", chatMsg);
    });

    // ── Roll Dice ─────────────────────────────────────────────────
    socket.on("rollDice", async (roomId: string) => {
        try {
            const data = await redis.get(`room:${roomId}`);
            if (!data) return;

            const roomState: RoomState = JSON.parse(data);
            const userId = (socket as any).userId;
            const currentTurnUserId = roomState.players[roomState.turn].userId;

            if (!userId || String(currentTurnUserId) !== String(userId)) {
                console.log(`🚫 Roll rejected: Not ${userId}'s turn. Current turn: ${currentTurnUserId}`);
                return;
            }

            // Check if player has already rolled and needs to move
            if (roomState.hasRolled || roomState.isRolling) return;

            roomState.isRolling = true;
            const roll = Math.floor(Math.random() * 6) + 1;
            roomState.diceValue = roll;
            roomState.isRolling = false;
            roomState.hasRolled = true;

            await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });
            io.to(roomId).emit("diceRolled", { roll, turn: roomState.turn });
            io.to(roomId).emit("roomUpdated", roomState);

            // Check for legal moves
            const currentPlayer = roomState.players[roomState.turn];
            const canMove = currentPlayer.pieces.some(pos => {
                if (pos === 0 && roll === 6) return true;
                if (pos > 0 && pos + roll <= 57) return true;
                return false;
            });

            if (!canMove) {
                console.log(`⏭ No moves possible for ${currentPlayer.username} with roll ${roll}. Auto-skipping turn.`);
                setTimeout(async () => {
                    try {
                        const updatedRoomData = await redis.get(`room:${roomId}`);
                        if (!updatedRoomData) return;
                        const updatedRoomState: RoomState = JSON.parse(updatedRoomData);

                        // Switch turn
                        updatedRoomState.turn = (updatedRoomState.turn + 1) % updatedRoomState.players.length;
                        updatedRoomState.hasRolled = false;
                        updatedRoomState.diceValue = 1; // Reset dice visual for next player

                        await redis.set(`room:${roomId}`, JSON.stringify(updatedRoomState), { EX: 3600 });
                        io.to(roomId).emit("roomUpdated", updatedRoomState);
                    } catch (e) { }
                }, 1500); // 1.5s delay to see the dice roll before skipping
            }
        } catch (error) {
            console.error("Error in rollDice:", error);
        }
    });

    // ── End Turn ──────────────────────────────────────────────────
    socket.on("endTurn", async (roomId: string) => {
        const data = await redis.get(`room:${roomId}`);
        if (!data) return;

        const roomState: RoomState = JSON.parse(data);
        roomState.isRolling = false;
        roomState.turn = (roomState.turn + 1) % roomState.players.length;

        await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });
        io.to(roomId).emit("roomUpdated", roomState);
    });

    // ── Move Piece ────────────────────────────────────────────────
    socket.on("movePiece", async (data: { roomId: string, pieceIndex: number }) => {
        try {
            const roomData = await redis.get(`room:${data.roomId}`);
            if (!roomData) return;

            const roomState: RoomState = JSON.parse(roomData);
            const userId = (socket as any).userId;
            const currentPlayer = roomState.players[roomState.turn];

            if (!userId || String(currentPlayer.userId) !== String(userId)) {
                console.log(`🚫 Move rejected: Not ${userId}'s turn.`);
                return;
            }

            if (!roomState.hasRolled) {
                console.log(`🚫 Move rejected: ${currentPlayer.username} has not rolled yet.`);
                return;
            }

            const roll = roomState.diceValue;
            const currentPos = currentPlayer.pieces[data.pieceIndex];

            // Basic Rules
            if (currentPos === 0 && roll === 6) {
                currentPlayer.pieces[data.pieceIndex] = 1;
            } else if (currentPos > 0) {
                if (currentPos + roll <= 57) {
                    currentPlayer.pieces[data.pieceIndex] += roll;
                } else {
                    return socket.emit("error", "Invalid move: beyond finish line");
                }
            } else {
                return socket.emit("error", "Invalid move: need a 6 to start");
            }

            // Reset flags for next turn or next roll
            roomState.isRolling = false;
            roomState.hasRolled = false; // Reset so next player OR same player (if 6) can roll

            // Check Winner
            if (currentPlayer.pieces.every(p => p === 57)) {
                roomState.status = GameStatus.FINISHED;
                roomState.winner = userId as string;

                // ── Award Rewards (Gems + Balance) to ALL Players ────────────────
                for (const player of roomState.players) {
                    const pId = Number(player.userId);
                    if (!isNaN(pId)) {
                        try {
                            const isWinner = String(player.userId) === String(userId);
                            const { gems } = await RewardService.updateGameRewards(pId, isWinner);

                            // 📝 Save History
                            await GameHistoryService.saveGameRecord(
                                roomState,
                                player.userId,
                                GameResultStatus.COMPLETED,
                                isWinner ? 10 : 2
                            );

                            if (isWinner) {
                                console.log(`🏆 Awarded 10 gems (plus milestones) to winner ${player.username}`);

                                // Notify via chat
                                const winMsg = {
                                    userId: "system",
                                    username: "System",
                                    message: `🎉 Congratulations! ${player.username} won the match and now has ${gems} Gems!`,
                                    timestamp: Date.now()
                                };
                                roomState.messages.push(winMsg);
                                io.to(data.roomId).emit("newMessage", winMsg);
                            } else {
                                console.log(`👟 Awarded participation gems to ${player.username}`);
                            }
                        } catch (err) {
                            console.error(`❌ Error awarding rewards to ${player.username}:`, err);
                        }
                    }
                }

                await redis.set(`room:${data.roomId}`, JSON.stringify(roomState), { EX: 3600 });

                // System-wide broadcast for big win!
                io.emit("systemBroadcast", {
                    message: `🏆 Victory! ${currentPlayer.username} just won a match in Room ${data.roomId}!`,
                    type: 'info',
                    timestamp: Date.now()
                });

                return io.to(data.roomId).emit("gameOver", roomState);
            }

            // Switch turn if NOT 6
            if (roll !== 6) {
                roomState.turn = (roomState.turn + 1) % roomState.players.length;
            }

            await redis.set(`room:${data.roomId}`, JSON.stringify(roomState), { EX: 3600 });
            io.to(data.roomId).emit("roomUpdated", roomState);
            console.log(`📍 ${currentPlayer.username} moved piece ${data.pieceIndex} to ${currentPlayer.pieces[data.pieceIndex]} (Roll: ${roll})`);
        } catch (error) {
            console.error("Error in movePiece:", error);
        }
    });

    socket.on("startGame", async (roomId: string) => {
        const data = await redis.get(`room:${roomId}`);
        if (!data) return;

        const roomState: RoomState = JSON.parse(data);
        if (roomState.players.length < 2) {
            return socket.emit("error", "Need at least 2 players to start");
        }

        // Lock the player count to whoever is in the lobby right now
        roomState.totalPlayerCount = roomState.players.length;
        roomState.status = GameStatus.PLAYING;

        await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });
        // Remove from public rooms when game starts
        await redis.sRem("ludo:public_rooms", roomId);
        _broadcastLobbyUpdate();

        io.to(roomId).emit("gameStarted", roomState);
        console.log(`🎮 Game started in room ${roomId} with ${roomState.totalPlayerCount} players`);
    });

    // ── Handle Disconnect ──────────────────────────────────────────
    socket.on("disconnect", async () => {
        try {
            const roomId = (socket as any).roomId;
            const userId = (socket as any).userId;
            if (!roomId || !userId) return;

            const roomData = await redis.get(`room:${roomId}`);
            if (!roomData) return;

            let roomState: RoomState = JSON.parse(roomData);
            const playerIndex = roomState.players.findIndex(p => String(p.userId) === String(userId));

            if (playerIndex !== -1) {
                const player = roomState.players[playerIndex];
                console.log(`🔌 Player ${player.username} left room ${roomId}`);

                // Remove player
                roomState.players.splice(playerIndex, 1);

                // 📝 Save history if the game had started
                if (roomState.status === GameStatus.PLAYING) {
                    try {
                        await GameHistoryService.saveGameRecord(roomState, userId, GameResultStatus.LEFT, 0);
                    } catch (e) { }
                }

                if (roomState.players.length === 0) {
                    await redis.del(`room:${roomId}`);
                    await redis.sRem("ludo:public_rooms", roomId);
                    _broadcastLobbyUpdate();
                } else {
                    // If it was their turn, move to next
                    if (roomState.turn >= roomState.players.length) {
                        roomState.turn = 0;
                    }

                    await redis.set(`room:${roomId}`, JSON.stringify(roomState), { EX: 3600 });

                    // If room was full and now has space, add back to public set
                    if (!roomState.isPrivate && roomState.status === GameStatus.WAITING && roomState.players.length < (roomState.totalPlayerCount || 4)) {
                        await redis.sAdd("ludo:public_rooms", roomId);
                    }
                    _broadcastLobbyUpdate();

                    io.to(roomId).emit("roomUpdated", roomState);
                    io.to(roomId).emit("playerLeft", { userId: player.userId, username: player.username });
                    io.to(roomId).emit("newMessage", {
                        userId: "system",
                        username: "System",
                        message: `${player.username} has left the room.`,
                        timestamp: Date.now()
                    });
                }
            }
        } catch (error) {
            console.error("Error in disconnect handler:", error);
        }
    });
};
