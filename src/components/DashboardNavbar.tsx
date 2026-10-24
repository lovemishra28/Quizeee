'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LogOut } from 'lucide-react';

interface DashboardNavbarProps {
    role: 'teacher' | 'student';
    userName?: string;
    onSignOut: () => void | Promise<void>;
    activeTab?: 'dashboard' | 'analytics';
}

export default function DashboardNavbar({
    role,
    userName,
    onSignOut,
    activeTab = 'dashboard',
}: DashboardNavbarProps) {
    const homeHref = role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student';

    return (
        <nav aria-label="Dashboard navigation" className="sticky top-0 z-30 w-full flex flex-wrap justify-between items-center gap-2 px-4 sm:px-10 min-h-[64px] py-2 border-b border-[#E86F47] bg-[#fff5f0]">
            {/* Brand Logo - clean without sub-badges */}
            <div className="flex items-center shrink-0">
                <Link href={homeHref} className="flex items-center cursor-pointer" title="Dashboard Home">
                    <Image
                        src="/quizeee-nav.png"
                        alt="quizeee"
                        width={2172}
                        height={724}
                        sizes="84px"
                        className="h-6 sm:h-7 w-auto select-none"
                    />
                </Link>
            </div>

            {/* Right Side Navigation & User Profile */}
            <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-4 text-[13px] font-mono text-[#382d27]">
                {role === 'teacher' && (
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/teacher"
                            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                            className={`px-4 sm:px-5 py-1.5 rounded-full font-medium transition-all ${
                                activeTab === 'dashboard'
                                    ? 'bg-[#f0ded4] text-[#2c221e] shadow-xs'
                                    : 'text-[#2c221e] hover:text-[#E86F47] hover:bg-[#edd6cb]/30'
                            }`}
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/dashboard/teacher/analytics"
                            aria-current={activeTab === 'analytics' ? 'page' : undefined}
                            className={`px-4 sm:px-5 py-1.5 rounded-full font-medium transition-all ${
                                activeTab === 'analytics'
                                    ? 'bg-[#f0ded4] text-[#2c221e] shadow-xs'
                                    : 'text-[#2c221e] hover:text-[#E86F47] hover:bg-[#edd6cb]/30'
                            }`}
                        >
                            Analytics
                        </Link>
                    </div>
                )}

                {role === 'student' && (
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard/student"
                            aria-current="page"
                            className="px-4 sm:px-5 py-1.5 rounded-full font-medium bg-[#f0ded4] text-[#2c221e] shadow-xs transition-all"
                        >
                            Dashboard
                        </Link>
                    </div>
                )}

                {/* User Info & Logout Button */}
                <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-[#E86F47]/25">
                    <span
                        className="hidden sm:inline text-[#2c221e] font-bold font-mono text-sm max-w-[220px] truncate"
                        suppressHydrationWarning
                    >
                        {userName || (role === 'teacher' ? 'Teacher' : 'Student')}
                    </span>
                    <button
                        type="button"
                        onClick={onSignOut}
                        className="flex items-center justify-center p-1.5 rounded-full text-[#665e5a] hover:text-[#E86F47] hover:bg-[#edd6cb]/40 transition-colors cursor-pointer"
                        title="Sign Out"
                        aria-label="Sign Out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </nav>
    );
}
