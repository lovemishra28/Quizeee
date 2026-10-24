import { isRecord, isUuid } from './quizValidation';

export interface CachedProfile {
    id: string;
    full_name: string;
    role: string;
}

let hasHydrated = false;

export function isClientHydrated(): boolean {
    return hasHydrated;
}

export function markClientHydrated(): void {
    hasHydrated = true;
}

export function isRememberMeActive(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem('quizeee_remember_me') === 'true';
    } catch {
        return false;
    }
}

export function setRememberMeActive(active: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        if (active) {
            localStorage.setItem('quizeee_remember_me', 'true');
        } else {
            localStorage.removeItem('quizeee_remember_me');
        }
    } catch {}
}

export function hasPotentialSession(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const isRemembered = localStorage.getItem('quizeee_remember_me') === 'true';
        if (isRemembered) {
            if (localStorage.getItem('quizeee_user_profile')) return true;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('sb-') || k.includes('auth-token'))) {
                    return true;
                }
            }
        }
        if (sessionStorage.getItem('quizeee_user_profile')) return true;
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && (k.startsWith('sb-') || k.includes('auth-token'))) {
                return true;
            }
        }
    } catch {}
    return false;
}

export function getCachedProfile(): CachedProfile | null {
    if (typeof window === 'undefined' || !hasHydrated) return null;
    return getCachedProfileDirect();
}

export function getCachedProfileDirect(): CachedProfile | null {
    if (typeof window === 'undefined') return null;
    try {
        const isRemembered = localStorage.getItem('quizeee_remember_me') === 'true';
        const stored = isRemembered
            ? (localStorage.getItem('quizeee_user_profile') || sessionStorage.getItem('quizeee_user_profile'))
            : sessionStorage.getItem('quizeee_user_profile');
        if (stored) {
            const profile: unknown = JSON.parse(stored);
            if (isRecord(profile) && isUuid(profile.id) && typeof profile.full_name === 'string' && profile.full_name.length <= 1000 && (profile.role === 'teacher' || profile.role === 'student')) {
                return { id: profile.id, full_name: profile.full_name, role: profile.role };
            }
            return null;
        }
    } catch {
        return null;
    }
    return null;
}

export function setCachedProfile(profile: CachedProfile | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (profile) {
            const isRemembered = localStorage.getItem('quizeee_remember_me') === 'true';
            if (isRemembered) {
                localStorage.setItem('quizeee_user_profile', JSON.stringify(profile));
                sessionStorage.removeItem('quizeee_user_profile');
            } else {
                sessionStorage.setItem('quizeee_user_profile', JSON.stringify(profile));
                localStorage.removeItem('quizeee_user_profile');
            }
        } else {
            sessionStorage.removeItem('quizeee_user_profile');
            localStorage.removeItem('quizeee_user_profile');
            localStorage.removeItem('quizeee_remember_me');
        }
    } catch {}
}

export function clearAllAuth(): void {
    if (typeof window === 'undefined') return;
    try {
        setCachedProfile(null);
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.startsWith('quizeee_'))) {
                localStorage.removeItem(key);
            }
        }
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('auth-token') || key.startsWith('quizeee_'))) {
                sessionStorage.removeItem(key);
            }
        }
    } catch {}
}
