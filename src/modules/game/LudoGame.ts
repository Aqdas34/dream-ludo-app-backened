export enum PieceColor {
    RED = "RED",
    GREEN = "GREEN",
    YELLOW = "YELLOW",
    BLUE = "BLUE"
}

export enum GameStatus {
    WAITING = "WAITING",
    PLAYING = "PLAYING",
    FINISHED = "FINISHED"
}

export interface Player {
    userId: string;
    username: string;
    color: PieceColor;
    pieces: number[]; // positions 0..56 (0 means home base, 57 means finish)
    isReady: boolean;
    extraRollsUsed: number;
    skipTurnsUsed: number;
    consecutiveSixes: number; // Added to track three-6s rule
}

export interface ChatMessage {
    userId: string;
    username: string;
    message: string;
    timestamp: number;
}

export interface RoomState {
    roomId: string;
    players: Player[];
    status: GameStatus;
    turn: number; // Index of player in the array
    diceValue: number;
    lastRollTime: number;
    winner?: string;
    messages: ChatMessage[];
    isRolling: boolean;
    hasRolled: boolean;
    totalPlayerCount: number;
    requiredGender?: string; // 'MALE' | 'FEMALE' | null (null = any)
    isPrivate: boolean; // default false means public
}

export class LudoEngine {
    // Basic constants
    static MAX_STEPS = 57;

    static getGlobalPosition(color: PieceColor, step: number): number | null {
        if (step === 0 || step > 51) return null; // In base or home stretch
        
        let startPos = 0;
        switch (color) {
            case PieceColor.RED: startPos = 1; break;
            case PieceColor.GREEN: startPos = 14; break;
            case PieceColor.YELLOW: startPos = 27; break;
            case PieceColor.BLUE: startPos = 40; break;
        }
        
        // Global board is 1-52
        let pos = (startPos + step - 2) % 52 + 1;
        return pos;
    }

    static isSafeSquare(globalPos: number): boolean {
        const safeSquares = [1, 9, 14, 22, 27, 35, 40, 48];
        return safeSquares.includes(globalPos);
    }

    static canMove(player: Player, pieceIndex: number, diceValue: number): boolean {
        const currentPos = player.pieces[pieceIndex];

        // Piece in base needs a 6 to start
        if (currentPos === 0) {
            return diceValue === 6;
        }

        // Piece at home lane cannot exceed finish (57)
        if (currentPos + diceValue > 57) {
            return false;
        }

        return true;
    }

    static movePiece(room: RoomState, pieceIndex: number): { hit: boolean, finished: boolean } {
        const player = room.players[room.turn];
        const diceValue = room.diceValue;

        let hit = false;
        let finished = false;

        if (player.pieces[pieceIndex] === 0) {
            player.pieces[pieceIndex] = 1; // Start at step 1
        } else {
            player.pieces[pieceIndex] += diceValue;
            if (player.pieces[pieceIndex] === 57) {
                finished = true;
            }
        }

        // Collision Detection
        const newStep = player.pieces[pieceIndex];
        const globalPos = this.getGlobalPosition(player.color, newStep);

        if (globalPos !== null && !this.isSafeSquare(globalPos)) {
            for (let i = 0; i < room.players.length; i++) {
                if (i === room.turn) continue; // Skip current player
                
                const opponent = room.players[i];
                for (let j = 0; j < opponent.pieces.length; j++) {
                    const oppStep = opponent.pieces[j];
                    const oppGlobalPos = this.getGlobalPosition(opponent.color, oppStep);
                    
                    if (oppGlobalPos === globalPos) {
                        opponent.pieces[j] = 0; // Send back to base
                        hit = true;
                    }
                }
            }
        }

        return { hit, finished };
    }

    static checkWinner(room: RoomState): boolean {
        const player = room.players[room.turn];
        return player.pieces.every(p => p === 57);
    }
}
