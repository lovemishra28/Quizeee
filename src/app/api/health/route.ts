export const dynamic = 'force-dynamic';

/** Process/configuration probe only: this does not attest to external service connectivity. */
export function GET() {
    const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && (process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY));
    return Response.json(
        { status: configured ? 'ok' : 'degraded', scope: 'process-and-configuration', configuration: configured ? 'present' : 'missing' },
        { status: configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
}
