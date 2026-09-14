'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Clock, BookOpen, Play } from 'lucide-react';

export default function StaticQuizPage({ params }: { params: { quizId: string } }) {
    const { quizId } = params;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [quizState, setQuizState] = useState<'intro' | 'active' | 'completed'>('intro');

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
                        onClick={() => setQuizState('active')}
                        className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl inline-flex items-center justify-center transition"
                    >
                        <Play className="w-5 h-5 mr-2" />
                        Begin Quiz
                    </button>
                </div>
            </div>
        );
    }

    // Placeholder for the active quiz interface (Sub-step 2)
    if (quizState === 'active') {
        return <div>Quiz is active! (Timer and questions will go here in Step 2)</div>;
    }

    return <div>Quiz Completed</div>;
}