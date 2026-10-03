export type AIProvider = 'nvidia' | 'gemini';

/**
 * AI Configuration
 * 
 * You can switch providers either by:
 * 1. Changing the AI_PROVIDER environment variable in .env.local ('nvidia' | 'gemini')
 * 2. Changing the ACTIVE_AI_PROVIDER constant below
 */
export const ACTIVE_AI_PROVIDER: AIProvider = 
    (process.env.AI_PROVIDER as AIProvider) || 'nvidia';

export const AI_CONFIG = {
    // Current active provider ('nvidia' or 'gemini')
    activeProvider: ACTIVE_AI_PROVIDER,

    nvidia: {
        apiUrl: process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey: process.env.NVIDIA_API_KEY || '',
        model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        temperature: 0.6,
        top_p: 0.95,
        maxTokens: 16384,
    },

    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    },
};
