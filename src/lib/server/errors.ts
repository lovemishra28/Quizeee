import 'server-only';

export class ActionError extends Error {
    constructor(message: string, readonly code = 'INVALID_REQUEST') {
        super(message);
        this.name = 'ActionError';
    }
}

export function publicActionError(error: unknown, fallback: string): string {
    return error instanceof ActionError ? error.message : fallback;
}

export function logActionError(operation: string, error: unknown): void {
    // Never log tokens, prompts, provider response bodies, or raw database errors.
    console.error(`[${operation}]`, error instanceof ActionError ? error.code : 'OPERATION_FAILED');
}
