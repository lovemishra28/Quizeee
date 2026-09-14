'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { LogOut, Play, Hash } from 'lucide-react';

export default function StudentDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [userId, setUserId] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [staticQuizzes, setStaticQuizzes] = useState<any[]>([]);
    const [completedQuizIds, setCompletedQuizIds] = useState<Set<string>>(new Set());
    const router = useRouter();

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

            if (!profile) {
                router.push('/auth');
                return;
            }

            setUserName(profile.full_name);
            setUserId(session.user.id);

            // Fetch static quizzes
            const { data: quizzesData } = await supabase
                .from('quizzes')
                .select('*')
                .eq('type', 'static')
                .order('created_at', { ascending: false });

            if (quizzesData) {
                setStaticQuizzes(quizzesData);
            }

            // Fetch user's completed submissions to find completed quizzes
            const { data: submissionsData } = await supabase
                .from('submissions')
                .select('quiz_sessions(quiz_id)')
                .eq('student_id', session.user.id);
            
            if (submissionsData) {
                const completed = new Set<string>();
                submissionsData.forEach((sub: any) => {
                    if (sub.quiz_sessions && sub.quiz_sessions.quiz_id) {
                        completed.add(sub.quiz_sessions.quiz_id);
                    }
                });
                setCompletedQuizIds(completed);
            }

            setLoading(false);
        }

        checkAuth();
    }, [router]);

    const handleJoinSession = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomCode.length !== 6) {
            alert('Please enter a valid 6-digit room code');
            return;
        }
        // Session joining logic will be wired in Phase 5
        alert(`Joining session room: ${roomCode}`);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 font-medium">Verifying student authorization...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navigation */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <span className="text-2xl font-black text-indigo-600">Quizeee</span>
                    <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                        Student Hub
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
            <main className="max-w-xl mx-auto p-6 mt-12">
                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center">
                    <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4">
                        <Hash className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Join a Live Quiz Session</h2>
                    <p className="text-gray-500 text-sm mb-6">
                        Enter the 6-digit room code displayed on your teacher's projector screen.
                    </p>

                    <form onSubmit={handleJoinSession} className="space-y-4">
                        <input
                            type="text"
                            maxLength={6}
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            placeholder="e.g. 849201"
                            className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        />
                        <button
                            type="submit"
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center transition"
                        >
                            <Play className="w-5 h-5 mr-2" />
                            Enter Game Room
                        </button>
                    </form>
                </div>

                {/* Available Static Quizzes */}
                <div className="mt-12">
                    <h3 className="text-xl font-bold text-gray-900 mb-6">Available Static Quizzes</h3>
                    {staticQuizzes.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No static quizzes available right now.</p>
                    ) : (
                        <div className="grid gap-4">
                            {staticQuizzes.map((quiz) => {
                                const isCompleted = completedQuizIds.has(quiz.id);
                                return (
                                    <div key={quiz.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900">{quiz.title}</h4>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {quiz.total_duration_minutes || 45} mins • Self-paced
                                            </p>
                                        </div>
                                        <div>
                                            {isCompleted ? (
                                                <span className="px-4 py-2 bg-green-100 text-green-700 font-semibold rounded-lg text-sm">
                                                    Completed
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => router.push(`/quiz/static/${quiz.id}`)}
                                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition text-sm"
                                                >
                                                    Take Quiz
                                                </button>
                                            )}
                                        </div>
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