'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFParse } from 'pdf-parse';

// Initialize the Gemini client using the private server-side environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function processStudyMaterial(formData: FormData) {
    try {
        // 1. Extract the file and configuration from FormData
        const file = formData.get('file') as File;
        const questionCount = formData.get('questionCount') as string;

        if (!file) {
            throw new Error('No file provided');
        }

        // 2. Convert the uploaded file into a Node.js Buffer for parsing
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 3. Extract text from the PDF
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        const extractedText = pdfData.text;

        console.log(`Successfully extracted ${extractedText.length} characters from PDF.`);

        // 4. (Placeholder) We will add the Gemini API call here in Step 2
        return { success: true, textLength: extractedText.length };

    } catch (error: any) {
        console.error('Error processing document:', error);
        return { success: false, error: error.message };
    }
}