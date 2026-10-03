'use client';

interface DashboardLoadingProps {
    message?: string;
    subMessage?: string;
}

export default function DashboardLoading({ message }: DashboardLoadingProps) {
    return (
        <div className="flex-1 w-full flex flex-col items-center justify-center p-8 relative z-10 min-h-[360px]">
            <div className="flex flex-col items-center justify-center gap-3">
                {/* Clean, smooth circling loader in brand theme */}
                <div className="w-10 h-10 rounded-full border-[3px] border-[#edd6cb] border-t-[#E86F47] animate-spin" />
                {message && (
                    <p className="text-xs font-mono text-[#665e5a] tracking-wide animate-pulse">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}
