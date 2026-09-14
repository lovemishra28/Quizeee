'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AuthForm() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState < 'teacher' | 'student' > ('student');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setLoading(true);

        if (isSignUp) {
            // Handle User Registration
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role,
                    },
                },
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                // Redirect based on selected role
                router.push(role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
            }
        } else {
            // Handle User Login
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                // Fetch profile to determine role redirect
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                const userRole = profile?.role || 'student';
                router.push(userRole === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
            }
        }
        setLoading(false);
    };

    return (
        <div className="max-w-md w-full mx-auto p-6 bg-white rounded-xl shadow-md border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
                {isSignUp ? 'Create a Quizeee Account' : 'Welcome Back'}
            </h2>

            {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="John Doe"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="you@example.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="••••••••"
                    />
                </div>

                {isSignUp && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">I am a...</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRole('student')}
                                className={`py-2 rounded-lg font-medium border text-sm ${role === 'student'
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                            >
                                Student
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole('teacher')}
                                className={`py-2 rounded-lg font-medium border text-sm ${role === 'teacher'
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                            >
                                Teacher
                            </button>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
                >
                    {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
                </button>
            </form>

            <div className="mt-4 text-center">
                <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm text-indigo-600 hover:underline font-medium"
                >
                    {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                </button>
            </div>
        </div>
    );
}