'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { BookOpen, Users, CheckCircle, BarChart2, ArrowLeft, Loader2 } from 'lucide-react';

export default function TeacherQuizDetails({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<any>(null);
    const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
    const [studentScores, setStudentScores] = useState<any[]>([]);

    useEffect(() => {
        async function fetchQuizDetails() {
            try {
                // 1. Fetch Quiz Info
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

                // 2. Fetch questions
                const { data: questions } = await supabase
                    .from('questions')
                    .select('*')
                    .eq('quiz_id', quizId)
                    .order('order_index', { ascending: true });

                setQuizQuestions(questions || []);

                if (questions && questions.length > 0) {
                    const questionIds = questions.map(q => q.id);

                    // 3. Fetch submissions for these questions
                    const { data: submissionsData } = await supabase
                        .from('submissions')
                        .select('student_id, score_awarded, is_correct, profiles(full_name)')
                        .in('question_id', questionIds);

                    if (submissionsData) {
                        // Aggregate scores per student
                        const scoresMap: Record<string, { name: string, score: number, correctAnswers: number }> = {};
                        
                        submissionsData.forEach((sub: any) => {
                            const sId = sub.student_id;
                            if (!scoresMap[sId]) {
                                scoresMap[sId] = { 
                                    name: sub.profiles?.full_name || 'Unknown Student', 
                                    score: 0,
                                    correctAnswers: 0 
                                };
                            }
                            scoresMap[sId].score += sub.score_awarded;
                            if (sub.is_correct) {
                                scoresMap[sId].correctAnswers += 1;
                            }
                        });

                        // Convert map to array and sort by score descending
                        const scoresArray = Object.values(scoresMap).sort((a, b) => b.score - a.score);
                        setStudentScores(scoresArray);
                    } else {
                        setStudentScores([]);
                    }
                } else {
                    setStudentScores([]);
                }
            } catch (error) {
                console.error('Error fetching quiz details', error);
            } finally {
                setLoading(false);
            }
        }

        fetchQuizDetails();
    }, [quizId, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Top Navigation */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center sticky top-0 z-10">
                <button
                    onClick={() => router.push('/dashboard/teacher')}
                    className="flex items-center text-gray-600 hover:text-indigo-600 transition font-medium mr-6"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Dashboard
                </button>
                <div className="h-6 w-px bg-gray-300 mr-6"></div>
                <h1 className="text-xl font-bold text-gray-900">{quiz.title}</h1>
                <span className={`ml-4 text-xs px-2.5 py-1 rounded-md font-semibold uppercase ${quiz.type === 'static' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {quiz.type || 'unknown'}
                </span>
            </nav>

            <main className="max-w-6xl mx-auto p-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Left Column: Questions List */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 flex items-center text-lg">
                                <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
                                Questions & Answers
                            </h4>
                            <span className="text-sm font-medium bg-gray-200 text-gray-700 px-3 py-1 rounded-full">{quizQuestions.length} Total</span>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {quizQuestions.map((q, idx) => (
                                <div key={q.id} className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-100 transition">
                                    <p className="font-semibold text-gray-900 mb-4 text-lg">
                                        <span className="text-indigo-600 mr-2">{idx + 1}.</span>
                                        {q.question_text}
                                    </p>
                                    <div className="space-y-2">
                                        {q.options.map((opt: string, optIdx: number) => {
                                            const isCorrect = q.correct_option_index === optIdx;
                                            return (
                                                <div 
                                                    key={optIdx} 
                                                    className={`p-3 rounded-lg flex items-start text-sm ${isCorrect ? 'bg-green-50 border border-green-200 text-green-900 font-medium' : 'bg-gray-50 border border-transparent text-gray-700'}`}
                                                >
                                                    {isCorrect && <CheckCircle className="w-5 h-5 mr-3 mt-0.5 text-green-600 shrink-0" />}
                                                    {!isCorrect && <span className="w-5 h-5 mr-3 shrink-0"></span>}
                                                    <span className="leading-relaxed">{opt}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Student Scores */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 flex items-center text-lg">
                                <Users className="w-5 h-5 mr-2 text-indigo-600" />
                                Student Performance
                            </h4>
                            <span className="text-sm font-medium bg-gray-200 text-gray-700 px-3 py-1 rounded-full">{studentScores.length} Submissions</span>
                        </div>
                        <div className="p-0 overflow-y-auto flex-1">
                            {studentScores.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                                    <BarChart2 className="w-16 h-16 mb-4 opacity-20 text-indigo-600" />
                                    <p className="text-lg">No students have taken this quiz yet.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Correct</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {studentScores.map((student, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-50/50 transition">
                                                <td className="px-6 py-5 font-medium text-gray-900 flex items-center text-base">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-4 text-lg border border-indigo-200 shadow-sm">
                                                        {student.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {student.name}
                                                </td>
                                                <td className="px-6 py-5 text-right text-gray-600 text-base">
                                                    <span className="font-semibold text-gray-900">{student.correctAnswers}</span> / {quizQuestions.length}
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-indigo-600 text-lg">
                                                    {student.score}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
