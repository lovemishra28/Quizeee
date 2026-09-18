'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Clock, BookOpen, Play } from 'lucide-react';
import { submitStaticQuiz } from '@/actions/submitStaticQuiz';

export default function StaticQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session') || undefined;
    const isReviewMode = searchParams.get('review') === '1';

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [quizState, setQuizState] = useState<'intro' | 'active' | 'completed' | 'submitting'>('intro');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [userId, setUserId] = useState<string>('');
    const [finalScore, setFinalScore] = useState<number>(0);
    const [userRole, setUserRole] = useState<string>('');
    const [reviewSubmissions, setReviewSubmissions] = useState<Record<string, { selectedIndex: number; isCorrect: boolean }>>({});

    // Timer Countdown Logic
    useEffect(() => {
        if (quizState !== 'active' || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [quizState, timeLeft]);

    // Auto-submit when time runs out
    useEffect(() => {
        if (quizState === 'active' && timeLeft === 0) {
            handleCompleteQuiz();
        }
    }, [timeLeft, quizState]);

    const handleStartQuiz = () => {
        // Convert minutes to seconds
        setTimeLeft((quiz.total_duration_minutes || 45) * 60);
        setQuizState('active');
    };

    const handleCompleteQuiz = async () => {
        setQuizState('submitting');

        try {
            const result = await submitStaticQuiz({
                quizId,
                userId,
                answers,
                sessionId,
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            setFinalScore(result.score ?? 0);
            setQuizState('completed');

        } catch (error: any) {
            console.error('Error submitting quiz:', error);
            alert(`Failed to submit quiz: ${error.message || 'Please try again.'}`);
            setQuizState('active'); // Revert so they can try clicking submit again
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    useEffect(() => {
        async function fetchQuizData() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUserId(session.user.id);

                // Fetch user role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                
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

            if (quizError || !quizData) {
                alert('Quiz not found.');
                router.push('/dashboard/student');
                return;
            }

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

            if (questionsError) {
                console.error(questionsError);
            } else {
                setQuestions(questionsData || []);
            }

            setQuiz(quizData);

            if (isReviewMode && session?.user) {
                const { data: submissions, error: submissionsError } = await supabase
                    .from('submissions')
                    .select('question_id, selected_option_index, is_correct')
                    .eq('student_id', session.user.id)
                    .in('question_id', (questionsData || []).map((question) => question.id));

                if (submissionsError) {
                    console.error('Failed to load quiz review', submissionsError);
                } else {
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
            }

            setLoading(false);
        }

        fetchQuizData();
    }, [quizId, router, isReviewMode]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg">
                <p className="text-gray-500 font-bold font-mono text-xl animate-pulse">Loading quiz materials...</p>
            </div>
        );
    }

    if (isReviewMode) {
        const correctCount = Object.values(reviewSubmissions).filter((submission) => submission.isCorrect).length;

        return (
            <div className="min-h-screen bg-bg p-6">
                <main className="max-w-4xl mx-auto mt-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-12">
                        <div>
                            <p className="text-brand font-bold font-mono uppercase tracking-widest mb-2">Quiz review</p>
                            <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-black">{quiz.title}</h1>
                        </div>
                        <div className="bg-brand-light border-2 border-brand-light rounded-xl px-6 py-4 text-xl font-black font-mono text-black shadow-sm">
                            Score: {correctCount} / {questions.length}
                        </div>
                    </div>

                    <div className="space-y-8">
                        {questions.map((question: any, questionIndex: number) => {
                            const submission = reviewSubmissions[question.id];
                            return (
                                <section key={question.id} className="bg-brand-lightest border-2 border-brand-light rounded-[2rem] p-8 shadow-sm">
                                    <p className="text-lg font-bold font-mono text-gray-500 mb-2">Question {questionIndex + 1}</p>
                                    <h2 className="text-2xl font-bold font-mono text-black mb-6 leading-relaxed">{question.question_text}</h2>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {question.options.map((option: string, optionIndex: number) => {
                                            const isCorrectOption = optionIndex === question.correct_option_index;
                                            const isSelectedOption = optionIndex === submission?.selectedIndex;
                                            const optionClass = isCorrectOption
                                                ? 'border-green-500 bg-green-50 text-green-900'
                                                : isSelectedOption
                                                    ? 'border-red-500 bg-red-50 text-red-900'
                                                    : 'border-brand-light bg-white text-gray-700 opacity-60';

                                            return (
                                                <div key={optionIndex} className={`rounded-xl border-2 p-5 font-mono font-bold text-lg ${optionClass}`}>
                                                    <span className="font-bold mr-3">{String.fromCharCode(65 + optionIndex)}.</span>
                                                    {option}
                                                    {isCorrectOption && <p className="mt-3 text-sm font-black text-green-700 uppercase tracking-widest">Correct answer</p>}
                                                    {isSelectedOption && !isCorrectOption && <p className="mt-3 text-sm font-black text-red-700 uppercase tracking-widest">Your response</p>}
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
                            className="px-10 py-4 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-xl rounded-xl transition shadow-sm"
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
                <div className="min-h-screen bg-bg flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-brand-lightest p-10 rounded-[2rem] border-2 border-brand-light shadow-sm text-center">
                        <div className="inline-flex p-4 bg-brand-light text-brand rounded-full mb-6">
                            <BookOpen className="w-10 h-10" />
                        </div>
                        <h1 className="text-3xl font-bold font-mono tracking-tighter text-black mb-4">Teacher View</h1>
                        <p className="text-gray-600 font-mono mb-8">As a teacher, you cannot take the quiz. You can view the quiz details or results from your dashboard.</p>
                        <button
                            onClick={() => router.push('/dashboard/teacher')}
                            className="w-full px-8 py-4 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-xl rounded-xl inline-flex items-center justify-center transition shadow-sm"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-bg flex items-center justify-center p-6">
                <div className="max-w-3xl w-full bg-brand-lightest p-10 rounded-[2rem] border-2 border-brand-light shadow-sm text-center">
                    <div className="inline-flex p-4 bg-brand-light text-brand rounded-full mb-6">
                        <BookOpen className="w-10 h-10" />
                    </div>
                    <h1 className="text-5xl font-black font-mono tracking-tighter text-black mb-4">{quiz.title}</h1>
                    <p className="text-gray-600 font-mono text-lg mb-10">{quiz.description || 'Complete all questions before the timer runs out.'}</p>

                    <div className="flex justify-center gap-12 mb-10 border-y-2 border-brand-light border-dashed py-8">
                        <div className="flex flex-col items-center">
                            <span className="text-gray-500 text-sm font-bold font-mono uppercase tracking-widest mb-2">Questions</span>
                            <span className="text-4xl font-black font-mono text-black">{questions.length}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-gray-500 text-sm font-bold font-mono uppercase tracking-widest mb-2">Total Time</span>
                            <span className="text-4xl font-black font-mono text-black flex items-center">
                                <Clock className="w-8 h-8 mr-2 text-brand" />
                                {quiz.total_duration_minutes || 45} <span className="text-xl ml-2 text-gray-500">mins</span>
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleStartQuiz}
                        className="w-full sm:w-auto px-12 py-5 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-2xl rounded-xl inline-flex items-center justify-center transition shadow-sm"
                    >
                        <Play className="w-8 h-8 mr-3 fill-current" />
                        Begin Quiz
                    </button>
                </div>
            </div>
        );
    }

    if (quizState === 'active') {
        const currentQuestion = questions[currentQuestionIndex];
        const isLastQuestion = currentQuestionIndex === questions.length - 1;
        const isFirstQuestion = currentQuestionIndex === 0;

        return (
            <div className="min-h-screen bg-bg p-6 flex flex-col items-center">
                {/* Top Bar with Timer */}
                <div className="w-full max-w-4xl bg-brand-lightest p-5 rounded-2xl shadow-sm border-2 border-brand-light flex justify-between items-center mb-8">
                    <span className="font-bold font-mono text-xl text-black">
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </span>
                    <div className={`flex items-center font-black font-mono text-xl px-5 py-3 rounded-xl transition ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-brand-light text-black'}`}>
                        <Clock className="w-6 h-6 mr-3" />
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Question Card */}
                <div className="w-full max-w-4xl bg-brand-lightest p-10 rounded-[2rem] shadow-sm border-2 border-brand-light">
                    <h2 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-black mb-10 leading-snug">
                        {currentQuestion.question_text}
                    </h2>

                    <div className="space-y-4">
                        {currentQuestion.options.map((option: string, index: number) => {
                            const isSelected = answers[currentQuestion.id] === index;
                            return (
                                <button
                                    key={index}
                                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: index }))}
                                    className={`w-full text-left p-6 rounded-xl border-2 font-mono text-xl transition-all ${isSelected
                                        ? 'border-brand bg-brand text-black font-black shadow-sm transform scale-[1.01]'
                                        : 'border-brand-light hover:border-brand bg-white text-gray-700 hover:bg-brand-lightest font-bold'
                                        }`}
                                >
                                    <span className={`inline-block w-10 h-10 text-center leading-[2.3rem] rounded-full mr-4 border-2 ${isSelected ? 'bg-black text-brand border-black' : 'bg-brand-light text-black border-transparent'}`}>
                                        {String.fromCharCode(65 + index)}
                                    </span>
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Navigation Controls */}
                <div className="w-full max-w-4xl flex justify-between mt-8">
                    <button
                        disabled={isFirstQuestion}
                        onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                        className="px-8 py-4 bg-white border-2 border-brand-light text-black font-bold font-mono text-lg rounded-xl hover:bg-brand-lightest disabled:opacity-40 transition"
                    >
                        Previous
                    </button>

                    {!isLastQuestion ? (
                        <button
                            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                            className="px-8 py-4 bg-black hover:bg-gray-800 text-white font-bold font-mono text-lg rounded-xl transition shadow-sm"
                        >
                            Next Question
                        </button>
                    ) : (
                        <button
                            onClick={handleCompleteQuiz}
                            className="px-10 py-4 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-xl rounded-xl transition shadow-sm"
                        >
                            Submit Quiz
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (quizState === 'submitting') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg">
                <p className="text-brand font-bold font-mono text-xl animate-pulse">Grading your answers and submitting...</p>
            </div>
        );
    }

    if (quizState === 'completed') {
        const percentage = Math.round((finalScore / questions.length) * 100);

        return (
            <div className="min-h-screen bg-bg flex items-center justify-center p-6">
                <div className="max-w-xl w-full bg-brand-lightest p-12 rounded-[2rem] border-2 border-brand-light shadow-sm text-center">
                    <div className="inline-flex p-5 bg-brand-light text-brand rounded-full mb-6">
                        <BookOpen className="w-12 h-12" />
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-black mb-4">Quiz Complete!</h2>
                    <p className="text-gray-600 font-mono text-lg mb-10">Your responses have been successfully recorded.</p>

                    <div className="bg-white rounded-2xl p-8 mb-10 border-2 border-brand-light border-dashed">
                        <div className="text-7xl font-black font-mono text-brand mb-4">{percentage}%</div>
                        <p className="text-gray-600 font-bold font-mono text-xl">
                            You scored {finalScore} out of {questions.length} correct
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="w-full py-5 bg-brand hover:bg-[#c47155] text-black font-black font-mono text-2xl rounded-xl transition shadow-sm"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return null;
}