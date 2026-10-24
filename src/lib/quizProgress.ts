import { isRecord, isUuid } from './quizValidation';

export interface QuizProgress {
    endTime: number;
    questionIndex: number;
    answers: Record<string, number>;
}

export function quizProgressKey(userId: string, quizId: string, sessionId?: string): string {
    return `quizeee_static:${userId}:${quizId}:${sessionId || 'direct'}`;
}

/** Local refresh recovery only. Authoritative assessment deadlines must be stored on the server. */
export function readQuizProgress(key: string, questionIds: string[], durationMinutes: number): QuizProgress | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        if (!isRecord(value) || typeof value.endTime !== 'number' || !Number.isFinite(value.endTime) || value.endTime <= 0 || value.endTime > Date.now() + durationMinutes * 60_000 || !isRecord(value.answers) || typeof value.questionIndex !== 'number' || !Number.isInteger(value.questionIndex)) return null;
        const validIds = new Set(questionIds);
        const answers: Record<string, number> = {};
        for (const [id, index] of Object.entries(value.answers)) {
            if (isUuid(id) && validIds.has(id) && typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < 4) answers[id] = index;
        }
        return { endTime: value.endTime, questionIndex: Math.max(0, Math.min(value.questionIndex, questionIds.length - 1)), answers };
    } catch { return null; }
}

export function saveQuizProgress(key: string, progress: QuizProgress): void {
    if (typeof window === 'undefined') return;
    try { sessionStorage.setItem(key, JSON.stringify(progress)); } catch {}
}

export function clearQuizProgress(key: string): void {
    if (typeof window === 'undefined') return;
    try { sessionStorage.removeItem(key); } catch {}
}
