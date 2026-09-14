'use client';
import QuizCreator from '@/components/QuizCreator';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { BookOpen, LogOut } from 'lucide-react';

export default function TeacherDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userId, setUserId] = useState('');
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [currentTime, setCurrentTime] = useState(() => Date.now());

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
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Top Navigation */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    <span className="text-2xl font-black text-indigo-600">Quizeee</span>
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                        Teacher Hub
                    </span>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-gray-700 font-medium">{userName}</span>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center text-sm text-gray-500 hover:text-red-600 transition"
                    >
                        <LogOut className="w-4 h-4 mr-1" />
                        Sign Out
                    </button>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="max-w-6xl mx-auto p-6 space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {userName}!</h1>
                        <p className="text-gray-500 mt-1">Manage study materials, quizzes, and monitor student progress.</p>
                    </div>
                </div>

                {/* Quiz Creator Component */}
                <QuizCreator teacherId={userId} onComplete={() => fetchQuizzes(userId)} />

                {/* My Quizzes Section */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                        <BookOpen className="w-6 h-6 mr-2 text-indigo-600" />
                        My Created Quizzes
                    </h2>

                    {quizzes.length === 0 ? (
                        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center">
                            <p className="text-gray-500">You haven't created any quizzes yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {quizzes.map((quiz) => {
                                const hasEnded = quiz.type === 'static' &&
                                    quiz.available_until &&
                                    currentTime >= new Date(quiz.available_until).getTime();
                                const isCompleted = quiz.liveStatus === 'completed' || hasEnded;
                                return (
                                    <div key={quiz.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200">
                                        <div 
                                            className="p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                                            onClick={() => handleSelectQuiz(quiz)}
                                        >
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900">{quiz.title}</h3>
                                                <div className="flex items-center space-x-3 mt-2">
                                                    <span className={`text-xs px-2 py-1 rounded-md font-semibold uppercase ${quiz.type === 'static' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {quiz.type || 'unknown'}
                                                    </span>
                                                    <span className="text-sm text-gray-500">
                                                        Created on {new Date(quiz.created_at).toLocaleDateString()}
                                                    </span>
                                                    {quiz.type === 'static' && quiz.available_from && quiz.available_until && (
                                                        <span className="text-sm text-gray-500">
                                                            Available {new Date(quiz.available_from).toLocaleString()} - {new Date(quiz.available_until).toLocaleString()}
                                                        </span>
                                                    )}
                                                    {isCompleted && (
                                                        <span className="text-sm font-semibold text-green-700">Completed</span>
                                                    )}
                                                    {quiz.type === 'static' && quiz.roomCode && !isCompleted && (
                                                        <span className="text-sm font-semibold text-indigo-700">
                                                            Access code: <span className="font-mono tracking-widest">{quiz.roomCode}</span>
                                                        </span>
                                                    )}
                                                </div>
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