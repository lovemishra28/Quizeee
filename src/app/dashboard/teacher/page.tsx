'use client';
import QuizCreator from '@/components/QuizCreator';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, BarChart2, LogOut, ChevronDown, ChevronUp, Users, CheckCircle } from 'lucide-react';

export default function TeacherDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userId, setUserId] = useState('');
    const [quizzes, setQuizzes] = useState<any[]>([]);
    
    const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
    const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
    const [studentScores, setStudentScores] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const router = useRouter();

    const fetchQuizzes = async (uId: string) => {
        const { data } = await supabase
            .from('quizzes')
            .select('*')
            .eq('teacher_id', uId)
            .order('created_at', { ascending: false });
        
        if (data) {
            setQuizzes(data);
        }
    };

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

    const handleSelectQuiz = async (quiz: any) => {
        if (selectedQuiz?.id === quiz.id) {
            setSelectedQuiz(null); // Toggle off
            return;
        }

        setSelectedQuiz(quiz);
        setDetailsLoading(true);

        try {
            // 1. Fetch questions
            const { data: questions } = await supabase
                .from('questions')
                .select('*')
                .eq('quiz_id', quiz.id)
                .order('order_index', { ascending: true });

            setQuizQuestions(questions || []);

            if (questions && questions.length > 0) {
                const questionIds = questions.map(q => q.id);

                // 2. Fetch submissions for these questions
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
            setDetailsLoading(false);
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
                                const isSelected = selectedQuiz?.id === quiz.id;

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
                                                </div>
                                            </div>
                                            <div className="text-gray-400">
                                                {isSelected ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="border-t border-gray-200 bg-gray-50 p-6 space-y-6">
                                                {detailsLoading ? (
                                                    <div className="flex justify-center py-8">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        
                                                        {/* Left Column: Questions List */}
                                                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                                                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                                                <h4 className="font-bold text-gray-900 flex items-center">
                                                                    <BookOpen className="w-4 h-4 mr-2 text-indigo-600" />
                                                                    Questions & Answers
                                                                </h4>
                                                                <span className="text-sm text-gray-500">{quizQuestions.length} Total</span>
                                                            </div>
                                                            <div className="p-4 overflow-y-auto flex-1 space-y-4">
                                                                {quizQuestions.map((q, idx) => (
                                                                    <div key={q.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                                        <p className="font-semibold text-gray-900 mb-2">
                                                                            <span className="text-indigo-600 mr-2">{idx + 1}.</span>
                                                                            {q.question_text}
                                                                        </p>
                                                                        <div className="space-y-1 mt-3">
                                                                            {q.options.map((opt: string, optIdx: number) => {
                                                                                const isCorrect = q.correct_option_index === optIdx;
                                                                                return (
                                                                                    <div 
                                                                                        key={optIdx} 
                                                                                        className={`p-2 rounded flex items-start text-sm ${isCorrect ? 'bg-green-100 text-green-800 font-medium' : 'text-gray-600'}`}
                                                                                    >
                                                                                        {isCorrect && <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-600 shrink-0" />}
                                                                                        {!isCorrect && <span className="w-4 h-4 mr-2 shrink-0"></span>}
                                                                                        <span>{opt}</span>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Right Column: Student Scores */}
                                                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                                                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                                                <h4 className="font-bold text-gray-900 flex items-center">
                                                                    <Users className="w-4 h-4 mr-2 text-indigo-600" />
                                                                    Student Performance
                                                                </h4>
                                                                <span className="text-sm text-gray-500">{studentScores.length} Submissions</span>
                                                            </div>
                                                            <div className="p-0 overflow-y-auto flex-1">
                                                                {studentScores.length === 0 ? (
                                                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                                                                        <BarChart2 className="w-12 h-12 mb-2 opacity-20" />
                                                                        <p>No students have taken this quiz yet.</p>
                                                                    </div>
                                                                ) : (
                                                                    <table className="w-full text-left border-collapse">
                                                                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-100">
                                                                            <tr>
                                                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Name</th>
                                                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Correct</th>
                                                                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Score</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100">
                                                                            {studentScores.map((student, idx) => (
                                                                                <tr key={idx} className="hover:bg-gray-50 transition">
                                                                                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center">
                                                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3 text-sm">
                                                                                            {student.name.charAt(0).toUpperCase()}
                                                                                        </div>
                                                                                        {student.name}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-right text-gray-600">
                                                                                        {student.correctAnswers} / {quizQuestions.length}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">
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
                                                )}
                                            </div>
                                        )}
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