'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Clock, BookOpen, Play } from 'lucide-react';
import { submitStaticQuiz } from '@/actions/submitStaticQuiz';
import DashboardBackground from '@/components/DashboardBackground';
import type { Quiz, Question } from '@/lib/types';
import { isRecord, isUuid, validateQuizQuestions } from '@/lib/quizValidation';
import { quizProgressKey, readQuizProgress, saveQuizProgress, clearQuizProgress } from '@/lib/quizProgress';

export default function StaticQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session') || undefined;
    const isReviewMode = searchParams.get('review') === '1';

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [quizState, setQuizState] = useState<'intro' | 'active' | 'completed' | 'submitting'>('intro');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [userId, setUserId] = useState<string>('');
    const [finalScore, setFinalScore] = useState<number>(0);
    const [userRole, setUserRole] = useState<string>('');
    const [reviewSubmissions, setReviewSubmissions] = useState<Record<string, { selectedIndex: number; isCorrect: boolean }>>({});
    const [endTime, setEndTime] = useState(0);
    const [loadError, setLoadError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const submittingRef = useRef(false);

    const handleStartQuiz = () => {
        if (!quiz || !questions.length) return;
        const now = Date.now();
        if (quiz.available_until && now >= Date.parse(quiz.available_until)) { setSubmitError('This quiz has closed. Return to your dashboard.'); return; }
        if (quiz.available_from && now < Date.parse(quiz.available_from)) { setSubmitError('This quiz has not opened yet.'); return; }
        const end = now + (quiz.total_duration_minutes || 45) * 60_000;
        setEndTime(end);
        setTimeLeft((quiz.total_duration_minutes || 45) * 60);
        saveQuizProgress(quizProgressKey(userId, quizId, sessionId), { endTime: end, answers, questionIndex: currentQuestionIndex });
        setQuizState('active');
    };

    const handleCompleteQuiz = useCallback(async () => {
        if (submittingRef.current || !quiz || !questions.length) return;
        submittingRef.current = true;
        setSubmitError('');
        setQuizState('submitting');

        try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            if (!authSession) throw new Error('Please sign in again before submitting.');
            const result = await submitStaticQuiz({
                quizId,
                accessToken: authSession.access_token,
                answers,
                sessionId,
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            setFinalScore(result.score ?? 0);
            clearQuizProgress(quizProgressKey(userId, quizId, sessionId));
            setQuizState('completed');

        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to submit the quiz. Please try again.');
            setQuizState('active');
        } finally {
            submittingRef.current = false;
        }
    }, [quiz, questions.length, quizId, sessionId, answers, userId]);

    useEffect(() => {
        if (quizState !== 'active' || !endTime) return;
        const timer = window.setInterval(() => setTimeLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000))), 250);
        return () => window.clearInterval(timer);
    }, [quizState, endTime]);

    useEffect(() => {
        if (quizState !== 'active' || timeLeft !== 0 || submitError) return;
        const timer = window.setTimeout(() => { void handleCompleteQuiz(); }, 0);
        return () => window.clearTimeout(timer);
    }, [quizState, timeLeft, submitError, handleCompleteQuiz]);

    useEffect(() => {
        if (quizState === 'active' && endTime && userId) saveQuizProgress(quizProgressKey(userId, quizId, sessionId), { endTime, answers, questionIndex: currentQuestionIndex });
    }, [quizState, endTime, userId, quizId, sessionId, answers, currentQuestionIndex]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    useEffect(() => {
        let cancelled = false;
        async function fetchQuizData() {
            try {
            if (!isUuid(quizId) || (sessionId && !isUuid(sessionId))) throw new Error('This quiz link is invalid.');
            const { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;
            if (session) {
                setUserId(session.user.id);

                // Fetch user role
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                
                if (profileError || !profile) throw new Error('Unable to verify your profile. Please sign in again.');
                if (profile) {
                    setUserRole(profile.role);
                }
            } else {
                router.push('/auth');
                return;
            }

            // 1. Fetch the quiz metadata
            const { data: quizData, error: quizError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('id', quizId)
                .single();

            if (quizError || !quizData || quizData.type !== 'static') throw new Error('This static quiz is unavailable.');

            const now = Date.now();
            const startsAt = quizData.available_from ? new Date(quizData.available_from).getTime() : null;
            const endsAt = quizData.available_until ? new Date(quizData.available_until).getTime() : null;
            if (!isReviewMode && ((startsAt !== null && now < startsAt) || (endsAt !== null && now >= endsAt))) {
                alert(endsAt !== null && now >= endsAt
                    ? 'This quiz is closed and can no longer be attempted.'
                    : `This quiz opens at ${new Date(startsAt as number).toLocaleString()}.`);
                router.push('/dashboard/student');
                return;
            }

            // 2. Fetch the associated questions, ordered correctly
            const { data: questionsData, error: questionsError } = await supabase
                .from('questions')
                .select('*')
                .eq('quiz_id', quizId)
                .order('order_index', { ascending: true });

            if (questionsError || !questionsData?.length) throw new Error('This quiz has no questions ready to play.');
            const normalized = validateQuizQuestions(questionsData.map(question => isRecord(question) ? { ...question, explanation: question.explanation ?? '', subtopic: question.subtopic ?? 'General' } : question));
            const validQuestions = normalized.map((question, index) => ({ ...questionsData[index], ...question })) as Question[];
            if (cancelled) return;
            setQuestions(validQuestions);
            setQuiz(quizData as Quiz);

            if (isReviewMode && session?.user) {
                if (!sessionId) throw new Error('Select a completed attempt from your quiz history to review it.');
                const { data: submissions, error: submissionsError } = await supabase
                    .from('submissions')
                    .select('question_id, selected_option_index, is_correct')
                    .eq('student_id', session.user.id)
                    .eq('session_id', sessionId)
                    .order('submitted_at', { ascending: true })
                    .in('question_id', (questionsData || []).map((question) => question.id));

                if (submissionsError || !submissions?.length) throw new Error('No submitted attempt is available for this review.');
                else {
                    setReviewSubmissions(Object.fromEntries(
                        (submissions || []).map((submission) => [
                            submission.question_id,
                            {
                                selectedIndex: submission.selected_option_index,
                                isCorrect: submission.is_correct,
                            },
                        ])
                    ));
                }
            } else if (session?.user) {
                const progress = readQuizProgress(quizProgressKey(session.user.id, quizId, sessionId), validQuestions.map(question => question.id), quizData.total_duration_minutes || 45);
                if (progress) {
                    setAnswers(progress.answers); setCurrentQuestionIndex(progress.questionIndex); setEndTime(progress.endTime);
                    setTimeLeft(Math.max(0, Math.ceil((progress.endTime - Date.now()) / 1000))); setQuizState('active');
                }
            }
            } catch (error) {
                if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load the quiz. Please try again.');
            } finally { if (!cancelled) setLoading(false); }
        }

        void fetchQuizData();
        return () => { cancelled = true; };
    }, [quizId, router, isReviewMode, sessionId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fff5f0] relative overflow-hidden">
                <DashboardBackground />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin" />
                    <p className="mt-4 font-mono font-bold text-[#8c827a] text-sm animate-pulse">Loading quiz materials...</p>
                </div>
            </div>
        );
    }
    if (loadError || !quiz || !questions.length) return <main id="main-content" className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 font-mono text-center"><h1 className="text-3xl font-bold text-black mb-4">Quiz unavailable</h1><p role="alert" className="text-muted mb-6">{loadError || 'This quiz has no questions ready to play.'}</p><button onClick={() => router.push('/dashboard/student')} className="bg-brand text-black rounded-xl px-6 py-3">Return to Dashboard</button></main>;

    if (isReviewMode) {
        const correctCount = Object.values(reviewSubmissions).filter((submission) => submission.isCorrect).length;

        return (
            <div className="min-h-screen bg-[#fff5f0] p-6 relative overflow-x-hidden">
                <DashboardBackground />
                <main id="main-content" className="relative z-10 max-w-4xl mx-auto mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
                        <div>
                            <p className="text-brand font-black font-mono uppercase tracking-widest text-sm mb-1">Quiz review</p>
                            <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-black">{quiz.title}</h1>
                        </div>
                        <div className="backdrop-blur-md bg-white/90 border-2 border-brand-light rounded-2xl px-6 py-4 text-xl font-black font-mono text-black shadow-sm">
                            Score: <span className="text-brand">{correctCount}</span> / {questions.length}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {questions.map((question, questionIndex) => {
                            const submission = reviewSubmissions[question.id];
                            return (
                                <section key={question.id} className="backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-8 sm:p-10 shadow-md">
                                    <p className="text-base font-bold font-mono text-[#8c827a] mb-2">Question {questionIndex + 1}</p>
                                    <h2 className="text-2xl font-bold font-mono text-black mb-6 leading-relaxed">{question.question_text}</h2>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {question.options.map((option: string, optionIndex: number) => {
                                            const isCorrectOption = optionIndex === question.correct_option_index;
                                            const isSelectedOption = optionIndex === submission?.selectedIndex;
                                            const optionClass = isCorrectOption
                                                ? 'border-green-500 bg-green-50 text-green-900'
                                                : isSelectedOption
                                                    ? 'border-red-500 bg-red-50 text-red-900'
                                                    : 'border-brand-light bg-white/90 text-gray-700 opacity-60';

                                            return (
                                                <div key={optionIndex} className={`rounded-2xl border-2 p-5 font-mono font-bold text-lg shadow-sm ${optionClass}`}>
                                                    <span className="font-bold mr-3">{String.fromCharCode(65 + optionIndex)}.</span>
                                                    {option}
                                                    {isCorrectOption && <p className="mt-3 text-xs font-black text-green-700 uppercase tracking-widest">Correct answer</p>}
                                                    {isSelectedOption && !isCorrectOption && <p className="mt-3 text-xs font-black text-red-700 uppercase tracking-widest">Your response</p>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {!submission && <p className="mt-6 text-sm font-black font-mono uppercase tracking-widest text-red-600">No response submitted</p>}
                                </section>
                            );
                        })}
                    </div>

                    <div className="mt-12 flex justify-center">
                        <button
                            onClick={() => router.push('/dashboard/student')}
                            className="px-10 py-5 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-xl rounded-2xl transition shadow-md"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // Render the Intro Screen
    if (quizState === 'intro') {
        if (userRole === 'teacher') {
            return (
                <div className="min-h-screen bg-[#fff5f0] flex items-center justify-center p-6 relative overflow-hidden">
                    <DashboardBackground />
                    <main id="main-content" className="relative z-10 max-w-md w-full backdrop-blur-md bg-white/85 p-6 sm:p-12 rounded-[2.5rem] border-2 border-brand-light shadow-lg text-center">
                        <div className="inline-flex p-4 bg-brand-light text-brand rounded-2xl mb-6 border-2 border-brand-light">
                            <BookOpen className="w-10 h-10" />
                        </div>
                        <h1 className="text-3xl font-black font-mono tracking-tight text-black mb-3">Teacher View</h1>
                        <p className="text-[#8c827a] font-mono text-base mb-8">As a teacher, you cannot take the quiz. You can view the quiz details or results from your dashboard.</p>
                        <button
                            onClick={() => router.push('/dashboard/teacher')}
                            className="w-full px-8 py-5 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-xl rounded-2xl inline-flex items-center justify-center transition shadow-md"
                        >
                            Return to Dashboard
                        </button>
                    </main>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-[#fff5f0] flex items-center justify-center p-6 relative overflow-hidden">
                <DashboardBackground />
                <main id="main-content" className="relative z-10 max-w-3xl w-full backdrop-blur-md bg-white/85 p-6 sm:p-14 rounded-[2.5rem] border-2 border-brand-light shadow-lg text-center">
                    {submitError && <p role="alert" className="mb-6 text-red-700">{submitError}</p>}
                    <div className="inline-flex p-4 bg-brand-light text-brand rounded-2xl mb-6 border-2 border-brand-light">
                        <BookOpen className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-black mb-4">{quiz.title}</h1>
                    <p className="text-[#8c827a] font-mono text-lg font-bold mb-10">{quiz.description || 'Complete all questions before the timer runs out.'}</p>

                    <div className="flex justify-center gap-12 mb-10 border-y-2 border-brand-light border-dashed py-8">
                        <div className="flex flex-col items-center font-mono">
                            <span className="text-[#8c827a] text-sm font-bold uppercase tracking-widest mb-2">Questions</span>
                            <span className="text-4xl font-black text-black">{questions.length}</span>
                        </div>
                        <div className="flex flex-col items-center font-mono">
                            <span className="text-[#8c827a] text-sm font-bold uppercase tracking-widest mb-2">Total Time</span>
                            <span className="text-4xl font-black text-black flex items-center">
                                <Clock className="w-8 h-8 mr-2 text-brand" />
                                {quiz.total_duration_minutes || 45} <span className="text-xl ml-2 text-[#8c827a]">mins</span>
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleStartQuiz}
                        className="w-full sm:w-auto px-12 py-5 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-2xl rounded-2xl inline-flex items-center justify-center transition shadow-md"
                    >
                        <Play className="w-7 h-7 mr-3 fill-current" />
                        Begin Quiz
                    </button>
                </main>
            </div>
        );
    }

    if (quizState === 'active') {
        const currentQuestion = questions[currentQuestionIndex];
        const isLastQuestion = currentQuestionIndex === questions.length - 1;
        const isFirstQuestion = currentQuestionIndex === 0;

        return (
            <div className="min-h-screen bg-[#fff5f0] p-6 flex flex-col items-center relative overflow-x-hidden">
                <DashboardBackground />
                <main id="main-content" className="relative z-10 w-full max-w-4xl">
                {submitError && <p role="alert" className="mb-6 p-4 rounded-xl bg-red-50 text-red-700">{submitError} <button onClick={() => { void handleCompleteQuiz(); }} className="underline font-bold">Retry submission</button></p>}
                {/* Top Bar with Timer */}
                <div className="relative z-10 w-full max-w-4xl backdrop-blur-md bg-white/85 p-5 sm:p-6 rounded-2xl shadow-md border-2 border-brand-light flex justify-between items-center mb-8">
                    <span className="font-bold font-mono text-xl text-black">
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </span>
                    <div role="timer" aria-label={`${timeLeft} seconds remaining`} className={`flex items-center font-black font-mono text-xl px-5 py-2.5 rounded-xl border-2 transition ${
                        timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-300' : 'bg-brand-light text-black border-brand-light'
                    }`}>
                        <Clock className="w-6 h-6 mr-2.5" />
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Question Card */}
                <div className="relative z-10 w-full max-w-4xl backdrop-blur-md bg-white/85 p-8 sm:p-12 rounded-[2.5rem] shadow-lg border-2 border-brand-light">
                    <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-black mb-10 leading-snug">
                        {currentQuestion.question_text}
                    </h1>

                    <div className="space-y-4">
                        {currentQuestion.options.map((option: string, index: number) => {
                            const isSelected = answers[currentQuestion.id] === index;
                            return (
                                <button
                                    key={index}
                                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: index }))}
                                    aria-pressed={isSelected}
                                    disabled={timeLeft === 0}
                                    className={`w-full text-left p-6 rounded-2xl border-2 font-mono text-xl transition-all shadow-sm flex items-center ${
                                        isSelected
                                            ? 'border-brand bg-brand text-black font-black shadow-md scale-[1.01]'
                                            : 'border-brand-light hover:border-brand bg-white/90 text-gray-800 hover:bg-brand-lightest font-bold'
                                    }`}
                                >
                                    <span className={`inline-flex items-center justify-center w-11 h-11 rounded-full mr-4 border-2 shrink-0 ${
                                        isSelected ? 'bg-black text-white border-black font-black' : 'bg-brand-light text-black border-transparent font-bold'
                                    }`}>
                                        {String.fromCharCode(65 + index)}
                                    </span>
                                    <span className="leading-snug">{option}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {/* Navigation Controls */}
                <div className="relative z-10 w-full max-w-4xl flex justify-between mt-8">
                    <button
                        disabled={isFirstQuestion}
                        onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                        className="px-8 py-4 bg-white border-2 border-brand-light text-black font-bold font-mono text-lg rounded-xl hover:bg-brand-lightest disabled:opacity-40 transition shadow-sm"
                    >
                        Previous
                    </button>

                    {!isLastQuestion ? (
                        <button
                            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                            className="px-8 py-4 bg-black hover:bg-gray-800 text-white font-bold font-mono text-lg rounded-xl transition shadow-md"
                        >
                            Next Question
                        </button>
                    ) : (
                        <button
                            onClick={handleCompleteQuiz}
                            className="px-10 py-4 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-xl rounded-xl transition shadow-md"
                        >
                            Submit Quiz
                        </button>
                    )}
                </div>
                </main>
            </div>
        );
    }

    if (quizState === 'submitting') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fff5f0] relative overflow-hidden">
                <DashboardBackground />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin" />
                    <p className="mt-4 font-mono font-bold text-brand text-lg animate-pulse">Grading your answers and submitting...</p>
                </div>
            </div>
        );
    }

    if (quizState === 'completed') {
        const percentage = Math.round((finalScore / questions.length) * 100);

        return (
            <div className="min-h-screen bg-[#fff5f0] flex items-center justify-center p-6 relative overflow-hidden">
                <DashboardBackground />
                <main id="main-content" className="relative z-10 max-w-xl w-full backdrop-blur-md bg-white/85 p-6 sm:p-14 rounded-[2.5rem] border-2 border-brand-light shadow-lg text-center">
                    <div className="inline-flex p-5 bg-brand-light text-brand rounded-2xl mb-6 border-2 border-brand-light">
                        <BookOpen className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-black mb-3">Quiz Complete!</h1>
                    <p className="text-[#8c827a] font-mono text-lg font-bold mb-10">Your responses have been successfully recorded.</p>

                    <div className="bg-white/95 rounded-2xl p-8 mb-10 border-2 border-brand-light border-dashed shadow-sm">
                        <div className="text-7xl font-black font-mono text-brand mb-4">{percentage}%</div>
                        <p className="text-gray-700 font-bold font-mono text-xl">
                            You scored {finalScore} out of {questions.length} correct
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="w-full py-5 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-2xl rounded-2xl transition shadow-md"
                    >
                        Return to Dashboard
                    </button>
                </main>
            </div>
        );
    }

    return null;
}
