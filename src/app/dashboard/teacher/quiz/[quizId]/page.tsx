'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { BookOpen, Users, CheckCircle, BarChart2, ArrowLeft, Clock, Calendar } from 'lucide-react';
import DashboardNavbar from '@/components/DashboardNavbar';
import DashboardBackground from '@/components/DashboardBackground';
import DashboardLoading from '@/components/DashboardLoading';
import { getCachedProfile, setCachedProfile, markClientHydrated, getCachedProfileDirect } from '@/lib/authCache';

const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return '';
    }
};

export default function TeacherQuizDetails({ params }: { params: Promise<{ quizId: string }> }) {
    const { quizId } = use(params);
    const router = useRouter();

    const cached = getCachedProfile();
    const [userName, setUserName] = useState(cached?.full_name || '');
    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<any>(null);
    const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
    const [studentScores, setStudentScores] = useState<any[]>([]);

    useEffect(() => {
        markClientHydrated();
        const storedProfile = getCachedProfileDirect();
        if (storedProfile) {
            setUserName(storedProfile.full_name);
        }

        async function fetchQuizDetails() {
            try {
                // Fetch User
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, role')
                        .eq('id', user.id)
                        .single();

                    if (profile) {
                        setUserName(profile.full_name);
                        setCachedProfile({
                            id: user.id,
                            full_name: profile.full_name,
                            role: profile.role,
                        });
                    }
                }

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
                                    correctAnswers: 0,
                                };
                            }
                            scoresMap[sId].score += (sub.score_awarded || 0);
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

    const handleSignOut = async () => {
        setCachedProfile(null);
        await supabase.auth.signOut();
        router.push('/auth');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fff5f0] flex items-center justify-center relative font-mono">
                <DashboardBackground />
                <DashboardLoading />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#fff5f0] text-foreground font-mono relative flex flex-col selection:bg-[#E86F47] selection:text-white pb-16">
            {/* Live Circuit Wallpaper */}
            <DashboardBackground />

            {/* Shared Top Navigation */}
            <DashboardNavbar
                role="teacher"
                userName={userName}
                onSignOut={handleSignOut}
                activeTab="dashboard"
            />

            <main className="max-w-6xl w-full mx-auto p-6 space-y-6 mt-4 relative z-10">
                {/* Back Link & Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <button
                        onClick={() => router.push('/dashboard/teacher')}
                        className="inline-flex items-center gap-2 text-sm font-bold font-mono text-[#E86F47] hover:text-black transition px-4 py-2 rounded-full bg-white/85 backdrop-blur-md border border-[#E86F47]/20 shadow-xs cursor-pointer self-start"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3.5 py-1.5 rounded-xl bg-brand text-black font-mono font-bold text-xs uppercase tracking-wider shadow-2xs">
                            {quiz.type || 'static'}
                        </span>
                        {quiz.total_duration_minutes && (
                            <span className="px-3.5 py-1.5 rounded-xl bg-white border-2 border-brand-light font-mono text-xs font-bold text-black flex items-center gap-1.5 shadow-2xs">
                                <Clock className="w-3.5 h-3.5 text-brand" />
                                {quiz.total_duration_minutes} mins timer
                            </span>
                        )}
                        {quiz.type === 'static' && quiz.available_from && quiz.available_until && (
                            <span className="px-3.5 py-1.5 rounded-xl bg-white border-2 border-brand-light font-mono text-xs font-bold text-[#5c544e] flex items-center gap-1.5 shadow-2xs">
                                <Calendar className="w-3.5 h-3.5 text-brand" />
                                Window: {formatDisplayDate(quiz.available_from)} - {formatDisplayDate(quiz.available_until)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Quiz Title Banner */}
                <div className="bg-white/90 backdrop-blur-md p-6 sm:p-8 rounded-2xl border-2 border-brand-light shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#8c827a] mb-1">Quiz Overview</p>
                        <h1 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-black truncate" title={quiz.title}>
                            {quiz.title}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="px-4 py-2 bg-[#fbf5f0] border-2 border-brand-light rounded-xl text-center">
                            <span className="block text-2xl font-black font-mono text-black">{quizQuestions.length}</span>
                            <span className="text-[11px] font-mono font-bold text-[#8c827a] uppercase tracking-wider">Questions</span>
                        </div>
                        <div className="px-4 py-2 bg-[#fbf5f0] border-2 border-brand-light rounded-xl text-center">
                            <span className="block text-2xl font-black font-mono text-brand">{studentScores.length}</span>
                            <span className="text-[11px] font-mono font-bold text-[#8c827a] uppercase tracking-wider">Submissions</span>
                        </div>
                    </div>
                </div>

                {/* 2-Column Split: Questions (Left) & Performance (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Left Column: Questions List */}
                    <div className="bg-white/90 backdrop-blur-md rounded-2xl border-2 border-brand-light shadow-sm overflow-hidden flex flex-col h-[720px]">
                        <div className="p-5 border-b-2 border-brand-light bg-[#fbf5f0] flex items-center justify-between">
                            <h4 className="font-bold text-black flex items-center text-lg font-mono">
                                <BookOpen className="w-5 h-5 mr-2.5 text-brand" />
                                Questions & Answers
                            </h4>
                            <span className="text-xs font-bold font-mono bg-white border border-brand-light text-black px-3 py-1 rounded-xl shadow-2xs">
                                {quizQuestions.length} Total
                            </span>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {quizQuestions.map((q, idx) => (
                                <div key={q.id} className="p-5 bg-white rounded-xl border-2 border-brand-light/70 shadow-2xs hover:border-brand transition">
                                    <p className="font-bold text-black mb-4 text-base font-mono leading-relaxed">
                                        <span className="text-brand mr-2 font-black">{idx + 1}.</span>
                                        {q.question_text}
                                    </p>
                                    <div className="space-y-2.5">
                                        {q.options.map((opt: string, optIdx: number) => {
                                            const isCorrect = q.correct_option_index === optIdx;
                                            return (
                                                <div
                                                    key={optIdx}
                                                    className={`p-3.5 rounded-xl flex items-start text-sm transition ${
                                                        isCorrect
                                                            ? 'bg-green-50 border-2 border-green-300 text-green-950 font-bold shadow-2xs'
                                                            : 'bg-[#fbf5f0]/80 border-2 border-brand-light/40 text-[#44403c]'
                                                    }`}
                                                >
                                                    {isCorrect ? (
                                                        <CheckCircle className="w-5 h-5 mr-3 mt-0.5 text-green-600 shrink-0" />
                                                    ) : (
                                                        <span className="w-5 h-5 mr-3 shrink-0"></span>
                                                    )}
                                                    <span className="leading-relaxed">{opt}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {q.explanation && (
                                        <p className="mt-3 text-xs text-[#8c827a] font-mono italic">
                                            💡 {q.explanation}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Student Scores */}
                    <div className="bg-white/90 backdrop-blur-md rounded-2xl border-2 border-brand-light shadow-sm overflow-hidden flex flex-col h-[720px]">
                        <div className="p-5 border-b-2 border-brand-light bg-[#fbf5f0] flex items-center justify-between">
                            <h4 className="font-bold text-black flex items-center text-lg font-mono">
                                <Users className="w-5 h-5 mr-2.5 text-brand" />
                                Student Performance
                            </h4>
                            <span className="text-xs font-bold font-mono bg-white border border-brand-light text-black px-3 py-1 rounded-xl shadow-2xs">
                                {studentScores.length} Submissions
                            </span>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1">
                            {studentScores.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-[#8c827a] p-8 text-center">
                                    <BarChart2 className="w-16 h-16 mb-4 opacity-30 text-brand" />
                                    <p className="text-lg font-bold text-black font-mono">No students have taken this quiz yet.</p>
                                    <p className="text-sm font-mono text-[#8c827a] mt-1">Student submissions and scores will appear here automatically.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#fbf5f0] sticky top-0 z-10 border-b-2 border-brand-light">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-[#8c827a] uppercase tracking-wider font-mono">Student Name</th>
                                            <th className="px-6 py-4 text-xs font-bold text-[#8c827a] uppercase tracking-wider text-right font-mono">Correct</th>
                                            <th className="px-6 py-4 text-xs font-bold text-[#8c827a] uppercase tracking-wider text-right font-mono">Total Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-light/50">
                                        {studentScores.map((student, idx) => (
                                            <tr key={idx} className="hover:bg-brand-lightest/70 transition">
                                                <td className="px-6 py-4 font-bold text-black flex items-center text-base font-mono">
                                                    <div className="w-10 h-10 rounded-full bg-brand/20 text-brand flex items-center justify-center font-black mr-4 text-base border-2 border-brand-light shadow-2xs">
                                                        {student.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {student.name}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-700 text-base font-mono">
                                                    <span className="font-black text-black">{student.correctAnswers}</span> / {quizQuestions.length}
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-brand text-2xl font-mono">
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
