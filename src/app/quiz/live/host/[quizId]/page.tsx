'use client';

import { useCallback, useEffect, useState, use, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Play, Clock, Trophy, ArrowLeft, Zap } from 'lucide-react';
import DashboardBackground from '@/components/DashboardBackground';
import type { Quiz, Question, QuizSession } from '@/lib/types';

type LeaderboardEntry = {
    studentId: string;
    name: string;
    score: number;
    correctAnswers: number;
    totalResponseTime: number;
};
type Initialization = { quiz: Quiz; session: QuizSession; questions: Question[] };
const liveSessionInitMap = new Map<string, Promise<Initialization>>();

export default function HostLobbyPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();
    const isInstant = useSearchParams().get('instant') === 'true';
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [session, setSession] = useState<QuizSession | null>(null);
    const [joinedStudents, setJoinedStudents] = useState(0);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [timeLeft, setTimeLeft] = useState(30);
    const [phase, setPhase] = useState<'active' | 'leaderboard' | 'finished'>('active');
    const [readOnlyResults, setReadOnlyResults] = useState(false);
    const [changingQuestion, setChangingQuestion] = useState(false);
    const changingQuestionRef = useRef(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const questionEndTimeRef = useRef(0);

    useEffect(() => {
        let cancelled = false;
        let channel: RealtimeChannel | undefined;
        async function initialize() {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (cancelled) return;
                if (!user) {
                    router.replace('/auth');
                    return;
                }
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                if (cancelled) return;
                if (profileError || profile?.role !== 'teacher') {
                    router.replace('/dashboard/student');
                    return;
                }
                const key = `${user.id}:${quizId}`;
                let promise = liveSessionInitMap.get(key);
                if (!promise) {
                    promise = (async () => {
                        const { data: quizData, error: quizError } = await supabase
                            .from('quizzes')
                            .select('*')
                            .eq('id', quizId)
                            .eq('teacher_id', user.id)
                            .single();
                        if (quizError || !quizData || quizData.type !== 'competitive')
                            throw new Error('This live quiz is unavailable or belongs to another teacher.');
                        const { data: questionData, error: questionError } = await supabase
                            .from('questions')
                            .select('*')
                            .eq('quiz_id', quizId)
                            .order('order_index', { ascending: true });
                        if (questionError || !questionData?.length)
                            throw new Error('This quiz has no questions ready to play.');
                        const { data: existing, error: sessionError } = await supabase
                            .from('quiz_sessions')
                            .select('*')
                            .eq('quiz_id', quizId)
                            .in('status', ['waiting', 'active', 'leaderboard', 'finished', 'completed'])
                            .order('created_at', { ascending: false })
                            .limit(1);
                        if (sessionError) throw new Error('Unable to load the live session. Please try again.');
                        let found = existing?.[0];
                        if (!found) {
                            const random = crypto.getRandomValues(new Uint32Array(1))[0];
                            const { data: created, error: createError } = await supabase
                                .from('quiz_sessions')
                                .insert({
                                    quiz_id: quizId,
                                    room_code: String(100000 + (random % 900000)),
                                    status: 'waiting',
                                    current_question_index: -1,
                                })
                                .select('*')
                                .single();
                            if (createError || !created)
                                throw new Error('Unable to create the live session. Please try again.');
                            found = created;
                        }
                        return {
                            quiz: quizData as Quiz,
                            session: found as QuizSession,
                            questions: questionData as Question[],
                        };
                    })();
                    liveSessionInitMap.set(key, promise);
                }
                let result: Initialization;
                try {
                    result = await promise;
                } finally {
                    window.setTimeout(() => liveSessionInitMap.delete(key), 1000);
                }
                if (cancelled) return;
                setQuiz(result.quiz);
                setSession(result.session);
                setQuestions(result.questions);
                setCurrentQuestionIndex(result.session.current_question_index);
                const completed = result.session.status === 'completed';
                setReadOnlyResults(completed);
                let remaining = result.quiz.per_question_timer || 30;
                if (result.session.current_question_index >= 0) {
                    const storageKey = `live-quiz-${result.session.id}-question-${result.session.current_question_index}-end`;
                    let end = 0;
                    try {
                        end = Number(localStorage.getItem(storageKey));
                    } catch {}
                    if (!Number.isFinite(end) || end <= 0) {
                        end = Date.now() + remaining * 1000;
                        try {
                            localStorage.setItem(storageKey, String(end));
                        } catch {}
                    }
                    questionEndTimeRef.current = end;
                    remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
                    setTimeLeft(remaining);
                }
                setPhase(
                    result.session.status === 'finished' || completed
                        ? 'finished'
                        : result.session.status === 'leaderboard' ||
                            (remaining === 0 && result.session.current_question_index >= 0)
                          ? 'leaderboard'
                          : 'active',
                );
                setLoading(false);
                const name = `room-${result.session.room_code}`;
                const existingChannel = supabase.getChannels().find((item) => item.topic === `realtime:${name}`);
                if (existingChannel) await supabase.removeChannel(existingChannel);
                if (cancelled) return;
                const room = supabase.channel(name, { config: { presence: { key: 'host' } } });
                room.on('presence', { event: 'sync' }, () => {
                    if (!cancelled)
                        setJoinedStudents(Object.keys(room.presenceState()).filter((key) => key !== 'host').length);
                });
                channel = room;
                channelRef.current = room;
                room.subscribe((status) => {
                    if (!cancelled && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'))
                        setError('The live connection was interrupted. Refresh to reconnect before advancing.');
                });
            } catch (failure) {
                if (!cancelled) {
                    setError(
                        failure instanceof Error
                            ? failure.message
                            : 'Unable to initialize the live room. Please try again.',
                    );
                    setLoading(false);
                }
            }
        }
        void initialize();
        return () => {
            cancelled = true;
            if (channel) void supabase.removeChannel(channel);
            if (channelRef.current === channel) channelRef.current = null;
        };
    }, [quizId, router]);

    const loadLeaderboard = useCallback(async () => {
        if (!session) return;
        const { data, error: queryError } = await supabase
            .from('submissions')
            .select('student_id, score_awarded, is_correct, response_time_ms, profiles(full_name)')
            .eq('session_id', session.id);
        if (queryError) {
            setError('Unable to load the leaderboard. Refresh to try again.');
            return;
        }
        const totals = new Map<string, LeaderboardEntry>();
        (data || []).forEach((submission) => {
            const existing = totals.get(submission.student_id);
            const profile = Array.isArray(submission.profiles) ? submission.profiles[0] : submission.profiles;
            totals.set(submission.student_id, {
                studentId: submission.student_id,
                name: existing?.name || profile?.full_name || 'Student',
                score:
                    (existing?.score || 0) + (submission.is_correct ? Math.max(0, submission.score_awarded || 0) : 0),
                correctAnswers: (existing?.correctAnswers || 0) + (submission.is_correct ? 1 : 0),
                totalResponseTime: (existing?.totalResponseTime || 0) + (submission.response_time_ms || 0),
            });
        });
        const entries = Array.from(totals.values()).sort(
            (a, b) =>
                b.correctAnswers - a.correctAnswers || b.score - a.score || a.totalResponseTime - b.totalResponseTime,
        );
        setLeaderboard(entries);
        const isFinal = currentQuestionIndex >= questions.length - 1;
        if (!readOnlyResults) {
            await channelRef.current?.send({
                type: 'broadcast',
                event: 'leaderboard-updated',
                payload: { entries, isFinal },
            });
            if (isFinal && session.status !== 'completed') {
                const { error: finishError } = await supabase
                    .from('quiz_sessions')
                    .update({ status: 'finished' })
                    .eq('id', session.id);
                if (finishError) {
                    setError('Unable to persist the final quiz state. Refresh to retry.');
                    return;
                }
                setPhase('finished');
            }
        }
    }, [session, currentQuestionIndex, questions.length, readOnlyResults]);

    useEffect(() => {
        if (!session || currentQuestionIndex < 0) return;
        const channel = supabase
            .channel(`submissions-${session.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'submissions', filter: `session_id=eq.${session.id}` },
                () => {
                    if (phase === 'leaderboard' || phase === 'finished') void loadLeaderboard();
                },
            )
            .subscribe();
        return () => {
            void supabase.removeChannel(channel);
        };
    }, [session, currentQuestionIndex, phase, loadLeaderboard]);

    useEffect(() => {
        if (currentQuestionIndex < 0 || readOnlyResults || phase !== 'active') return;
        const timer = window.setInterval(() => {
            const end = questionEndTimeRef.current;
            if (!end) return;
            const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining === 0) setPhase('leaderboard');
        }, 250);
        return () => window.clearInterval(timer);
    }, [currentQuestionIndex, phase, readOnlyResults]);

    useEffect(() => {
        if (phase !== 'leaderboard' && phase !== 'finished') return;
        const timer = window.setTimeout(() => {
            void loadLeaderboard();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [phase, loadLeaderboard]);

    useEffect(() => {
        if (phase !== 'finished' || !session || readOnlyResults) return;
        const timer = window.setTimeout(async () => {
            const { error: finishError } = await supabase
                .from('quiz_sessions')
                .update({ status: 'completed' })
                .eq('id', session.id);
            if (finishError) setError('Unable to close the session. Refresh to try again.');
        }, 10000);
        return () => window.clearTimeout(timer);
    }, [phase, session, readOnlyResults]);

    const handleNextQuestion = async () => {
        if (!session || readOnlyResults || phase === 'finished' || changingQuestionRef.current) return;
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= questions.length) return;
        changingQuestionRef.current = true;
        setChangingQuestion(true);
        setError('');
        try {
            const duration = quiz?.per_question_timer || 30;
            const { error: updateError } = await supabase
                .from('quiz_sessions')
                .update({ status: 'active', current_question_index: nextIndex })
                .eq('id', session.id);
            if (updateError) throw new Error('Unable to start the next question. Please try again.');
            const endTime = Date.now() + duration * 1000;
            questionEndTimeRef.current = endTime;
            try {
                localStorage.setItem(`live-quiz-${session.id}-question-${nextIndex}-end`, String(endTime));
            } catch {}
            setCurrentQuestionIndex(nextIndex);
            setTimeLeft(duration);
            setPhase('active');
            const result = await channelRef.current?.send({
                type: 'broadcast',
                event: 'question-started',
                payload: { quizId, index: nextIndex, duration, endTime },
            });
            if (result !== 'ok')
                setError(
                    'The question was saved, but its live broadcast failed. Students will recover through polling; check the connection.',
                );
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to advance the quiz. Please try again.');
        } finally {
            changingQuestionRef.current = false;
            setChangingQuestion(false);
        }
    };

    if (loading)
        return (
            <main id="main-content" className="min-h-screen flex items-center justify-center bg-bg relative">
                <DashboardBackground />
                <p role="status" className="relative z-10 font-mono text-muted">
                    Initializing quiz lobby...
                </p>
            </main>
        );
    if (!quiz || !session)
        return (
            <main
                id="main-content"
                className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg font-mono"
            >
                <h1 className="text-3xl font-bold text-black mb-4">Live quiz unavailable</h1>
                <p role="alert" className="text-muted mb-6">
                    {error || 'This room could not be loaded.'}
                </p>
                <button onClick={() => window.location.reload()} className="bg-brand text-black rounded-xl px-6 py-3">
                    Try again
                </button>
            </main>
        );
    const currentQuestion = questions[currentQuestionIndex];
    const back = () => router.push(isInstant ? '/' : '/dashboard/teacher');

    return (
        <div className="min-h-screen bg-bg text-[#1c1917] p-4 sm:p-6 relative overflow-x-hidden font-mono">
            <DashboardBackground />
            <main
                id="main-content"
                className={`relative z-10 mx-auto ${currentQuestionIndex >= 0 ? 'max-w-6xl' : 'max-w-3xl min-h-[calc(100svh-3rem)] flex flex-col items-center justify-center text-center'}`}
            >
                {error && (
                    <p role="alert" className="w-full p-4 mb-6 rounded-xl border border-red-200 bg-red-50 text-red-700">
                        {error}
                    </p>
                )}
                {currentQuestionIndex < 0 ? (
                    <>
                        <button
                            onClick={back}
                            className="inline-flex items-center gap-2 text-sm font-bold text-brand-ink mb-6 px-4 py-2 rounded-full bg-white/85 border border-brand-light shadow-xs self-start"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {isInstant ? 'Back to Home' : 'Back to Dashboard'}
                        </button>
                        {isInstant && (
                            <span className="px-3.5 py-1.5 rounded-xl bg-brand text-black font-bold text-xs uppercase mb-3 inline-flex gap-1.5">
                                <Zap className="w-3.5 h-3.5" />
                                Instant Live Quiz (Temporary Session)
                            </span>
                        )}
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-black mb-3 break-words">
                            {quiz.title}
                        </h1>
                        <p className="text-muted text-lg font-bold mb-8">Join on your device using the code below</p>
                        <div className="w-full max-w-2xl backdrop-blur-md bg-white/85 border-2 border-brand-light p-6 sm:p-14 rounded-[2.5rem] mb-8 shadow-lg">
                            <p className="text-muted uppercase tracking-widest font-black mb-4 text-sm">ROOM CODE</p>
                            <div className="text-[clamp(2.75rem,12vw,8rem)] leading-tight font-black tracking-[0.08em] text-brand-ink select-all">
                                {session.room_code}
                            </div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-md bg-white/85 p-6 sm:p-8 rounded-2xl border-2 border-brand-light shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 bg-brand-light text-brand-ink rounded-2xl">
                                    <Users className="w-7 h-7" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm text-muted font-bold">Students Joined</p>
                                    <p aria-live="polite" className="text-3xl font-black text-black">
                                        {joinedStudents}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleNextQuestion}
                                disabled={joinedStudents === 0 || changingQuestion || !questions.length}
                                className="w-full sm:w-auto px-8 py-5 bg-brand hover:bg-[#c47155] disabled:bg-brand-light disabled:text-gray-500 text-black font-black rounded-xl flex items-center justify-center transition text-xl shadow-md"
                            >
                                <Play className="w-6 h-6 mr-3 fill-current" />
                                {changingQuestion ? 'Starting...' : 'Start Quiz'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
                            <div className="min-w-0">
                                <p className="text-brand-ink font-black uppercase tracking-widest text-sm mb-1">
                                    Live quiz
                                </p>
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-black break-words">
                                    {quiz.title}
                                </h1>
                            </div>
                            <div
                                role="timer"
                                aria-label={`${timeLeft} seconds remaining`}
                                className={`flex items-center gap-2.5 text-2xl font-black px-6 py-3 rounded-2xl border-2 shadow-sm ${timeLeft < 10 ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white/85 border-brand-light text-black'}`}
                            >
                                <Clock className="w-7 h-7" />
                                {timeLeft}s
                            </div>
                        </header>
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                            <section className="min-w-0 backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-6 sm:p-10 shadow-lg">
                                {phase === 'leaderboard' || phase === 'finished' ? (
                                    <>
                                        {phase === 'finished' && leaderboard[0] ? (
                                            <div className="text-center mb-8 bg-brand-lightest/90 border-2 border-brand-light rounded-[2rem] p-6 sm:p-8 shadow-sm motion-safe:animate-bounce">
                                                <Trophy className="w-20 h-20 text-brand-ink mx-auto mb-3" />
                                                <p className="text-brand-ink uppercase tracking-widest font-black">
                                                    Winner
                                                </p>
                                                <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-black mt-1 break-words">
                                                    {leaderboard[0].name}
                                                </h2>
                                                <p className="text-muted font-bold text-lg mt-2">
                                                    {leaderboard[0].correctAnswers} correct answers •{' '}
                                                    {leaderboard[0].score} pts
                                                </p>
                                            </div>
                                        ) : (
                                            <h2 className="text-3xl font-black text-black mb-6">Leaderboard</h2>
                                        )}
                                        <ol className="space-y-3">
                                            {leaderboard.slice(phase === 'finished' ? 1 : 0).map((entry, index) => (
                                                <li
                                                    key={entry.studentId}
                                                    className="flex flex-wrap justify-between gap-2 rounded-2xl bg-white/95 border-2 border-brand-light p-5 shadow-sm"
                                                >
                                                    <span className="font-bold text-black text-lg break-words">
                                                        {index + (phase === 'finished' ? 2 : 1)}. {entry.name}
                                                    </span>
                                                    <strong className="text-brand-ink text-lg">
                                                        {entry.correctAnswers} correct · {entry.score} pts
                                                    </strong>
                                                </li>
                                            ))}
                                        </ol>
                                        <div className="flex justify-center flex-wrap gap-4 mt-8 pt-4 border-t-2 border-brand-light">
                                            <button
                                                onClick={handleNextQuestion}
                                                disabled={
                                                    changingQuestion ||
                                                    phase === 'finished' ||
                                                    currentQuestionIndex >= questions.length - 1
                                                }
                                                className="px-8 py-4 bg-brand hover:bg-[#c47155] disabled:bg-brand-light disabled:text-gray-500 rounded-xl font-black text-black text-lg shadow-sm"
                                            >
                                                {currentQuestionIndex >= questions.length - 1
                                                    ? 'Quiz Complete'
                                                    : changingQuestion
                                                      ? 'Starting...'
                                                      : 'Next Question'}
                                            </button>
                                            {phase === 'finished' && (
                                                <button
                                                    onClick={back}
                                                    className="px-8 py-4 bg-white border-2 border-brand-light text-black rounded-xl font-black text-lg"
                                                >
                                                    {isInstant ? 'Back to Home' : 'Return to dashboard'}
                                                </button>
                                            )}
                                        </div>
                                        {phase === 'finished' && isInstant && (
                                            <div className="mt-8 p-6 rounded-2xl bg-[#fbf5f0] border-2 border-brand-light text-center">
                                                <h3 className="font-black text-black">
                                                    Want to save quizzes & track student analytics?
                                                </h3>
                                                <p className="text-sm text-muted mt-2">
                                                    Create a free teacher account to save quizzes and assign homework.
                                                </p>
                                                <button
                                                    onClick={() => router.push('/auth?mode=signup&role=teacher')}
                                                    className="mt-3 px-6 py-2.5 rounded-xl bg-black text-white text-sm font-bold"
                                                >
                                                    Create Teacher Account →
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : currentQuestion ? (
                                    <>
                                        <p className="text-muted font-bold mb-2">
                                            Question {currentQuestionIndex + 1} of {questions.length}
                                        </p>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-black leading-snug mb-8 break-words">
                                            {currentQuestion.question_text}
                                        </h2>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            {currentQuestion.options.map((option, index) => (
                                                <div
                                                    key={`${currentQuestion.id}-${index}`}
                                                    className="bg-brand-lightest/80 border-2 border-brand-light rounded-2xl p-5 sm:p-6 text-lg font-bold text-black shadow-sm flex items-center"
                                                >
                                                    <span className="w-10 h-10 rounded-full bg-brand-light text-brand-ink flex items-center justify-center font-black mr-4 shrink-0">
                                                        {String.fromCharCode(65 + index)}
                                                    </span>
                                                    <span className="leading-snug break-words min-w-0">{option}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-8 text-muted font-bold text-sm">
                                            Leaderboard will appear when the timer ends.
                                        </p>
                                    </>
                                ) : (
                                    <p role="status" className="text-muted">
                                        Loading question...
                                    </p>
                                )}
                            </section>
                            <aside className="bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-6 sm:p-8 shadow-lg h-fit">
                                <div className="flex gap-2.5 mb-6">
                                    <Trophy className="w-6 h-6 text-brand-ink" />
                                    <h2 className="text-2xl font-black text-black">Top 10</h2>
                                </div>
                                {leaderboard.length ? (
                                    <ol className="space-y-3">
                                        {leaderboard.slice(0, 10).map((entry, index) => (
                                            <li
                                                key={entry.studentId}
                                                className="flex justify-between gap-3 p-3.5 rounded-xl bg-brand-lightest/70 border border-brand-light"
                                            >
                                                <span className="truncate text-black font-bold">
                                                    {index + 1}. {entry.name}
                                                </span>
                                                <span className="font-black text-brand-ink shrink-0">
                                                    {entry.correctAnswers} • {entry.score}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="text-muted font-bold">No answers yet.</p>
                                )}
                            </aside>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
