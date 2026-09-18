'use client';
import QuizCreator from '@/components/QuizCreator';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { BookOpen, LogOut, Home, FilePlus2, BarChart3 } from 'lucide-react';

export default function TeacherDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userId, setUserId] = useState('');
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const [activeTab, setActiveTab] = useState<'active'|'completed'>('active');
    const router = useRouter();

    const fetchQuizzes = async (uId: string) => {
        const { data } = await supabase
            .from('quizzes')
            .select('*')
            .eq('teacher_id', uId)
            .order('created_at', { ascending: false });
        
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
                    console.error(`Failed to generate code for static quiz ${quiz.id}`, error);
                }

                return {
                    ...quiz,
                    liveStatus: completedIds.has(quiz.id) ? 'completed' : undefined,
                    roomCode: createdSession?.room_code,
                };
            }));

            setQuizzes(quizzesWithCodes);
        }
    };

    useEffect(() => {
        const clock = window.setInterval(() => setCurrentTime(Date.now()), 30000);
        return () => window.clearInterval(clock);
    }, []);

    useEffect(() => {
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
            await fetchQuizzes(session.user.id);
            setLoading(false);
        }

        checkAuth();
    }, [router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    const handleSelectQuiz = (quiz: any) => {
        if (quiz.type === 'competitive') {
            router.push(`/quiz/live/host/${quiz.id}`);
        } else {
            router.push(`/dashboard/teacher/quiz/${quiz.id}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 font-medium animate-pulse">Verifying teacher authorization...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg pb-12">
            {/* Top Navigation */}
            <nav className="border-b border-brand-light px-12 py-6 flex justify-between items-center sticky top-0 z-10 bg-bg">
                <div className="flex flex-col items-start gap-1">
                    <span className="text-4xl font-black text-brand tracking-tighter">quizeee</span>
                    <span className="bg-brand-light text-black text-xs px-3 py-1 rounded-full font-medium tracking-wide">
                        Teachers Hub
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => router.push('/dashboard/teacher')}
                        className="rounded-full bg-brand-light px-6 py-2.5 text-sm font-medium text-black transition"
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/teacher/analytics')}
                        className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        Analytics
                    </button>
                    <div className="flex items-center gap-2 ml-4">
                        <span className="text-black font-bold text-sm">{userName || 'Name'}</span>
                        <button
                            onClick={handleSignOut}
                            className="ml-2 flex items-center text-sm text-gray-500 hover:text-red-600 transition"
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="max-w-6xl mx-auto p-6 space-y-8 mt-4">
                {/* Quiz Creator Component */}
                <QuizCreator teacherId={userId} onComplete={() => fetchQuizzes(userId)} />

                {/* My Quizzes Section */}
                <div className="space-y-6">
                    {/* Tabs */}
                    <div className="flex border-2 border-brand-light rounded-xl overflow-hidden bg-white max-w-2xl mx-auto mb-8">
                        <button 
                            className={`flex-1 py-4 text-xl font-mono transition ${activeTab === 'active' ? 'bg-brand text-black font-bold' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setActiveTab('active')}
                        >
                            Active
                        </button>
                        <div className="w-0.5 bg-brand-light"></div>
                        <button 
                            className={`flex-1 py-4 text-xl font-mono transition ${activeTab === 'completed' ? 'bg-brand text-black font-bold' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => setActiveTab('completed')}
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
                                    <div key={quiz.id} className="bg-transparent border-b border-brand-light border-dashed transition-all duration-200">
                                        <div 
                                            className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-brand-lightest/50 rounded-xl gap-4"
                                            onClick={() => handleSelectQuiz(quiz)}
                                        >
                                            <div className="flex flex-col gap-2 min-w-0 flex-1">
                                                <h3 className="text-3xl font-normal font-mono text-black truncate" title={quiz.title}>{quiz.title}</h3>
                                                <div className="flex items-center space-x-4">
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
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}