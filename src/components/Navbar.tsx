'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getCachedProfileDirect, setCachedProfile, CachedProfile } from '@/lib/authCache';

interface NavbarProps {
    isSignUp?: boolean;
    onModeChange?: (isSignUp: boolean) => void;
}

export default function Navbar({ isSignUp, onModeChange }: NavbarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const isAuth = pathname?.startsWith('/auth');

    const [userProfile, setUserProfile] = useState<CachedProfile | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const cached = getCachedProfileDirect();
        if (cached) {
            setUserProfile(cached);
            setIsLoggedIn(true);
        }

        async function verifySession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsLoggedIn(true);
                if (!cached) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, full_name, role')
                        .eq('id', session.user.id)
                        .single();
                    if (profile) {
                        const prof: CachedProfile = {
                            id: session.user.id,
                            full_name: profile.full_name || 'User',
                            role: profile.role || 'student',
                        };
                        setUserProfile(prof);
                        setCachedProfile(prof);
                    }
                }
            } else {
                setIsLoggedIn(false);
                setUserProfile(null);
            }
        }
        verifySession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setIsLoggedIn(true);
            } else {
                setIsLoggedIn(false);
                setUserProfile(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSignOut = async () => {
        setCachedProfile(null);
        await supabase.auth.signOut();
        setIsLoggedIn(false);
        setUserProfile(null);
        router.push('/auth');
    };

    const isLoginActive = isAuth ? !isSignUp : false;
    const isSignUpActive = isAuth ? isSignUp : false;
    const isHomeActive = !isAuth;

    const dashboardHref = userProfile?.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student';

    return (
        <nav className="relative z-20 w-full flex justify-between items-center px-6 sm:px-10 h-[64px] border-b border-[#E86F47] bg-[#fff5f0]">
            <div className="flex items-center">
                <Link href={isLoggedIn ? dashboardHref : '/'} className="flex items-center cursor-pointer" title={isLoggedIn ? 'Go to Dashboard' : 'Quizeee Home'}>
                    <img
                        src="/quizeee-nav.png"
                        alt="quizeee"
                        className="h-7 w-auto select-none"
                    />
                </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 text-[13px] font-mono text-[#382d27]">
                {!isLoggedIn && (
                    <Link
                        href="/"
                        className={`px-4 sm:px-5 py-1.5 rounded-full font-medium transition-all ${
                            isHomeActive
                                ? 'bg-[#f0ded4] text-[#2c221e] shadow-xs'
                                : 'text-[#2c221e] hover:text-[#E86F47]'
                        }`}
                    >
                        Home
                    </Link>
                )}

                <Link
                    href="/#instant-quiz"
                    className="px-3.5 sm:px-4 py-1.5 rounded-full font-medium text-[#2c221e] hover:text-[#E86F47] hover:bg-[#faebe3] transition-all flex items-center gap-1.5"
                >
                    <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
                    <span>Instant Quiz</span>
                </Link>

                {isLoggedIn && !isAuth ? (
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link
                            href={userProfile?.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student'}
                            className="px-4 sm:px-5 py-1.5 rounded-full font-medium shadow-xs transition-all bg-[#E86F47] text-white hover:bg-[#c94e26]"
                        >
                            Dashboard
                        </Link>
                        <span
                            className="text-[#2c221e] font-bold font-mono text-[13px] hidden sm:inline max-w-[150px] truncate"
                            suppressHydrationWarning
                        >
                            {userProfile?.full_name || (userProfile?.role === 'teacher' ? 'Teacher' : 'Student')}
                        </span>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="px-3 py-1.5 rounded-full font-medium text-[#665e5a] hover:text-[#E86F47] hover:bg-[#edd6cb]/40 transition-colors cursor-pointer"
                        >
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <>
                        {onModeChange ? (
                            <button
                                type="button"
                                onClick={() => onModeChange(false)}
                                className={`px-3.5 sm:px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                                    isLoginActive
                                        ? 'bg-[#f0ded4] text-[#2c221e] shadow-xs'
                                        : 'text-[#2c221e] hover:text-[#E86F47]'
                                }`}
                            >
                                Login
                            </button>
                        ) : (
                            <Link
                                href="/auth"
                                className={`px-3.5 sm:px-4 py-1.5 rounded-full font-medium transition-all ${
                                    isLoginActive
                                        ? 'bg-[#f0ded4] text-[#2c221e] shadow-xs'
                                        : 'text-[#2c221e] hover:text-[#E86F47]'
                                }`}
                            >
                                Login
                            </Link>
                        )}

                        {onModeChange ? (
                            <button
                                type="button"
                                onClick={() => onModeChange(true)}
                                className={`px-4 sm:px-5 py-1.5 rounded-full font-medium shadow-xs transition-all cursor-pointer ${
                                    isSignUpActive
                                        ? 'bg-[#c94e26] text-white ring-2 ring-[#E86F47]/40'
                                        : 'bg-[#E86F47] text-white hover:bg-[#c94e26]'
                                }`}
                            >
                                Sign Up
                            </button>
                        ) : (
                            <Link
                                href="/auth?mode=signup"
                                className={`px-4 sm:px-5 py-1.5 rounded-full font-medium shadow-xs transition-all ${
                                    isSignUpActive
                                        ? 'bg-[#c94e26] text-white ring-2 ring-[#E86F47]/40'
                                        : 'bg-[#E86F47] text-white hover:bg-[#c94e26]'
                                }`}
                            >
                                Sign Up
                            </Link>
                        )}
                    </>
                )}
            </div>
        </nav>
    );
}

