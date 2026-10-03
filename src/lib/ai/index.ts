import { AI_CONFIG, AIProvider } from './config';
import { generateQuizWithNvidia } from './nvidia';
import {
    generateQuizWithGemini,
    generateQuizFromPdfBufferWithGemini,
    extractVisualTextFromPdfBufferWithGemini,
} from './gemini';
import { GeneratedQuestion } from './types';

export * from './config';
export * from './types';
export { generateQuizWithNvidia } from './nvidia';
export {
    generateQuizWithGemini,
    generateQuizFromPdfBufferWithGemini,
    extractVisualTextFromPdfBufferWithGemini,
} from './gemini';

/**
 * Main quiz generation dispatcher for text content.
 * Automatically uses the active provider (defaults to NVIDIA), or can be overridden per-call.
 */
export async function generateQuizAI(
    extractedText: string,
    questionCount: number,
    providerOverride?: AIProvider
): Promise<{ questions: GeneratedQuestion[]; provider: AIProvider }> {
    const provider: AIProvider = providerOverride || AI_CONFIG.activeProvider;

    console.log(`[AI] Generating ${questionCount} questions using provider: "${provider}"`);

    if (provider === 'nvidia') {
        try {
            const questions = await generateQuizWithNvidia(extractedText, questionCount);
            return { questions, provider: 'nvidia' };
        } catch (nvidiaErr: any) {
            console.warn('[AI] NVIDIA generation failed, falling back to Gemini:', nvidiaErr.message);
            const questions = await generateQuizWithGemini(extractedText, questionCount);
            return { questions, provider: 'gemini' };
        }
    }

    if (provider === 'gemini') {
        try {
            const questions = await generateQuizWithGemini(extractedText, questionCount);
            return { questions, provider: 'gemini' };
        } catch (geminiErr: any) {
            console.warn('[AI] Gemini generation failed, falling back to NVIDIA:', geminiErr.message);
            const questions = await generateQuizWithNvidia(extractedText, questionCount);
            return { questions, provider: 'nvidia' };
        }
    }

    throw new Error(`Unsupported AI provider: "${provider}". Supported providers: "nvidia", "gemini".`);
}

/**
 * Multimodal quiz generation dispatcher for visual/scanned/slide PDFs where text cannot be selected.
 * Uses Gemini Multimodal Vision, with automatic transcription feeding into NVIDIA if preferred.
 */
export async function generateQuizAIFromPdfBuffer(
    pdfBuffer: Buffer,
    questionCount: number,
    providerOverride?: AIProvider
): Promise<{ questions: GeneratedQuestion[]; provider: AIProvider }> {
    const provider: AIProvider = providerOverride || AI_CONFIG.activeProvider;

    console.log(`[AI Multimodal] Processing visual PDF (${pdfBuffer.length} bytes) using provider preference: "${provider}"`);

    if (provider === 'nvidia') {
        try {
            console.log('[AI Multimodal] Transcribing visual slide diagrams via Gemini Vision for NVIDIA processing...');
            const transcribedContent = await extractVisualTextFromPdfBufferWithGemini(pdfBuffer);
            const questions = await generateQuizWithNvidia(transcribedContent, questionCount);
            return { questions, provider: 'nvidia' };
        } catch (nvidiaErr: any) {
            console.warn('[AI Multimodal] NVIDIA transcription pipeline failed, falling back to direct Gemini multimodal:', nvidiaErr.message);
            const questions = await generateQuizFromPdfBufferWithGemini(pdfBuffer, questionCount);
            return { questions, provider: 'gemini' };
        }
    }

    // Default or Gemini provider
    const questions = await generateQuizFromPdfBufferWithGemini(pdfBuffer, questionCount);
    return { questions, provider: 'gemini' };
}
