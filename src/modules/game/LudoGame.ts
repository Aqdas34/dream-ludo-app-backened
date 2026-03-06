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

    // Roll dice (1-6)
    static rollDice(): number {
        return Math.floor(Math.random() * 6) + 1;
    }
}
