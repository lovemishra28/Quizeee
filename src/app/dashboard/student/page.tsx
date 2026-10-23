'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Play, Hash, Clock, CheckCircle, Award } from 'lucide-react';
import DashboardNavbar from '@/components/DashboardNavbar';
import DashboardBackground from '@/components/DashboardBackground';
import DashboardLoading from '@/components/DashboardLoading';
import { getCachedProfile, setCachedProfile, markClientHydrated, getCachedProfileDirect } from '@/lib/authCache';

interface StudentQuizHistoryItem {
    sessionId: string;
    quizId: string;
    roomCode: string;
    title: string;
    type: 'static' | 'competitive';
    totalQuestions: number;
    correctCount: number;
    totalScore: number;
    accuracy: number;
    submittedAt: string;
    durationMinutes?: number | null;
}

export default function StudentDashboard() {
    const cached = getCachedProfile();
    const [loading, setLoading] = useState(!cached);
    const [userName, setUserName] = useState(cached?.full_name || '');
    const [userId, setUserId] = useState(cached?.id || '');
    const [roomCode, setRoomCode] = useState('');
    const [quizHistory, setQuizHistory] = useState<StudentQuizHistoryItem[]>([]);
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

            // Fetch ONLY this student's submissions and their associated quiz sessions
            const { data: studentSubmissions, error: historyError } = await supabase
                .from('submissions')
                .select(`
                    id,
                    session_id,
                    question_id,
                    score_awarded,
                    is_correct,
                    submitted_at,
                    quiz_sessions (
                        id,
                        room_code,
                        status,
                        quizzes (
                            id,
                            title,
                            type,
                            total_duration_minutes,
                            per_question_timer
                        )
                    )
                `)
                .eq('student_id', session.user.id)
                .order('submitted_at', { ascending: false });

            if (historyError) {
                console.error('Error fetching student quiz history:', historyError);
                setQuizHistory([]);
            } else if (studentSubmissions) {
                const historyMap = new Map<string, StudentQuizHistoryItem>();

                studentSubmissions.forEach((sub: any) => {
                    const sess = sub.quiz_sessions;
                    const quiz = Array.isArray(sess?.quizzes) ? sess.quizzes[0] : sess?.quizzes;
                    if (!sess || !quiz) return;

                    const sessionId = sess.id;
                    const isCorrect = sub.is_correct === true;
                    const score = sub.score_awarded || 0;
                    const subDate = sub.submitted_at || '';

                    const existing = historyMap.get(sessionId);
                    if (!existing) {
                        historyMap.set(sessionId, {
                            sessionId: sess.id,
                            quizId: quiz.id,
                            roomCode: sess.room_code || '',
                            title: quiz.title || 'Untitled Quiz',
                            type: (quiz.type as 'static' | 'competitive') || 'static',
                            totalQuestions: 1,
                            correctCount: isCorrect ? 1 : 0,
                            totalScore: score,
                            accuracy: 0,
                            submittedAt: subDate,
                            durationMinutes: quiz.total_duration_minutes || quiz.per_question_timer,
                        });
                    } else {
                        existing.totalQuestions += 1;
                        if (isCorrect) existing.correctCount += 1;
                        existing.totalScore += score;
                        if (!existing.submittedAt || (subDate && new Date(subDate) > new Date(existing.submittedAt))) {
                            existing.submittedAt = subDate;
                        }
                    }
                });

                const historyItems = Array.from(historyMap.values()).map((item) => ({
                    ...item,
                    accuracy: item.totalQuestions > 0 ? Math.round((item.correctCount / item.totalQuestions) * 100) : 0,
                }));

                setQuizHistory(historyItems);
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
            {loading ? (
                <DashboardLoading />
            ) : (
                <main className="max-w-6xl w-full mx-auto p-6 mt-4 relative z-10">
                    <div className="bg-brand-lightest p-8 rounded-[2rem] border border-brand-light shadow-sm text-center max-w-2xl mx-auto mb-12">
                        <div className="inline-flex p-4 bg-brand-light text-brand rounded-full mb-4">
                            <Hash className="w-8 h-8" />
                        </div>
                        <h2 className="text-4xl font-bold font-mono tracking-tighter text-black mb-2">Join Your Quiz</h2>
                        <p className="text-gray-600 font-mono mb-6">
                            Enter the 6-digit room code provided by your teacher.
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
                                className="w-full py-4 bg-brand hover:bg-[#c47155] text-black font-mono font-bold text-xl rounded-xl flex items-center justify-center transition shadow-sm cursor-pointer"
                            >
                                <Play className="w-6 h-6 mr-2" />
                                Enter Quiz Room
                            </button>
                        </form>
                    </div>

                    {/* Student Personal Quiz History */}
                    <div className="mt-12 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-3xl font-bold font-mono tracking-tighter text-black">Quiz History</h3>
                                <p className="text-gray-600 font-mono text-sm mt-0.5">Your personal record of completed quizzes and results.</p>
                            </div>
                            {quizHistory.length > 0 && (
                                <span className="px-3.5 py-1 rounded-full bg-brand-light text-brand font-mono font-bold text-xs border border-brand-light/70 self-start sm:self-auto">
                                    {quizHistory.length} {quizHistory.length === 1 ? 'Quiz' : 'Quizzes'} Completed
                                </span>
                            )}
                        </div>

                        {quizHistory.length === 0 ? (
                            <div className="bg-white/85 backdrop-blur-md p-10 rounded-2xl border-2 border-brand-light shadow-xs text-center max-w-xl mx-auto">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#faebe3] flex items-center justify-center text-[#E86F47]">
                                    <Clock className="w-7 h-7" />
                                </div>
                                <h4 className="text-2xl font-bold font-mono text-black mb-2">No Quiz History Yet</h4>
                                <p className="text-gray-600 font-mono text-sm leading-relaxed max-w-md mx-auto">
                                    You haven&apos;t taken any quizzes yet. Enter a 6-digit room code above from your teacher to join your first quiz!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {quizHistory.map((item) => {
                                    const formattedDate = item.submittedAt
                                        ? new Date(item.submittedAt).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric',
                                          })
                                        : 'Completed';

                                    return (
                                        <div
                                            key={item.sessionId}
                                            className="bg-white/90 backdrop-blur-md border border-brand-light/80 rounded-2xl shadow-xs hover:shadow-md hover:border-[#E86F47]/40 transition-all duration-200 overflow-hidden"
                                        >
                                            <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div className="flex flex-col gap-2 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                        <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                                                            item.type === 'static'
                                                                ? 'bg-[#faebe3] text-[#E86F47] border border-[#f5c4b5]'
                                                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        }`}>
                                                            {item.type === 'static' ? 'Self-Paced' : 'Live Competitive'}
                                                        </span>
                                                        {item.roomCode && (
                                                            <span className="text-xs font-mono text-gray-500">
                                                                Code: <span className="font-bold text-black">{item.roomCode}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <h4 className="text-2xl font-bold font-mono text-black truncate" title={item.title}>
                                                        {item.title}
                                                    </h4>

                                                    <div className="flex items-center gap-4 text-xs font-mono text-gray-600 flex-wrap">
                                                        <span>Date: <span className="font-bold text-black">{formattedDate}</span></span>
                                                        <span>•</span>
                                                        <span>Score: <span className="font-black text-[#E86F47]">{item.totalScore} pts</span></span>
                                                        <span>•</span>
                                                        <span>
                                                            Accuracy: <span className="font-black text-black">{item.correctCount} / {item.totalQuestions} ({item.accuracy}%)</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 sm:mt-0 flex gap-3 shrink-0 items-center">
                                                    {item.type === 'static' ? (
                                                        <button
                                                            onClick={() => router.push(`/quiz/static/${item.quizId}?session=${item.sessionId}&review=1`)}
                                                            className="px-6 py-2.5 border-2 border-brand-light bg-white rounded-xl text-center font-mono font-bold text-brand hover:bg-brand-light transition shadow-2xs cursor-pointer"
                                                        >
                                                            Review Answers
                                                        </button>
                                                    ) : (
                                                        <div className="px-5 py-2.5 border-2 border-green-200 bg-green-50 rounded-xl text-center font-mono font-bold text-green-700 text-sm flex items-center gap-1.5">
                                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                                            Completed
                                                        </div>
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