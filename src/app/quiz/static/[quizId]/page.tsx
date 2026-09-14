'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Clock, BookOpen, Play } from 'lucide-react';

export default function StaticQuizPage({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [quizState, setQuizState] = useState<'intro' | 'active' | 'completed'>('intro');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [timeLeft, setTimeLeft] = useState<number>(0);

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

    const handleCompleteQuiz = () => {
        setQuizState('completed');
        // We will build the database submission logic in Step 3
        alert('Quiz completed! Submitting answers...');
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    useEffect(() => {
        async function fetchQuizData() {
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
            setLoading(false);
        }

        fetchQuizData();
    }, [quizId, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 font-medium animate-pulse">Loading quiz materials...</p>
            </div>
        );
    }

    // Render the Intro Screen
    if (quizState === 'intro') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center">
                    <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
                    <p className="text-gray-500 mb-8">{quiz.description || 'Complete all questions before the timer runs out.'}</p>

                    <div className="flex justify-center gap-8 mb-8">
                        <div className="flex flex-col items-center">
                            <span className="text-gray-500 text-sm font-medium mb-1">Questions</span>
                            <span className="text-xl font-bold text-gray-900">{questions.length}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-gray-500 text-sm font-medium mb-1">Total Time</span>
                            <span className="text-xl font-bold text-gray-900 flex items-center">
                                <Clock className="w-5 h-5 mr-1 text-indigo-600" />
                                {quiz.total_duration_minutes || 45} mins
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleStartQuiz}
                        className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl inline-flex items-center justify-center transition"
                    >
                        <Play className="w-5 h-5 mr-2" />
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
            <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
                {/* Top Bar with Timer */}
                <div className="w-full max-w-3xl bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center mb-6">
                    <span className="font-semibold text-gray-700">
                        Question {currentQuestionIndex + 1} of {questions.length}
                    </span>
                    <div className={`flex items-center font-bold px-4 py-2 rounded-lg ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-700'}`}>
                        <Clock className="w-5 h-5 mr-2" />
                        {formatTime(timeLeft)}
                    </div>
                </div>

                {/* Question Card */}
                <div className="w-full max-w-3xl bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 leading-relaxed">
                        {currentQuestion.question_text}
                    </h2>

                    <div className="space-y-3">
                        {currentQuestion.options.map((option: string, index: number) => {
                            const isSelected = answers[currentQuestion.id] === index;
                            return (
                                <button
                                    key={index}
                                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: index }))}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition ${isSelected
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                                        : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                                        }`}
                                >
                                    <span className="inline-block w-8 h-8 text-center leading-8 rounded-full bg-white border border-gray-300 mr-3">
                                        {String.fromCharCode(65 + index)}
                                    </span>
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Navigation Controls */}
                <div className="w-full max-w-3xl flex justify-between mt-6">
                    <button
                        disabled={isFirstQuestion}
                        onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                        className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition"
                    >
                        Previous
                    </button>

                    {!isLastQuestion ? (
                        <button
                            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition"
                        >
                            Next Question
                        </button>
                    ) : (
                        <button
                            onClick={handleCompleteQuiz}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition"
                        >
                            Submit Quiz
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return <div>Quiz Completed</div>;
}