import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase Environment Variables in .env.local');
}

// Custom auth storage adapter respecting the "Remember Me" setting:
// - When "Remember Me" is enabled, tokens persist in localStorage across tabs and browser restarts.
// - When "Remember Me" is disabled, tokens persist only in sessionStorage for the current tab session.
const authStorage = {
    getItem: (key: string): string | null => {
        if (typeof window === 'undefined') return null;
        try {
            const isRemembered = localStorage.getItem('quizeee_remember_me') === 'true';
            if (isRemembered) {
                return localStorage.getItem(key) ?? sessionStorage.getItem(key);
            }
            return sessionStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        if (typeof window === 'undefined') return;
        try {
            const isRemembered = localStorage.getItem('quizeee_remember_me') === 'true';
            if (isRemembered) {
                localStorage.setItem(key, value);
                sessionStorage.removeItem(key);
            } else {
                sessionStorage.setItem(key, value);
                localStorage.removeItem(key);
            }
        } catch {}
    },
    removeItem: (key: string): void => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        } catch {}
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: async (input, init) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15_000);
            const cancel = () => controller.abort();
            if (init?.signal?.aborted) cancel();
            else init?.signal?.addEventListener('abort', cancel, { once: true });
            try { return await fetch(input, { ...init, signal: controller.signal }); }
            finally {
                clearTimeout(timeout);
                init?.signal?.removeEventListener('abort', cancel);
            }
        },
    },
    auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
