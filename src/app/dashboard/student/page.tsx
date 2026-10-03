'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Play, Hash } from 'lucide-react';
import DashboardNavbar from '@/components/DashboardNavbar';
import DashboardBackground from '@/components/DashboardBackground';
import DashboardLoading from '@/components/DashboardLoading';
import { getCachedProfile, setCachedProfile, markClientHydrated, getCachedProfileDirect } from '@/lib/authCache';

export default function StudentDashboard() {
    const cached = getCachedProfile();
    const [loading, setLoading] = useState(!cached);
    const [userName, setUserName] = useState(cached?.full_name || '');
    const [userId, setUserId] = useState(cached?.id || '');
    const [roomCode, setRoomCode] = useState('');
    const [staticQuizzes, setStaticQuizzes] = useState<any[]>([]);
    const [completedQuizIds, setCompletedQuizIds] = useState<Set<string>>(new Set());
    const router = useRouter();

    useEffect(() => {
        markClientHydrated();
        const storedProfile = getCachedProfileDirect();
        if (storedProfile) {
            setUserName(storedProfile.full_name);
            setUserId(storedProfile.id);
        }

        async function checkAuth() {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/auth');
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', session.user.id)
                .single();

            if (!profile) {
                router.push('/auth');
                return;
            }

            setUserName(profile.full_name);
            setUserId(session.user.id);
            setCachedProfile({
                id: session.user.id,
                full_name: profile.full_name,
                role: profile.role,
            });

            // Fetch static quizzes
            const { data: quizzesData } = await supabase
                .from('quizzes')
                .select('*')
                .eq('type', 'static')
                .order('created_at', { ascending: false });

            if (quizzesData) {
                setStaticQuizzes(quizzesData);
            }

            // Fetch user's completed submissions to find completed quizzes
            const { data: submissionsData } = await supabase
                .from('submissions')
                .select('quiz_sessions(quiz_id)')
                .eq('student_id', session.user.id);

            if (submissionsData) {
                const completed = new Set<string>();
                submissionsData.forEach((sub: any) => {
                    if (sub.quiz_sessions && sub.quiz_sessions.quiz_id) {
                        completed.add(sub.quiz_sessions.quiz_id);
                    }
                });
                setCompletedQuizIds(completed);
            }

            setLoading(false);
        }

        checkAuth();
    }, [router]);

    const handleJoinSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (roomCode.length !== 6) {
            alert('Please enter a valid 6-digit room code');
            return;
        }
        const { data: sessionData, error } = await supabase
            .from('quiz_sessions')
            .select('id, quiz_id, status, quizzes(type, available_from, available_until)')
            .eq('room_code', roomCode)
            .single();

        if (error || !sessionData) {
            alert('Invalid or expired quiz code.');
            return;
        }

        const quiz = Array.isArray(sessionData.quizzes) ? sessionData.quizzes[0] : sessionData.quizzes;
        if (quiz?.type === 'static') {
            const now = Date.now();
            if (quiz.available_from && now < new Date(quiz.available_from).getTime()) {
                alert(`This quiz opens at ${new Date(quiz.available_from).toLocaleString()}.`);
                return;
            }
            if (quiz.available_until && now >= new Date(quiz.available_until).getTime()) {
                alert('This quiz is closed and can no longer be attempted.');
                return;
            }
            router.push(`/quiz/static/${sessionData.quiz_id}?session=${sessionData.id}`);
            return;
        }

        router.push(`/quiz/live/student/${roomCode}`);
    };

    const handleSignOut = async () => {
        setCachedProfile(null);
        await supabase.auth.signOut();
        router.push('/auth');
    };

    return (
        <div className="min-h-screen bg-[#fff5f0] text-foreground font-mono relative flex flex-col selection:bg-[#E86F47] selection:text-white pb-12">
            {/* Live Circuit & Floating Shapes Wallpaper */}
            <DashboardBackground />

            {/* Shared Top Navigation */}
            <DashboardNavbar
                role="student"
                userName={userName}
                onSignOut={handleSignOut}
            />

            {/* Main Content Area */}
            {loading && staticQuizzes.length === 0 ? (
                <DashboardLoading />
            ) : (
                <main className="max-w-6xl w-full mx-auto p-6 mt-4 relative z-10">
                <div className="bg-brand-lightest p-8 rounded-[2rem] border border-brand-light shadow-sm text-center max-w-2xl mx-auto mb-12">
                    <div className="inline-flex p-4 bg-brand-light text-brand rounded-full mb-4">
                        <Hash className="w-8 h-8" />
                    </div>
                    <h2 className="text-4xl font-bold font-mono tracking-tighter text-black mb-2">Join Your Quiz</h2>
                    <p className="text-gray-600 font-mono mb-6">
                        Enter the 6-digit room code.
                    </p>

                    <form onSubmit={handleJoinSession} className="space-y-4">
                        <input
                            type="text"
                            maxLength={6}
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            placeholder="e.g. 849201"
                            className="w-full px-6 py-4 text-center text-3xl font-mono tracking-widest border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none uppercase bg-white text-[#1c1917] font-bold placeholder:text-[#8c827a] placeholder:font-normal"
                        />
                        <button
                            type="submit"
                            className="w-full py-4 bg-brand hover:bg-[#c47155] text-black font-mono font-bold text-xl rounded-xl flex items-center justify-center transition shadow-sm"
                        >
                            <Play className="w-6 h-6 mr-2" />
                            Enter Quiz Room
                        </button>
                    </form>
                </div>

                {/* Available Static Quizzes */}
                <div className="mt-12 space-y-6">
                    <h3 className="text-3xl font-bold font-mono tracking-tighter text-black mb-6">Quiz History</h3>
                    {staticQuizzes.length === 0 ? (
                        <div className="bg-white p-8 rounded-xl border-2 border-brand-light shadow-sm text-center">
                            <p className="text-gray-500 font-mono">No static quizzes available right now.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {staticQuizzes.map((quiz) => {
                                const isCompleted = completedQuizIds.has(quiz.id);
                                const isClosed = quiz.available_until && Date.now() >= new Date(quiz.available_until).getTime();
                                return (
                                    <div key={quiz.id} className="bg-white/85 backdrop-blur-md border border-brand-light/80 rounded-2xl shadow-xs hover:shadow-md hover:border-[#E86F47]/40 transition-all duration-200 block text-left overflow-hidden">
                                        <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-brand-lightest/30 gap-4">
                                            <div className="flex flex-col gap-2 min-w-0 flex-1">
                                                <h4 className="text-3xl font-normal font-mono text-black truncate" title={quiz.title}>{quiz.title}</h4>
                                                <div className="flex items-center space-x-4">
                                                    <span className="text-xs font-mono text-gray-600 font-bold">
                                                        {quiz.total_duration_minutes || 45} mins • Self-paced
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-4 sm:mt-0 flex gap-4 shrink-0">
                                                {isCompleted ? (
                                                    <button
                                                        onClick={() => router.push(`/quiz/static/${quiz.id}?review=1`)}
                                                        className="w-40 py-2 border-2 border-brand-light rounded-xl text-center font-mono font-bold text-brand hover:bg-brand-light transition"
                                                    >
                                                        Review Quiz
                                                    </button>
                                                ) : isClosed ? (
                                                    <div className="w-40 py-2 border-2 border-brand-light bg-brand-light rounded-xl text-center font-mono font-bold text-black opacity-70">
                                                        Closed
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => router.push(`/quiz/static/${quiz.id}`)}
                                                        className="w-40 py-2 border-2 border-brand-light bg-brand rounded-xl text-center font-mono font-bold text-black hover:bg-[#c47155] transition"
                                                    >
                                                        Take Quiz
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
            )}
        </div>
    );
}