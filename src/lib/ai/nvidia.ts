import { AI_CONFIG } from './config';
import { GeneratedQuestion, parseAndNormalizeQuestions } from './types';

export async function generateQuizWithNvidia(
    extractedText: string,
    questionCount: number
): Promise<GeneratedQuestion[]> {
    const { apiUrl, apiKey, model, temperature, top_p, maxTokens } = AI_CONFIG.nvidia;

    if (!apiKey) {
        throw new Error('NVIDIA API key is missing. Please set NVIDIA_API_KEY in .env.local.');
    }

    const systemPrompt = `You are an expert educational AI. Based on the provided study material, generate exactly ${questionCount} multiple-choice questions.
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
4. Output valid JSON array only, without any markdown formatting or surrounding explanations.`;

    const userPrompt = `Study Material Content:
"""
${extractedText}
"""

Generate the ${questionCount} multiple-choice questions in strict JSON format now.`;

    const payload = {
        model,
        messages: [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: userPrompt,
            },
        ],
        temperature,
        top_p,
        max_tokens: maxTokens,
        stream: false,
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`NVIDIA API request failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('No content returned from NVIDIA API');
    }

    return parseAndNormalizeQuestions(content, questionCount);
}
