import type { QuizQuestionInput } from './quizValidation';

export type UserRole = 'teacher' | 'student';
export type SessionStatus = 'waiting' | 'active' | 'leaderboard' | 'finished' | 'completed';

export interface Quiz {
    id: string;
    teacher_id: string;
    title: string;
    type: 'static' | 'competitive';
    created_at: string;
    description?: string | null;
    available_from?: string | null;
    available_until?: string | null;
    total_duration_minutes?: number | null;
    per_question_timer?: number | null;
    roomCode?: string;
    liveStatus?: SessionStatus;
}

export interface Question extends QuizQuestionInput {
    id: string;
    quiz_id: string;
    order_index: number;
}

export interface QuizSession {
    id: string;
    quiz_id: string;
    room_code: string;
    status: SessionStatus;
    current_question_index: number;
    created_at: string;
}
