'use server';

import { PDFParse } from 'pdf-parse';
import { generateQuizAI, generateQuizAIFromPdfBuffer, AIProvider } from '@/lib/ai';

export async function processStudyMaterial(formData: FormData) {
    try {
        const file = formData.get('file') as File | null;
        const topic = (formData.get('topic') as string | null)?.trim();
        const questionCount = parseInt(formData.get('questionCount') as string) || 5;
        const providerOverride = (formData.get('provider') as AIProvider) || undefined;

        // If a direct topic or study notes are provided without a file
        if (topic && (!file || file.size === 0)) {
            console.log(`[AI] Generating ${questionCount} questions directly from topic prompt: "${topic}"`);
            const { questions, provider } = await generateQuizAI(
                `Topic: ${topic}\nPlease generate multiple choice questions covering this topic.`,
                questionCount,
                providerOverride
            );
            return { success: true, questions, provider, isMultimodal: false };
        }

        if (!file || file.size === 0) throw new Error('Please enter a topic or upload study material.');

        // 1. Read PDF buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Attempt standard text extraction with PDFParse
        let extractedText = '';
        try {
            const parser = new PDFParse({ data: buffer });
            const textResult = await parser.getText();
            extractedText = textResult.text || '';
        } catch (pdfErr: any) {
            console.warn('[PDF] Standard text extraction failed, falling back to multimodal AI vision:', pdfErr.message);
        }

        // Clean out page delimiters and whitespace to test for actual readable content
        const meaningfulText = extractedText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();

        // 3. If PDF has readable text, use standard text-based AI generation
        if (meaningfulText.length >= 80) {
            console.log(`[PDF] Extracted ${meaningfulText.length} characters of readable text. Using text AI pipeline...`);
            const { questions, provider } = await generateQuizAI(
                extractedText,
                questionCount,
                providerOverride
            );
            return { success: true, questions, provider, isMultimodal: false };
        }

        // 4. Otherwise, this is a scanned/image-based/slide presentation PDF.
        // Process directly using Multimodal Vision AI!
        console.log('[PDF] No selectable text detected (image-based or slide PDF). Utilizing Multimodal AI Vision directly...');
        const { questions, provider } = await generateQuizAIFromPdfBuffer(
            buffer,
            questionCount,
            providerOverride
        );

        return { success: true, questions, provider, isMultimodal: true };

    } catch (error: any) {
        console.error('Error generating quiz:', error);
        return { success: false, error: error.message };
    }
}