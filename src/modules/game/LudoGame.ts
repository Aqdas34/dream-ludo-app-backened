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

    static getStartingPosition(color: PieceColor): number {
        switch (color) {
            case PieceColor.RED: return 1;
            case PieceColor.GREEN: return 14;
            case PieceColor.YELLOW: return 27;
            case PieceColor.BLUE: return 40;
            default: return 1;
        }
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

        // Logic check for hitting other pieces
        // For simplicity, we compare global board positions
        // This would require a conversion from local step (1-57) to global coordinate (1-52)
        // Skipping complex collision for now to ensure basic movement works

        return { hit, finished };
    }

    static checkWinner(room: RoomState): boolean {
        const player = room.players[room.turn];
        return player.pieces.every(p => p === 57);
    }
}
