'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarProps {
    isSignUp?: boolean;
    onModeChange?: (isSignUp: boolean) => void;
}

export default function Navbar({ isSignUp, onModeChange }: NavbarProps) {
    const pathname = usePathname();
    const isAuth = pathname?.startsWith('/auth');

    const isLoginActive = isAuth ? !isSignUp : false;
    const isSignUpActive = isAuth ? isSignUp : false;
    const isHomeActive = !isAuth;

    return (
        <nav className="relative z-20 w-full flex justify-between items-center px-6 sm:px-10 h-[64px] border-b border-[#E86F47] bg-[#fff5f0]">
            <div className="flex items-center">
                <Link href="/" className="flex items-center cursor-pointer">
                    <img
                        src="/quizeee-nav.png"
                        alt="quizeee"
                        className="h-7 w-auto select-none"
                    />
                </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 text-[13px] font-mono text-[#382d27]">
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

                <Link
                    href="/#instant-quiz"
                    className="px-3.5 sm:px-4 py-1.5 rounded-full font-medium text-[#2c221e] hover:text-[#E86F47] hover:bg-[#faebe3] transition-all flex items-center gap-1.5"
                >
                    <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
                    <span>Instant Quiz</span>
                </Link>

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
            </div>
        </nav>
    );
}
