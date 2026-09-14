'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, BarChart2, LogOut } from 'lucide-react';

export default function TeacherDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
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

            if (!profile || profile.role !== 'teacher') {
                router.push('/dashboard/student');
                return;
            }

            setUserName(profile.full_name);
            setLoading(false);
        }

        checkAuth();
    }, [router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 font-medium">Verifying teacher authorization...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Navigation */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
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
                        <p className="text-gray-500 mt-1">Manage study materials, quizzes, and real-time sessions.</p>
                    </div>
                    <button
                        onClick={() => alert('Quiz Creation Pipeline will be built in Phase 3')}
                        className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Create New Quiz
                    </button>
                </div>

                {/* Dashboard Grid Placeholder */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Quizzes</p>
                            <h3 className="text-2xl font-bold text-gray-900">0</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                            <BarChart2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Sessions</p>
                            <h3 className="text-2xl font-bold text-gray-900">0</h3>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}