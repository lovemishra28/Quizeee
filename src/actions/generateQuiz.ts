'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function processStudyMaterial(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        const questionCount = parseInt(formData.get('questionCount') as string) || 5;

        if (!file) throw new Error('No file provided');

        // 1. Extract text from the PDF
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        const extractedText = textResult.text;

        // 2. Initialize the Gemini model
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.6-flash',
            // Force the AI to output valid JSON instead of conversational text
            generationConfig: { responseMimeType: 'application/json' }
        });

        // 3. Engineer the strict JSON prompt
        const prompt = `
      You are an expert educational AI. Based on the provided study material, generate exactly ${questionCount} multiple-choice questions.
      Your entire response must be a single JSON array containing objects that exactly match this schema:
      
      [
        {
          "question_text": "The actual question string",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_option_index": 0, // An integer (0 to 3) indicating the correct option
          "explanation": "A short sentence explaining why this answer is correct",
          "subtopic": "A 1-3 word tag representing the specific concept"
        }
      ]

      Study Material Content:
      """
      ${extractedText}
      """
    `;

        // 4. Execute the AI request
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 5. Parse the raw JSON string into usable JavaScript objects
        const generatedQuestions = JSON.parse(responseText);

        return { success: true, questions: generatedQuestions };

    } catch (error: any) {
        console.error('Error generating quiz:', error);
        return { success: false, error: error.message };
    }
}