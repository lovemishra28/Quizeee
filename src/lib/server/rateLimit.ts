import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { ActionError } from './errors';

const buckets = new Map<string, { count: number; expiresAt: number }>();
const inFlight = new Set<string>();
const MAX_BUCKETS = 10_000;
let activeGenerations = 0;

export async function limitPublicAction(operation: string, limit: number, windowMs = 10 * 60_000): Promise<void> {
    const requestHeaders = await headers();
    // The production ingress must normalize these headers and provide durable quotas.
    const address = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'unknown';
    const key = `${operation}:${createHash('sha256').update(address.slice(0, 200)).digest('hex')}`;
    const now = Date.now();
    for (const [existingKey, bucket] of buckets) if (bucket.expiresAt <= now) buckets.delete(existingKey);
    const bucket = buckets.get(key);
    if (bucket && bucket.count >= limit) throw new ActionError('Too many requests. Please wait a few minutes and try again.', 'RATE_LIMITED');
    if (!bucket && buckets.size >= MAX_BUCKETS) throw new ActionError('The service is busy. Please try again shortly.', 'RATE_LIMITED');
    buckets.set(key, { count: (bucket?.count || 0) + 1, expiresAt: bucket?.expiresAt || now + windowMs });
}

export async function withSubmissionLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (inFlight.has(key)) throw new ActionError('This attempt is already being submitted. Please wait.', 'SUBMISSION_IN_PROGRESS');
    inFlight.add(key);
    try { return await operation(); }
    finally { inFlight.delete(key); }
}

export async function withGenerationSlot<T>(operation: () => Promise<T>): Promise<T> {
    if (activeGenerations >= 3) throw new ActionError('Quiz generation is busy. Please try again shortly.', 'GENERATION_BUSY');
    activeGenerations++;
    try { return await operation(); }
    finally { activeGenerations--; }
}
