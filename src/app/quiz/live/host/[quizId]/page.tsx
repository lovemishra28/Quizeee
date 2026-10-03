'use client';

import { useEffect, useState, use, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Play, Clock, Trophy, ArrowLeft, Zap } from 'lucide-react';
import DashboardBackground from '@/components/DashboardBackground';

type Quiz = {
    title: string;
    per_question_timer?: number;
};

type Question = {
    id: string;
    question_text: string;
    options: string[];
};

type LeaderboardEntry = {
    studentId: string;
    name: string;
    score: number;
    correctAnswers: number;
    totalResponseTime: number;
};

type QuizSession = {
    id: string;
    room_code: string;
    status: 'waiting' | 'active' | 'leaderboard' | 'finished' | 'completed';
    current_question_index: number;
};

// Module-level lock map to guarantee that rapid mounts or React StrictMode cannot create duplicate sessions
const liveSessionInitMap = new Map<string, Promise<{ foundSession: any; quizData: any } | null>>();

export default function HostLobbyPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const isInstant = searchParams.get('instant') === 'true';

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [session, setSession] = useState<QuizSession | null>(null);
    const [joinedStudents, setJoinedStudents] = useState<number>(0);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [timeLeft, setTimeLeft] = useState(30);
    const [phase, setPhase] = useState<'active' | 'leaderboard' | 'finished'>('active');
    const [readOnlyResults, setReadOnlyResults] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const questionEndTimeRef = useRef<number>(0);

    useEffect(() => {
        let isCancelled = false;
        let channel: RealtimeChannel | undefined;

        async function initializeLiveSession() {
            let sessionResult: { foundSession: any; quizData: any } | null = null;

            if (liveSessionInitMap.has(quizId)) {
                try {
                    sessionResult = await liveSessionInitMap.get(quizId)!;
                } catch (e) {
                    console.error('Error awaiting existing live session initialization:', e);
                }
            } else {
                const initPromise = (async () => {
                    // Check if host is signed in; if not (instant/guest host), sign in to bypass RLS
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                        await supabase.auth.signInWithPassword({
                            email: 'instanthost@quizeee.app',
                            password: 'InstantHostPassword123!@#',
                        });
                    }

                    // 1. Fetch the quiz metadata
                    const { data: quizData, error: quizError } = await supabase
                        .from('quizzes')
                        .select('*')
                        .eq('id', quizId)
                        .single();

                    if (quizError || !quizData) {
                        alert('Quiz not found.');
                        router.push(isInstant ? '/' : '/dashboard/teacher');
                        return null;
                    }

                    // Fetch questions
                    const { data: questionsData } = await supabase
                        .from('questions')
                        .select('*')
                        .eq('quiz_id', quizId)
                        .order('order_index', { ascending: true });

                    // Reuse an existing session if present
                    const { data: existingSessions, error: existingSessionError } = await supabase
                        .from('quiz_sessions')
                        .select('*')
                        .eq('quiz_id', quizId)
                        .in('status', ['waiting', 'active', 'leaderboard', 'finished', 'completed'])
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (existingSessionError) {
                        console.error('Failed to find an existing live session', existingSessionError);
                        alert('Unable to load the live quiz. Please try again.');
                        router.push(isInstant ? '/' : '/dashboard/teacher');
                        return null;
                    }

                    let foundSession = existingSessions?.[0];
                    if (!foundSession) {
                        const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
                        const { data: createdSession, error: sessionError } = await supabase
                            .from('quiz_sessions')
                            .insert({
                                quiz_id: quizId,
                                room_code: roomCode,
                                status: 'waiting',
                                current_question_index: -1,
                            })
                            .select()
                            .single();

                        if (sessionError) {
                            console.error('Failed to create session', sessionError);
                            alert('Unable to start a live quiz. Please try again.');
                            router.push(isInstant ? '/' : '/dashboard/teacher');
                            return null;
                        }
                        foundSession = createdSession;
                    }

                    return { foundSession, quizData, questionsData: questionsData || [] };
                })();

                liveSessionInitMap.set(quizId, initPromise as any);
                try {
                    sessionResult = await initPromise;
                } finally {
                    setTimeout(() => {
                        liveSessionInitMap.delete(quizId);
                    }, 1000);
                }
            }

            if (isCancelled || !sessionResult?.foundSession) return;

            const sessionData = sessionResult.foundSession;
            const quizData = sessionResult.quizData;
            const questionsData = (sessionResult as any).questionsData;

            if (quizData) setQuiz(quizData);
            if (questionsData) setQuestions(questionsData);
            setSession(sessionData);
            setCurrentQuestionIndex(sessionData.current_question_index);
            let restoredTimeExpired = false;
            if (sessionData.current_question_index >= 0) {
                const duration = quizData.per_question_timer || 30;
                const questionKey = `live-quiz-${sessionData.id}-question-${sessionData.current_question_index}-end`;
                const storedEndTime = window.localStorage.getItem(questionKey);
                let endTime = storedEndTime ? Number(storedEndTime) : 0;
                if (!endTime || isNaN(endTime)) {
                    endTime = Date.now() + duration * 1000;
                    window.localStorage.setItem(questionKey, String(endTime));
                }
                questionEndTimeRef.current = endTime;
                const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
                setTimeLeft(remaining);
                restoredTimeExpired = remaining === 0;
            }
            const restoredPhase = restoredTimeExpired && sessionData.status === 'active'
                ? 'leaderboard'
                : sessionData.status === 'finished' || sessionData.status === 'completed'
                    ? 'finished'
                    : sessionData.status === 'leaderboard'
                        ? 'leaderboard'
                        : 'active';
            setPhase(restoredPhase);
            setReadOnlyResults(sessionData.status === 'completed');
            setLoading(false);

            // Initialize Supabase Realtime Subscription
            const channelName = `room-${sessionData.room_code}`;
            const existingChannel = supabase.getChannels().find((item) => item.topic === `realtime:${channelName}`);
            if (existingChannel) {
                await supabase.removeChannel(existingChannel);
            }

            const roomChannel = supabase.channel(channelName, {
                config: { presence: { key: 'host' } },
            });
            roomChannel.on('presence', { event: 'sync' }, () => {
                const presenceState = roomChannel.presenceState();
                setJoinedStudents(Object.keys(presenceState).filter((key) => key !== 'host').length);
            });
            channel = roomChannel;
            channelRef.current = roomChannel;
            roomChannel.subscribe();
        }

        initializeLiveSession();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [quizId, router]);

    useEffect(() => {
        if (!session || currentQuestionIndex < 0) return;

        const submissionsChannel = supabase
            .channel(`submissions-${session.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'submissions',
                    filter: `session_id=eq.${session.id}`,
                },
                () => {
                    // Automatically re-query leaderboard when a new submission arrives
                    if (phase === 'leaderboard' || phase === 'finished') {
                        void loadLeaderboard();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(submissionsChannel);
        };
    }, [session, currentQuestionIndex, phase]);

    // Synchronized countdown timer based on target end timestamp
    useEffect(() => {
        if (currentQuestionIndex < 0 || readOnlyResults || phase !== 'active') return;

        const checkTime = () => {
            const targetEnd = questionEndTimeRef.current;
            if (!targetEnd) return;

            const remaining = Math.max(0, Math.ceil((targetEnd - Date.now()) / 1000));
            setTimeLeft(remaining);

            if (remaining <= 0) {
                setPhase('leaderboard');
            }
        };

        checkTime();
        const timer = window.setInterval(checkTime, 250);
        return () => window.clearInterval(timer);
    }, [currentQuestionIndex, phase, readOnlyResults]);

    const loadLeaderboard = async () => {
        if (!session) return;

        const { data, error } = await supabase
            .from('submissions')
            .select('student_id, score_awarded, is_correct, response_time_ms, profiles(full_name)')
            .eq('session_id', session.id);

        if (error) {
            console.error('Failed to load leaderboard', error);
            return;
        }

        const totals = new Map<string, LeaderboardEntry>();
        (data || []).forEach((submission) => {
            const existing = totals.get(submission.student_id);
            const profile = Array.isArray(submission.profiles) ? submission.profiles[0] : submission.profiles;
            totals.set(submission.student_id, {
                studentId: submission.student_id,
                name: existing?.name || profile?.full_name || 'Student',
                score: (existing?.score || 0) + (submission.is_correct ? Math.max(0, submission.score_awarded || 0) : 0),
                correctAnswers: (existing?.correctAnswers || 0) + (submission.is_correct ? 1 : 0),
                totalResponseTime: (existing?.totalResponseTime || 0) + (submission.response_time_ms || 0),
            });
        });

        const entries = Array.from(totals.values()).sort((a, b) =>
            b.correctAnswers - a.correctAnswers ||
            b.score - a.score ||
            a.totalResponseTime - b.totalResponseTime
        );
        setLeaderboard(entries);
        const isFinal = currentQuestionIndex >= questions.length - 1;
        if (!readOnlyResults) {
            await channelRef.current?.send({ type: 'broadcast', event: 'leaderboard-updated', payload: { entries, isFinal } });
        }
        if (isFinal && session.status !== 'completed' && !readOnlyResults) {
            setPhase('finished');
            await supabase.from('quiz_sessions').update({ status: 'finished' }).eq('id', session.id);
        }
    };

    useEffect(() => {
        if (phase !== 'leaderboard' && phase !== 'finished') return;
        const load = window.setTimeout(() => void loadLeaderboard(), 0);
        return () => window.clearTimeout(load);
    }, [phase]);

    useEffect(() => {
        if (phase !== 'finished' || !session || readOnlyResults) return;

        const closeTimer = window.setTimeout(async () => {
            const { error } = await supabase
                .from('quiz_sessions')
                .update({ status: 'completed' })
                .eq('id', session.id);
            if (error) {
                console.error('Failed to complete live session', error);
            }
        }, 10000);

        return () => window.clearTimeout(closeTimer);
    }, [phase, session, readOnlyResults, router]);

    const handleNextQuestion = async () => {
        if (!session || readOnlyResults || phase === 'finished') return;

        const nextIndex = currentQuestionIndex + 1;
        const duration = quiz?.per_question_timer || 30;
        const now = Date.now();
        const endTime = now + duration * 1000;
        questionEndTimeRef.current = endTime;

        window.localStorage.setItem(
            `live-quiz-${session.id}-question-${nextIndex}-end`,
            String(endTime)
        );

        // 1. Immediately update UI locally so teacher has zero lag
        setCurrentQuestionIndex(nextIndex);
        setTimeLeft(duration);
        setPhase('active');

        // 2. Broadcast and update database concurrently
        await Promise.all([
            supabase
                .from('quiz_sessions')
                .update({
                    status: 'active',
                    current_question_index: nextIndex
                })
                .eq('id', session.id),
            channelRef.current?.send({
                type: 'broadcast',
                event: 'question-started',
                payload: { quizId, index: nextIndex, duration, endTime },
            })
        ]);
    };

    const handleStartGame = () => {
        if (!session) return;
        handleNextQuestion();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fff5f0] relative overflow-hidden">
                <DashboardBackground />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin" />
                    <p className="mt-4 font-mono font-bold text-[#8c827a] text-sm animate-pulse">Initializing quiz lobby...</p>
                </div>
            </div>
        );
    }

    if (!quiz || !session) {
        return null;
    }

    const currentQuestion = questions[currentQuestionIndex];
    const sortedLeaderboard = leaderboard;

    if (currentQuestionIndex >= 0) {
        return (
            <div className="min-h-screen bg-[#fff5f0] text-[#1c1917] p-6 relative overflow-x-hidden">
                <DashboardBackground />
                <div className="relative z-10 max-w-6xl mx-auto">
                    {/* Top Bar with Live Quiz Title and Synchronized Clock */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                        <div>
                            <p className="text-brand font-black font-mono uppercase tracking-widest text-sm mb-1">Live quiz</p>
                            <h1 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-black">{quiz.title}</h1>
                        </div>
                        <div className={`flex items-center gap-2.5 text-2xl font-black font-mono px-6 py-3 rounded-2xl border-2 shadow-sm backdrop-blur-md transition-all ${timeLeft < 10 ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white/85 border-brand-light text-black'
                            }`}>
                            <Clock className="w-7 h-7 text-brand" />
                            <span>{timeLeft}s</span>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                        <main className="backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-8 sm:p-10 shadow-lg">
                            {phase === 'leaderboard' || phase === 'finished' ? (
                                <>
                                    {phase === 'finished' && sortedLeaderboard[0] ? (
                                        <div className="text-center mb-8 bg-brand-lightest/90 border-2 border-brand-light rounded-[2rem] p-8 shadow-sm animate-bounce">
                                            <Trophy className="w-20 h-20 text-brand mx-auto mb-3" />
                                            <p className="text-brand uppercase tracking-widest font-black font-mono text-base">Winner</p>
                                            <h2 className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-black mt-1">{sortedLeaderboard[0].name}</h2>
                                            <p className="text-[#8c827a] font-mono font-bold text-lg mt-2">{sortedLeaderboard[0].correctAnswers} correct answers • {sortedLeaderboard[0].score} pts</p>
                                        </div>
                                    ) : (
                                        <h2 className="text-3xl font-black font-mono tracking-tight text-black mb-6">Leaderboard</h2>
                                    )}
                                    <ol className="space-y-3 font-mono">
                                        {sortedLeaderboard.slice(phase === 'finished' ? 1 : 0).map((entry, index) => (
                                            <li key={entry.studentId} className="flex justify-between items-center rounded-2xl bg-white/95 border-2 border-brand-light p-5 shadow-sm">
                                                <span className="font-bold text-black text-lg">{index + (phase === 'finished' ? 2 : 1)}. {entry.name}</span>
                                                <strong className="text-brand font-black text-lg">{entry.correctAnswers} correct · {entry.score} pts</strong>
                                            </li>
                                        ))}
                                    </ol>
                                    <div className="flex items-center justify-center flex-wrap gap-4 mt-8 pt-4 border-t-2 border-brand-light/60">
                                        <button
                                            onClick={handleNextQuestion}
                                            disabled={phase === 'finished' || currentQuestionIndex >= questions.length - 1}
                                            className="px-8 py-4 bg-brand hover:bg-[#c47155] disabled:bg-brand-light disabled:text-gray-400 rounded-xl font-mono font-black text-black text-lg transition shadow-sm"
                                        >
                                            {currentQuestionIndex >= questions.length - 1 ? 'Quiz Complete' : 'Next Question'}
                                        </button>
                                        {phase === 'finished' && (
                                            <button
                                                onClick={() => router.push(isInstant ? '/' : '/dashboard/teacher')}
                                                className="px-8 py-4 bg-white hover:bg-brand-lightest border-2 border-brand-light text-black rounded-xl font-mono font-black text-lg transition shadow-sm cursor-pointer"
                                            >
                                                {isInstant ? 'Back to Home' : 'Return to dashboard'}
                                            </button>
                                        )}
                                    </div>
                                    {phase === 'finished' && isInstant && (
                                        <div className="mt-8 p-6 rounded-2xl bg-[#fbf5f0] border-2 border-brand-light text-center font-mono">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/20 text-black text-xs font-bold uppercase mb-2">
                                                <Zap className="w-3.5 h-3.5 text-brand" />
                                                <span>Instant Quiz Finished</span>
                                            </div>
                                            <h4 className="text-base font-black text-black">Want to save quizzes & track student analytics?</h4>
                                            <p className="text-xs text-[#5c544e] mt-1 max-w-md mx-auto">
                                                Create a free teacher account to save past quizzes, track performance over time, and assign static homework quizzes!
                                            </p>
                                            <button
                                                onClick={() => router.push('/auth?mode=signup&role=teacher')}
                                                className="mt-3 px-6 py-2.5 rounded-xl bg-black hover:bg-brand text-white text-xs font-bold transition shadow-xs cursor-pointer"
                                            >
                                                Create Teacher Account →
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : currentQuestion ? (
                                <>
                                    <p className="text-[#8c827a] font-mono font-bold text-base mb-2">
                                        Question {currentQuestionIndex + 1} of {questions.length}
                                    </p>
                                    <h2 className="text-2xl sm:text-3xl font-bold font-mono text-black leading-snug mb-8">
                                        {currentQuestion.question_text}
                                    </h2>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {currentQuestion.options.map((option, index) => (
                                            <div
                                                key={`${currentQuestion.id}-${index}`}
                                                className="backdrop-blur-md bg-brand-lightest/80 border-2 border-brand-light rounded-2xl p-6 text-lg sm:text-xl font-mono font-bold text-black shadow-sm flex items-center"
                                            >
                                                <span className="w-10 h-10 rounded-full bg-brand-light text-brand border-2 border-brand-light flex items-center justify-center font-black mr-4 text-lg shrink-0">
                                                    {String.fromCharCode(65 + index)}
                                                </span>
                                                <span className="leading-snug">{option}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-8 text-[#8c827a] font-mono font-bold text-sm">
                                        Leaderboard will appear when the timer ends.
                                    </p>
                                </>
                            ) : (
                                <p className="text-[#8c827a] font-mono font-bold">Loading question...</p>
                            )}
                        </main>

                        <aside className="backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-6 sm:p-8 shadow-lg h-fit">
                            <div className="flex items-center gap-2.5 mb-6">
                                <Trophy className="w-6 h-6 text-brand" />
                                <h2 className="text-2xl font-black font-mono tracking-tight text-black">Top 10</h2>
                            </div>
                            {sortedLeaderboard.length === 0 ? (
                                <p className="text-[#8c827a] font-mono font-bold text-base">No answers yet.</p>
                            ) : (
                                <ol className="space-y-3 font-mono">
                                    {sortedLeaderboard.slice(0, 10).map((entry, index) => (
                                        <li
                                            key={entry.studentId}
                                            className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-brand-lightest/70 border border-brand-light"
                                        >
                                            <span className="truncate text-black font-bold">
                                                {index + 1}. {entry.name}
                                            </span>
                                            <span className="font-black text-brand text-right shrink-0">
                                                {entry.correctAnswers} • {entry.score}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </aside>
                    </div>
                </div>
            </div>
        );
    }

    // Lobby / Waiting screen before quiz start
    return (
        <div className="min-h-screen bg-[#fff5f0] text-[#1c1917] flex flex-col items-center justify-center p-6 relative overflow-x-hidden">
            <DashboardBackground />
            <div className="relative z-10 max-w-3xl w-full text-center flex flex-col items-center">
                <button
                    onClick={() => router.push(isInstant ? '/' : '/dashboard/teacher')}
                    className="inline-flex items-center gap-2 text-sm font-bold font-mono text-[#E86F47] hover:text-black mb-6 px-4 py-2 rounded-full bg-white/85 border border-[#E86F47]/20 shadow-xs cursor-pointer self-start"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {isInstant ? 'Back to Home' : 'Back to Dashboard'}
                </button>

                {isInstant && (
                    <span className="px-3.5 py-1.5 rounded-xl bg-brand text-black font-mono font-bold text-xs uppercase tracking-wider shadow-2xs mb-3 inline-flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Instant Live Quiz (Temporary Session)</span>
                    </span>
                )}

                <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-black mb-3">
                    {quiz.title}
                </h1>
                <p className="text-[#8c827a] font-mono text-lg font-bold mb-10">
                    Join on your device using the code below
                </p>

                <div className="backdrop-blur-md bg-white/85 border-2 border-brand-light p-10 sm:p-14 rounded-[2.5rem] mb-10 shadow-lg">
                    <p className="text-[#8c827a] uppercase tracking-widest font-black font-mono mb-4 text-sm">
                        ROOM CODE
                    </p>
                    <div className="text-7xl sm:text-9xl font-black tracking-widest text-brand font-mono drop-shadow-sm select-all">
                        {session.room_code}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-md bg-white/85 p-6 sm:p-8 rounded-2xl border-2 border-brand-light shadow-md">
                    <div className="flex items-center space-x-4">
                        <div className="p-3.5 bg-brand-light text-brand rounded-2xl border border-brand-light">
                            <Users className="w-7 h-7" />
                        </div>
                        <div className="text-left font-mono">
                            <p className="text-sm text-[#8c827a] font-bold">Students Joined</p>
                            <p className="text-3xl font-black text-black">{joinedStudents}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleStartGame}
                        disabled={joinedStudents === 0}
                        className="w-full sm:w-auto px-10 py-5 bg-brand hover:bg-[#c47155] disabled:bg-brand-light disabled:text-gray-400 text-black font-black font-mono rounded-xl flex items-center justify-center transition text-xl shadow-md cursor-pointer disabled:cursor-not-allowed"
                    >
                        <Play className="w-6 h-6 mr-3 fill-current" />
                        Start Quiz
                    </button>
                </div>
            </div>
        </div>
    );
}