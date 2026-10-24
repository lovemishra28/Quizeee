'use server';

import { PDFParse } from 'pdf-parse';
import { generateQuizAI, generateQuizAIFromPdfBuffer } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai';
import { MAX_STUDY_TEXT_LENGTH, MAX_UPLOAD_BYTES, validateQuestionCount } from '@/lib/quizValidation';
import { ActionError, logActionError, publicActionError } from '@/lib/server/errors';
import { limitPublicAction, withGenerationSlot } from '@/lib/server/rateLimit';

export async function processStudyMaterial(formData: FormData) {
    try {
        if (!(formData instanceof FormData)) throw new ActionError('Invalid study material request.');
        let questionCount: number;
        try {
            questionCount = validateQuestionCount(formData.get('questionCount') ?? 5);
        } catch (error) {
            throw new ActionError(error instanceof Error ? error.message : 'Choose a valid question count.');
        }
        const topicField = formData.get('topic');
        if (topicField !== null && typeof topicField !== 'string') throw new ActionError('Enter study notes as text.');
        const topic = typeof topicField === 'string' ? topicField.trim() : '';
        if (topic.length > MAX_STUDY_TEXT_LENGTH)
            throw new ActionError('Study notes are too long. Please use a shorter excerpt.');
        const providerField = formData.get('provider');
        if (providerField !== null && providerField !== '' && providerField !== 'nvidia' && providerField !== 'gemini')
            throw new ActionError('Choose a supported AI provider.');
        const providerOverride = providerField ? (providerField as AIProvider) : undefined;
        const fileField = formData.get('file');
        if (fileField !== null && !(fileField instanceof File))
            throw new ActionError('Upload a PDF or plain-text file.');
        const file = fileField instanceof File && fileField.size > 0 ? fileField : null;
        if (!file && !topic) throw new ActionError('Please enter a topic or upload study material.');
        if (file && file.size > MAX_UPLOAD_BYTES) throw new ActionError('Uploads must be 10 MB or smaller.');
        if (file && !/\.(pdf|txt)$/i.test(file.name)) throw new ActionError('Upload a PDF or plain-text (.txt) file.');
        await limitPublicAction('quiz-generation', 10);
        return await withGenerationSlot(async () => {
            if (!file) {
                const { questions, provider } = await generateQuizAI(
                    `Topic: ${topic}\nGenerate multiple-choice questions covering this topic.`,
                    questionCount,
                    providerOverride,
                );
                return { success: true as const, questions, provider, isMultimodal: false };
            }
            if (/\.txt$/i.test(file.name)) {
                if (file.type && file.type !== 'text/plain') throw new ActionError('Upload a valid plain-text file.');
                const text = (await file.text()).trim();
                if (!text || text.length > MAX_STUDY_TEXT_LENGTH || text.includes('\0'))
                    throw new ActionError('Use non-empty plain-text notes of at most 120,000 characters.');
                const { questions, provider } = await generateQuizAI(text, questionCount, providerOverride);
                return { success: true as const, questions, provider, isMultimodal: false };
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            if ((file.type && file.type !== 'application/pdf') || !buffer.subarray(0, 5).equals(Buffer.from('%PDF-')))
                throw new ActionError('Upload a valid PDF document.');
            let extractedText = '';
            const parser = new PDFParse({ data: buffer });
            let extractionTimeout: ReturnType<typeof setTimeout> | undefined;
            try {
                extractedText = await Promise.race([
                    (async () => {
                        const info = await parser.getInfo();
                        if (info.total > 200) throw new ActionError('Use a PDF with at most 200 pages.');
                        return (await parser.getText()).text || '';
                    })(),
                    new Promise<string>((_, reject) => {
                        extractionTimeout = setTimeout(
                            () =>
                                reject(
                                    new ActionError('This PDF took too long to process. Upload a shorter document.'),
                                ),
                            30_000,
                        );
                    }),
                ]);
            } catch (error) {
                if (error instanceof ActionError) throw error;
                throw new ActionError('This PDF could not be read. Check that it is valid and not password-protected.');
            } finally {
                clearTimeout(extractionTimeout);
                await parser.destroy();
            }
            const meaningfulText = extractedText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
            if (meaningfulText.length > MAX_STUDY_TEXT_LENGTH)
                throw new ActionError('The PDF contains too much text. Upload a shorter excerpt.');
            if (meaningfulText.length >= 20) {
                const { questions, provider } = await generateQuizAI(extractedText, questionCount, providerOverride);
                return { success: true as const, questions, provider, isMultimodal: false };
            }
            const { questions, provider } = await generateQuizAIFromPdfBuffer(buffer, questionCount, providerOverride);
            return { success: true as const, questions, provider, isMultimodal: true };
        });
    } catch (error) {
        logActionError('quiz-generation', error);
        return {
            success: false as const,
            error: publicActionError(error, 'Quiz generation is temporarily unavailable. Please try again.'),
        };
    }
}
