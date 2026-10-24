'use client';
import QuizCreator from '@/components/QuizCreator';
import DashboardNavbar from '@/components/DashboardNavbar';
import DashboardBackground from '@/components/DashboardBackground';
import DashboardLoading from '@/components/DashboardLoading';
import { getCachedProfile, setCachedProfile, markClientHydrated } from '@/lib/authCache';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import type { Quiz } from '@/lib/types';

export default function TeacherDashboard() {
    const cached = getCachedProfile();
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState(cached?.full_name || '');
    const [userId, setUserId] = useState(cached?.id || '');
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loadError, setLoadError] = useState('');
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const [activeTab, setActiveTab] = useState<'active'|'completed'>('active');
    const router = useRouter();

    const fetchQuizzes = useCallback(async (uId: string) => {
        setLoadError('');
        const { data, error: quizError } = await supabase
            .from('quizzes')
            .select('*')
            .eq('teacher_id', uId)
            .order('created_at', { ascending: false });
        
        if (quizError) { setLoadError('Unable to load your quizzes. Please try again.'); return; }
        if (data) {
            const competitiveQuizIds = data.filter((quiz) => quiz.type === 'competitive').map((quiz) => quiz.id);
            const { data: completedSessions } = competitiveQuizIds.length
                ? await supabase
                    .from('quiz_sessions')
                    .select('quiz_id, status')
                    .in('quiz_id', competitiveQuizIds)
                    .eq('status', 'completed')
                : { data: [] };
            const completedIds = new Set((completedSessions || []).map((session) => session.quiz_id));
            const staticQuizIds = data.filter((quiz) => quiz.type === 'static').map((quiz) => quiz.id);
            const { data: waitingSessions } = staticQuizIds.length
                ? await supabase
                    .from('quiz_sessions')
                    .select('id, quiz_id, room_code')
                    .in('quiz_id', staticQuizIds)
                    .eq('status', 'waiting')
                : { data: [] };

            const waitingCodeByQuizId = new Map(
                (waitingSessions || []).map((session) => [session.quiz_id, session.room_code])
            );

            const quizzesWithCodes = await Promise.all(data.map(async (quiz) => {
                if (quiz.type !== 'static' || waitingCodeByQuizId.has(quiz.id)) {
                    return {
                        ...quiz,
                        liveStatus: completedIds.has(quiz.id) ? 'completed' : undefined,
                        roomCode: waitingCodeByQuizId.get(quiz.id),
                    };
                }

                const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
                const { data: createdSession, error } = await supabase
                    .from('quiz_sessions')
                    .insert({
                        quiz_id: quiz.id,
                        room_code: roomCode,
                        status: 'waiting',
                        current_question_index: -1,
                    })
                    .select('room_code')
                    .single();

                if (error) {
                    console.error('Unable to generate a static quiz access code.');
                }

                return {
                    ...quiz,
                    liveStatus: completedIds.has(quiz.id) ? 'completed' : undefined,
                    roomCode: createdSession?.room_code,
                };
            }));

            setQuizzes(quizzesWithCodes as Quiz[]);
        }
    }, []);

    useEffect(() => {
        const clock = window.setInterval(() => setCurrentTime(Date.now()), 30000);
        return () => window.clearInterval(clock);
    }, []);

    useEffect(() => {
        markClientHydrated();

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

            if (!profile || profile.role !== 'teacher') {
                router.push('/dashboard/student');
                return;
            }

            setUserName(profile.full_name);
            setUserId(session.user.id);
            setCachedProfile({
                id: session.user.id,
                full_name: profile.full_name,
                role: profile.role,
            });
            await fetchQuizzes(session.user.id);
            setLoading(false);
        }

        void checkAuth().catch(() => { setLoadError('Unable to load your dashboard. Please try again.'); setLoading(false); });
    }, [router, fetchQuizzes]);

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
                role="teacher"
                userName={userName}
                onSignOut={handleSignOut}
                activeTab="dashboard"
            />

            {/* Main Content Area */}
            {loading && quizzes.length === 0 ? (
                <DashboardLoading />
            ) : (
                <main id="main-content" className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-8 mt-4 relative z-10">
                <h1 className="sr-only">Teacher dashboard</h1>
                {loadError && <p role="alert" className="rounded-xl p-4 bg-red-50 text-red-700">{loadError} <button onClick={() => { void fetchQuizzes(userId); }} className="underline font-bold">Retry</button></p>}
                {/* Quiz Creator Component */}
                <QuizCreator teacherId={userId} onComplete={() => fetchQuizzes(userId)} />

                {/* My Quizzes Section */}
                <div className="space-y-6">
                    <h2 className="sr-only">My quizzes</h2>
                    {/* Tabs */}
                    <div role="group" aria-label="Quiz status filters" className="flex border-2 border-brand-light rounded-xl overflow-hidden bg-white max-w-2xl mx-auto mb-8">
                        <button 
                            className={`flex-1 py-4 text-xl font-mono transition ${activeTab === 'active' ? 'bg-brand text-black font-bold' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setActiveTab('active')}
                            aria-pressed={activeTab === 'active'}
                        >
                            Active
                        </button>
                        <div className="w-0.5 bg-brand-light"></div>
                        <button 
                            className={`flex-1 py-4 text-xl font-mono transition ${activeTab === 'completed' ? 'bg-brand text-black font-bold' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setActiveTab('completed')}
                            aria-pressed={activeTab === 'completed'}
                        >
                            Completed
                        </button>
                    </div>

                    {quizzes.filter((quiz) => {
                        const hasEnded = quiz.type === 'static' && quiz.available_until && currentTime >= new Date(quiz.available_until).getTime();
                        const isCompleted = quiz.liveStatus === 'completed' || hasEnded;
                        return activeTab === 'completed' ? isCompleted : !isCompleted;
                    }).length === 0 ? (
                        <div className="bg-white p-8 rounded-xl border border-brand-light shadow-sm text-center">
                            <p className="text-gray-500 font-mono">No {activeTab} quizzes found.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {quizzes.filter((quiz) => {
                                const hasEnded = quiz.type === 'static' && quiz.available_until && currentTime >= new Date(quiz.available_until).getTime();
                                const isCompleted = quiz.liveStatus === 'completed' || hasEnded;
                                return activeTab === 'completed' ? isCompleted : !isCompleted;
                            }).map((quiz) => {
                                return (
                                    <div key={quiz.id} className="bg-white/85 backdrop-blur-md border border-brand-light/80 rounded-2xl shadow-xs hover:shadow-md hover:border-[#E86F47]/40 transition-all duration-200 overflow-hidden">
                                        <Link
                                            href={quiz.type === 'competitive' ? `/quiz/live/host/${quiz.id}` : `/dashboard/teacher/quiz/${quiz.id}`}
                                            className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-brand-lightest/30 gap-4"
                                        >
                                            <div className="flex flex-col gap-2 min-w-0 w-full sm:w-auto flex-1">
                                                <h3 className="text-3xl font-normal font-mono text-black truncate" title={quiz.title}>{quiz.title}</h3>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                    <span className="text-xs font-mono text-gray-600 font-bold">
                                                        Created on : {new Date(quiz.created_at).toLocaleDateString()}
                                                    </span>
                                                    {quiz.type === 'static' && quiz.available_from && quiz.available_until && (
                                                        <span className="text-xs font-mono text-gray-600 font-bold">
                                                            Available: {new Date(quiz.available_from).toLocaleDateString()} - {new Date(quiz.available_until).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    {quiz.type === 'static' && quiz.roomCode && activeTab === 'active' && (
                                                        <span className="text-xs font-mono font-bold text-brand">
                                                            Access code: {quiz.roomCode}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-4 sm:mt-0 w-40 py-2 border-2 border-brand-light rounded-xl text-center shrink-0">
                                                <span className={`text-xl font-mono font-bold text-brand`}>
                                                    {quiz.type === 'static' ? 'Static' : 'Competitive'}
                                                </span>
                                            </div>
                                        </Link>
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
