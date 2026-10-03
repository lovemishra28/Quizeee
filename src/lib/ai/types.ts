export interface GeneratedQuestion {
    question_text: string;
    options: string[];
    correct_option_index: number;
    explanation: string;
    subtopic: string;
}

/**
 * Safely extracts and parses JSON array of questions from raw model output.
 * Handles markdown code fences (```json ... ```), extra preamble, or reasoning text.
 */
export function parseAndNormalizeQuestions(rawText: string, expectedCount: number): GeneratedQuestion[] {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('Empty response received from AI model');
    }

    let cleaned = rawText.trim();

    // Strip markdown code fences if present (e.g. ```json ... ``` or ``` ...)
    if (cleaned.startsWith('```')) {
        const firstLineEnd = cleaned.indexOf('\n');
        if (firstLineEnd !== -1) {
            cleaned = cleaned.substring(firstLineEnd + 1);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
        }
        cleaned = cleaned.trim();
    }

    // If there is still extra text around JSON array, find the first '[' and last ']'
    const startIndex = cleaned.indexOf('[');
    const endIndex = cleaned.lastIndexOf(']');
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
    }

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err: any) {
        console.error('Failed to parse AI JSON response. Raw text:', rawText);
        throw new Error(`AI generated invalid JSON: ${err.message}`);
    }

    if (!Array.isArray(parsed)) {
        // If an object wrapped the array (e.g. { questions: [...] })
        if (parsed && Array.isArray(parsed.questions)) {
            parsed = parsed.questions;
        } else {
            throw new Error('AI response is not an array of questions');
        }
    }

    // Normalize each question object so it strictly conforms to GeneratedQuestion
    const normalized: GeneratedQuestion[] = parsed.map((item: any, idx: number) => {
        const question_text = String(item.question_text || item.question || `Question ${idx + 1}`).trim();
        
        let rawOptions = Array.isArray(item.options) ? item.options : [];
        if (rawOptions.length < 2) {
            rawOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
        }
        const options = rawOptions.map((opt: any) => String(opt).trim());

        let correct_option_index = 0;
        if (typeof item.correct_option_index === 'number' && item.correct_option_index >= 0 && item.correct_option_index < options.length) {
            correct_option_index = Math.floor(item.correct_option_index);
        } else if (typeof item.answer === 'string') {
            const foundIdx = options.findIndex((opt: string) => opt.toLowerCase() === item.answer.toLowerCase());
            if (foundIdx !== -1) correct_option_index = foundIdx;
        } else if (typeof item.correct_answer === 'string') {
            const foundIdx = options.findIndex((opt: string) => opt.toLowerCase() === item.correct_answer.toLowerCase());
            if (foundIdx !== -1) correct_option_index = foundIdx;
        }

        const explanation = String(item.explanation || 'Correct answer based on the study material.').trim();
        const subtopic = String(item.subtopic || item.topic || 'General').trim();

        return {
            question_text,
            options,
            correct_option_index,
            explanation,
            subtopic,
        };
    });

    return normalized;
}
