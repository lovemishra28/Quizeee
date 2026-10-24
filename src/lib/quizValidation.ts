export const MAX_QUESTIONS = 20;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_STUDY_TEXT_LENGTH = 120_000;

export interface QuizQuestionInput {
    question_text: string;
    options: string[];
    correct_option_index: number;
    explanation: string;
    subtopic: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateQuestionCount(value: unknown): number {
    const count = typeof value === 'string' && value.trim() ? Number(value) : value;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
        throw new Error(`Choose between 1 and ${MAX_QUESTIONS} questions.`);
    }
    return count;
}

export function validateQuizQuestions(value: unknown, expectedCount?: number): QuizQuestionInput[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_QUESTIONS) {
        throw new Error(`A quiz must contain between 1 and ${MAX_QUESTIONS} questions.`);
    }
    if (expectedCount !== undefined && value.length !== validateQuestionCount(expectedCount)) {
        throw new Error('The generated question count does not match your request. Please generate again.');
    }

    return value.map((item: unknown, index) => {
        const prefix = `Question ${index + 1}`;
        if (!isRecord(item) || typeof item.question_text !== 'string' || !item.question_text.trim() || item.question_text.length > 2000) {
            throw new Error(`${prefix} needs question text of at most 2,000 characters.`);
        }
        if (!Array.isArray(item.options) || item.options.length !== 4 || item.options.some((option: unknown) => typeof option !== 'string' || !option.trim() || option.length > 1000)) {
            throw new Error(`${prefix} needs four non-empty options of at most 1,000 characters each.`);
        }
        const options = (item.options as string[]).map(option => option.trim());
        if (new Set(options.map(option => option.toLocaleLowerCase())).size !== options.length) {
            throw new Error(`${prefix} needs four distinct options.`);
        }
        if (typeof item.correct_option_index !== 'number' || !Number.isInteger(item.correct_option_index) || item.correct_option_index < 0 || item.correct_option_index > 3) {
            throw new Error(`${prefix} needs a valid correct answer.`);
        }
        if (item.explanation !== undefined && (typeof item.explanation !== 'string' || item.explanation.length > 4000)) {
            throw new Error(`${prefix} has an invalid explanation.`);
        }
        if (item.subtopic !== undefined && (typeof item.subtopic !== 'string' || item.subtopic.length > 80)) {
            throw new Error(`${prefix} has an invalid subtopic.`);
        }
        return {
            question_text: item.question_text.trim(),
            options,
            correct_option_index: item.correct_option_index,
            explanation: typeof item.explanation === 'string' ? item.explanation.trim() : '',
            subtopic: typeof item.subtopic === 'string' && item.subtopic.trim() ? item.subtopic.trim() : 'General',
        };
    });
}
