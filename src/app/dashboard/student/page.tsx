'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { LogOut, Play, Hash } from 'lucide-react';

export default function StudentDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [roomCode, setRoomCode] = useState('');
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
            </main>
        </div>
    );
}