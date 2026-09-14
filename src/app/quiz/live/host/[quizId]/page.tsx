'use client';

import { useEffect, useState, use, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Users, Play, Loader2, Clock, Trophy } from 'lucide-react';

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

export default function HostLobbyPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [session, setSession] = useState<QuizSession | null>(null);
    const [joinedStudents, setJoinedStudents] = useState<number>(0);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [timeLeft, setTimeLeft] = useState(30); // 30 seconds per question
    const [phase, setPhase] = useState<'active' | 'leaderboard' | 'finished'>('active');
    const [readOnlyResults, setReadOnlyResults] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        let channel: RealtimeChannel | undefined;

        async function initializeLiveSession() {
            // 1. Fetch the quiz metadata
            const { data: quizData, error: quizError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();

            if (quizError || !quizData) {
                alert('Quiz not found.');
                router.push('/dashboard/teacher');
                return;
            }
            setQuiz(quizData);

            // Fetch questions
            const { data: questionsData } = await supabase
                .from('questions')
                .select('*')
                .eq('quiz_id', quizId)
                .order('order_index', { ascending: true });
            if (questionsData) setQuestions(questionsData);

            // Reuse an unfinished session when the teacher reloads this route.
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
                router.push('/dashboard/teacher');
                return;
            }

            let sessionData = existingSessions?.[0];
            if (!sessionData) {
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
                    router.push('/dashboard/teacher');
                    return;
                }
                sessionData = createdSession;
            }

            if (!sessionData) {
                console.error('Failed to create session: no session was returned');
                alert('Unable to start a live quiz. Please try again.');
                router.push('/dashboard/teacher');
                return;
            }

            setSession(sessionData);
            setCurrentQuestionIndex(sessionData.current_question_index);
            let restoredTimeExpired = false;
            if (sessionData.current_question_index >= 0) {
                const duration = quizData.per_question_timer || 30;
                const questionKey = `live-quiz-${sessionData.id}-question-${sessionData.current_question_index}`;
                const storedStartTime = window.localStorage.getItem(questionKey);
                const startTime = storedStartTime ? Number(storedStartTime) : Date.now();
                if (!storedStartTime) {
                    window.localStorage.setItem(questionKey, String(startTime));
                }
                const remaining = Math.max(0, duration - Math.floor((Date.now() - startTime) / 1000));
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

            // 4. Initialize Supabase Realtime Subscription.
            // Remove a previous development-mode channel before registering callbacks.
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

        // Cleanup function when the teacher leaves the page
        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [quizId, router]);

    useEffect(() => {
        if (!session || currentQuestionIndex < 0) return;

        // Listen for new rows added to the submissions table for this session
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
                (payload) => {
                    const newSubmission = payload.new;

                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(submissionsChannel);
        };
    }, [session, currentQuestionIndex]);

    useEffect(() => {
        if (currentQuestionIndex < 0 || readOnlyResults || phase !== 'active') return;

        if (timeLeft === 0) {
            const transition = window.setTimeout(() => {
                setPhase('leaderboard');
            }, 0);
            return () => window.clearTimeout(transition);
        }

        const timer = window.setInterval(() => {
            setTimeLeft((previous) => {
                if (previous <= 1) {
                    window.clearInterval(timer);
                    setPhase('leaderboard');
                    return 0;
                }
                return previous - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [currentQuestionIndex, timeLeft]);

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
        const startTime = Date.now();
        window.localStorage.setItem(
            `live-quiz-${session.id}-question-${nextIndex}`,
            String(startTime)
        );

        // Update the database so all students' screens update simultaneously
        await supabase
            .from('quiz_sessions')
            .update({
                status: 'active',
                current_question_index: nextIndex
            })
            .eq('id', session.id);

        setCurrentQuestionIndex(nextIndex);
        setTimeLeft(duration);
        setPhase('active');
        await channelRef.current?.send({
            type: 'broadcast',
            event: 'question-started',
            payload: { quizId, index: nextIndex, duration, startTime },
        });
    };

    const handleStartGame = () => {
        if (!session) return;
        handleNextQuestion();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
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
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                        <div>
                            <p className="text-indigo-400 font-semibold">Live quiz</p>
                            <h1 className="text-3xl font-black">{quiz.title}</h1>
                        </div>
                        <div className="flex items-center gap-2 text-2xl font-bold">
                            <Clock className="w-7 h-7 text-indigo-400" />
                            <span>{timeLeft}s</span>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                        <main className="bg-gray-800 border border-gray-700 rounded-3xl p-8">
                            {phase === 'leaderboard' || phase === 'finished' ? (
                                <>
                                    {phase === 'finished' && sortedLeaderboard[0] ? (
                                        <div className="text-center mb-8 animate-bounce">
                                            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-3" />
                                            <p className="text-yellow-300 uppercase tracking-widest font-bold">Winner</p>
                                            <h2 className="text-4xl font-black">{sortedLeaderboard[0].name}</h2>
                                            <p className="text-indigo-300 mt-1">{sortedLeaderboard[0].correctAnswers} correct answers</p>
                                        </div>
                                    ) : <h2 className="text-3xl font-bold mb-6">Leaderboard</h2>}
                                    <ol className="space-y-4">
                                        {sortedLeaderboard.slice(phase === 'finished' ? 1 : 0).map((entry, index) => (
                                            <li key={entry.studentId} className="flex justify-between rounded-xl bg-gray-700 p-4">
                                                <span>{index + (phase === 'finished' ? 2 : 1)}. {entry.name}</span>
                                                <strong className="text-indigo-300">{entry.correctAnswers} correct · {entry.score} pts</strong>
                                            </li>
                                        ))}
                                    </ol>
                                    <button onClick={handleNextQuestion} disabled={phase === 'finished' || currentQuestionIndex >= questions.length - 1} className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-bold">
                                        {currentQuestionIndex >= questions.length - 1 ? 'Quiz Complete' : 'Next Question'}
                                    </button>
                                    {phase === 'finished' && (
                                        <button
                                            onClick={() => router.push('/dashboard/teacher')}
                                            className="mt-4 ml-3 px-6 py-3 bg-white text-gray-900 hover:bg-gray-200 rounded-xl font-bold"
                                        >
                                            Return to dashboard
                                        </button>
                                    )}
                                </>
                            ) : currentQuestion ? (
                                <>
                                    <p className="text-gray-400 mb-3">
                                        Question {currentQuestionIndex + 1} of {questions.length}
                                    </p>
                                    <h2 className="text-3xl font-bold mb-8">{currentQuestion.question_text}</h2>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {currentQuestion.options.map((option, index) => (
                                            <div key={`${currentQuestion.id}-${index}`} className="bg-gray-700 rounded-xl p-4">
                                                <span className="text-indigo-300 font-bold mr-3">{String.fromCharCode(65 + index)}.</span>
                                                {option}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-8 text-gray-400">Leaderboard will appear when the timer ends.</p>
                                </>
                            ) : (
                                <p className="text-gray-400">Loading question...</p>
                            )}
                        </main>

                        <aside className="bg-gray-800 border border-gray-700 rounded-3xl p-6">
                            <div className="flex items-center gap-2 mb-5">
                                <Trophy className="w-5 h-5 text-yellow-400" />
                                <h2 className="text-xl font-bold">Top 10</h2>
                            </div>
                            {sortedLeaderboard.length === 0 ? (
                                <p className="text-gray-400">No answers yet.</p>
                            ) : (
                                <ol className="space-y-3">
                                    {sortedLeaderboard.slice(0, 10).map((entry, index) => (
                                        <li key={entry.studentId} className="flex items-center justify-between gap-3">
                                            <span className="truncate text-gray-300">{index + 1}. {entry.name}</span>
                                            <span className="font-bold text-indigo-300">{entry.correctAnswers} · {entry.score}</span>
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

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
            <div className="max-w-3xl w-full text-center">
                <h1 className="text-4xl font-black text-white mb-2">{quiz.title}</h1>
                <p className="text-gray-400 mb-12">Join on your device using the code below</p>

                <div className="bg-gray-800 border border-gray-700 p-12 rounded-3xl mb-12 shadow-2xl">
                    <p className="text-gray-400 uppercase tracking-widest font-bold mb-4 text-sm">Room Code</p>
                    <div className="text-8xl font-black tracking-widest text-indigo-400 font-mono">
                        {session.room_code}
                    </div>
                </div>

                <div className="flex items-center justify-between bg-gray-800 p-6 rounded-2xl border border-gray-700">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg">
                            <Users className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <p className="text-sm text-gray-400 font-medium">Students Joined</p>
                            <p className="text-2xl font-bold">{joinedStudents}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleStartGame}
                        disabled={joinedStudents === 0}
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl flex items-center transition text-lg"
                    >
                        <Play className="w-6 h-6 mr-2" />
                        Start Quiz
                    </button>
                </div>
            </div>
        </div>
    );
}