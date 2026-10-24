import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { ActionError } from './errors';
import type { UserRole } from '@/lib/types';

function serverClient(key: string, accessToken?: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || !key) throw new ActionError('The service is not configured. Please contact your teacher or administrator.', 'SERVICE_CONFIGURATION');
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: {
            ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
            fetch: (input, init) => fetch(input, {
                ...init,
                signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
            }),
        },
    });
}

export function getSupabaseAdmin() {
    return serverClient(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}

export async function requireUser(accessToken: unknown, role: UserRole) {
    if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 8192) {
        throw new ActionError('Please sign in to continue.', 'UNAUTHENTICATED');
    }
    const client = serverClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', accessToken);
    // getSession()/client-supplied IDs are not authentication on the server.
    const { data: { user }, error } = await client.auth.getUser(accessToken);
    if (error || !user) throw new ActionError('Your session has expired. Please sign in again.', 'UNAUTHENTICATED');
    const { data: profile, error: profileError } = await client.from('profiles').select('id, role').eq('id', user.id).single();
    if (profileError || profile?.role !== role) throw new ActionError(`This action requires a ${role} account.`, 'FORBIDDEN');
    return { user, client };
}
