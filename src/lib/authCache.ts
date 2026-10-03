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

export function getCachedProfile(): CachedProfile | null {
    if (typeof window === 'undefined' || !hasHydrated) return null;
    try {
        const stored = sessionStorage.getItem('quizeee_user_profile');
        if (stored) {
            return JSON.parse(stored) as CachedProfile;
        }
    } catch {
        return null;
    }
    return null;
}

export function getCachedProfileDirect(): CachedProfile | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = sessionStorage.getItem('quizeee_user_profile');
        if (stored) {
            return JSON.parse(stored) as CachedProfile;
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
            sessionStorage.setItem('quizeee_user_profile', JSON.stringify(profile));
        } else {
            sessionStorage.removeItem('quizeee_user_profile');
        }
    } catch {}
}
