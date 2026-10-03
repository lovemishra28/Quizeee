import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_CONFIG } from './config';
import { GeneratedQuestion, parseAndNormalizeQuestions } from './types';

function getGeminiClient() {
    const { apiKey, model: configuredModel } = AI_CONFIG.gemini;

    if (!apiKey) {
        throw new Error('Gemini API key is missing. Please set GEMINI_API_KEY in .env.local.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidateModels = [configuredModel, 'gemini-3.5-flash', 'gemini-flash-latest'].filter(Boolean);

    return { genAI, candidateModels };
}

export async function generateQuizWithGemini(
    extractedText: string,
    questionCount: number
): Promise<GeneratedQuestion[]> {
    const { genAI, candidateModels } = getGeminiClient();

    const prompt = `
      You are an expert educational AI. Based on the provided study material, generate exactly ${questionCount} multiple-choice questions.
      Your entire response must be a single JSON array containing objects that exactly match this schema:
      
      [
        {
          "question_text": "The actual question string",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_option_index": 0,
          "explanation": "A short sentence explaining why this answer is correct",
          "subtopic": "A 1-3 word tag representing the specific concept"
        }
      ]

      Study Material Content:
      """
      ${extractedText}
      """
    `;

    let lastError: any = null;
    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: 'application/json' },
            });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            return parseAndNormalizeQuestions(responseText, questionCount);
        } catch (err: any) {
            console.warn(`[Gemini Text] Model ${modelName} failed:`, err.message);
            lastError = err;
        }
    }

    throw lastError || new Error('Failed to generate quiz using Gemini.');
}

/**
 * Directly generate questions from an image-based/scanned PDF buffer using Gemini Multimodal Vision.
 */
export async function generateQuizFromPdfBufferWithGemini(
    pdfBuffer: Buffer,
    questionCount: number
): Promise<GeneratedQuestion[]> {
    const { genAI, candidateModels } = getGeminiClient();
    const base64Pdf = pdfBuffer.toString('base64');

    const prompt = `You are an expert educational AI. Based on the provided study material document (which contains slides, diagrams, text, and visual flowcharts), generate exactly ${questionCount} high-quality multiple-choice questions.
Your entire response must be a single JSON array containing objects that exactly match this schema:

[
  {
    "question_text": "The actual question string",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_option_index": 0,
    "explanation": "A short sentence explaining why this answer is correct",
    "subtopic": "A 1-3 word tag representing the specific concept"
  }
]

Requirements:
1. Provide exactly ${questionCount} questions.
2. Provide exactly 4 options per question.
3. correct_option_index must be an integer between 0 and 3.
4. Output valid JSON array only, without markdown formatting or surrounding explanations.`;

    let lastError: any = null;
    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: 'application/json' },
            });

            const result = await model.generateContent([
                {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: base64Pdf,
                    },
                },
                prompt,
            ]);

            const responseText = result.response.text();
            return parseAndNormalizeQuestions(responseText, questionCount);
        } catch (err: any) {
            console.warn(`[Gemini Multimodal] Model ${modelName} failed:`, err.message);
            lastError = err;
        }
    }

    throw lastError || new Error('Failed to generate quiz from PDF using Gemini vision.');
}

/**
 * Transcribe/extract all visible text, diagram data, and slide content from an image-based PDF.
 * This allows text-only LLMs (like NVIDIA Nemotron) to operate on visual/scanned PDFs.
 */
export async function extractVisualTextFromPdfBufferWithGemini(
    pdfBuffer: Buffer
): Promise<string> {
    const { genAI, candidateModels } = getGeminiClient();
    const base64Pdf = pdfBuffer.toString('base64');

    const prompt = `You are an expert educational OCR and document transcription AI.
Thoroughly extract and transcribe all slide content, titles, tables, bullet points, comparisons, architecture layers, and diagram explanations from this document.
Format the output as comprehensive, detailed study notes that cover all factual details, terms, and concepts in depth.`;

    let lastError: any = null;
    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([
                {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: base64Pdf,
                    },
                },
                prompt,
            ]);
            const text = result.response.text();
            if (text && text.trim().length > 50) {
                return text;
            }
        } catch (err: any) {
            console.warn(`[Gemini Visual OCR] Model ${modelName} failed:`, err.message);
            lastError = err;
        }
    }

    throw lastError || new Error('Failed to transcribe visual PDF using Gemini vision.');
}
