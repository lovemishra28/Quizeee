import { isRecord, validateQuizQuestions } from '@/lib/quizValidation';
import type { QuizQuestionInput } from '@/lib/quizValidation';

export type GeneratedQuestion = QuizQuestionInput;

/** Accept harmless formatting/field aliases, but never invent questions or correct answers. */
export function parseAndNormalizeQuestions(rawText: string, expectedCount: number): GeneratedQuestion[] {
    if (typeof rawText !== 'string' || !rawText.trim() || rawText.length > 1_000_000) throw new Error('The AI returned an invalid response.');
    const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start < 0 || end <= start) throw new Error('The AI returned invalid JSON. Please generate again.');
        try { parsed = JSON.parse(cleaned.slice(start, end + 1)); }
        catch { throw new Error('The AI returned invalid JSON. Please generate again.'); }
    }
    if (isRecord(parsed) && Array.isArray(parsed.questions)) parsed = parsed.questions;
    if (!Array.isArray(parsed)) throw new Error('The AI did not return a question list.');
    const normalized = parsed.map((item: unknown) => {
        if (!isRecord(item)) throw new Error('The AI returned a malformed question.');
        const options = item.options;
        let answer: unknown = item.correct_option_index;
        const answerText = item.answer ?? item.correct_answer;
        if (answer === undefined && typeof answerText === 'string' && Array.isArray(options)) {
            answer = options.findIndex(option => typeof option === 'string' && option.trim().toLocaleLowerCase() === answerText.trim().toLocaleLowerCase());
        }
        return { question_text: item.question_text ?? item.question, options, correct_option_index: answer, explanation: item.explanation, subtopic: item.subtopic ?? item.topic };
    });
    return validateQuizQuestions(normalized, expectedCount);
}
