'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, CheckSquare } from 'lucide-react';
import Navbar from '@/components/Navbar';
import DashboardLoading from '@/components/DashboardLoading';
import DashboardBackground from '@/components/DashboardBackground';
import { setCachedProfile, getCachedProfileDirect, setRememberMeActive } from '@/lib/authCache';
import { safeAuthReturnPath } from '@/lib/authRedirect';
import Image from 'next/image';

interface AuthFormProps {
    initialSignUp?: boolean;
    initialRole?: 'teacher' | 'student';
    returnTo?: string;
    initialReset?: boolean;
}

export default function AuthForm({ initialSignUp = false, initialRole = 'teacher', returnTo, initialReset = false }: AuthFormProps) {
    const [isSignUp, setIsSignUp] = useState(initialSignUp);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'teacher' | 'student'>(initialRole);
    const [errorMsg, setErrorMsg] = useState('');
    const [infoMsg, setInfoMsg] = useState('');
    const [isRecovering, setIsRecovering] = useState(false);
    const [isResetting, setIsResetting] = useState(initialReset);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [checkingExisting, setCheckingExisting] = useState(!initialReset);
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        async function checkExistingAuth() {
            if (initialReset) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (cancelled) return;
            if (session && !session.user.user_metadata?.is_guest) {
                const cached = getCachedProfileDirect();
                if (cached?.role && cached.id === session.user.id) {
                    router.replace(safeAuthReturnPath(returnTo) || (cached.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student'));
                    return;
                }
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, full_name')
                    .eq('id', session.user.id)
                    .single();
                const userRole = profile?.role || 'student';
                setCachedProfile({
                    id: session.user.id,
                    full_name: profile?.full_name || '',
                    role: userRole,
                });
                if (!cancelled) router.replace(safeAuthReturnPath(returnTo) || (userRole === 'teacher' ? '/dashboard/teacher' : '/dashboard/student'));
                return;
            }
            if (!cancelled) setCheckingExisting(false);
        }
        void checkExistingAuth().catch(() => { if (!cancelled) setCheckingExisting(false); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsResetting(true); setIsRecovering(false); setIsSignUp(false); setCheckingExisting(false);
            }
        });
        return () => { cancelled = true; subscription.unsubscribe(); };
    }, [router, returnTo, initialReset]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setInfoMsg('');
        setLoading(true);
        try {
            if (isRecovering) {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth?mode=reset` });
                if (error) throw error;
                setInfoMsg('If an account exists for this email, you will receive a password reset link.');
                return;
            }
            if (isResetting) {
                if (password.length < 8 || password !== confirmPassword) throw new Error('Use at least 8 characters and make sure the passwords match.');
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) throw new Error('This reset link is invalid or expired. Request a new recovery email.');
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                await supabase.auth.signOut(); setCachedProfile(null);
                setIsResetting(false); setIsSignUp(false); setPassword(''); setConfirmPassword('');
                window.history.replaceState(null, '', '/auth');
                setInfoMsg('Your password has been updated. Sign in with your new password.');
                return;
            }
            setRememberMeActive(rememberMe);
            if (isSignUp) {
                if (!fullName.trim() || fullName.trim().length > 100) throw new Error('Enter a full name of at most 100 characters.');
                const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim(), role } } });
                if (error) throw error;
                if (!data.session) {
                    setPassword(''); setInfoMsg('Check your email to confirm your account before signing in.');
                    return;
                }
                setCachedProfile({ id: data.session.user.id, full_name: fullName.trim(), role });
                router.push(safeAuthReturnPath(returnTo) || (role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student'));
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;
                if (!data.user) throw new Error('Unable to sign in. Please try again.');
                const { data: profile, error: profileError } = await supabase.from('profiles').select('role, full_name').eq('id', data.user.id).single();
                if (profileError || !profile) throw new Error('Unable to load your profile. Please try signing in again.');
                const userRole = profile.role === 'teacher' ? 'teacher' : 'student';
                setCachedProfile({ id: data.user.id, full_name: profile.full_name || '', role: userRole });
                router.push(safeAuthReturnPath(returnTo) || (userRole === 'teacher' ? '/dashboard/teacher' : '/dashboard/student'));
            }
        } catch (error) {
            setErrorMsg(error instanceof Error ? error.message : 'Unable to complete this request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const changeMode = (signUp: boolean) => {
        setIsSignUp(signUp); setIsRecovering(false); setIsResetting(false); setErrorMsg(''); setInfoMsg('');
    };

    if (checkingExisting) {
        return (
            <div className="min-h-screen bg-[#fff5f0] flex items-center justify-center relative overflow-hidden font-mono">
                <DashboardBackground />
                <DashboardLoading />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#fff5f0]">
            {/* Shared Unified Navbar */}
            <Navbar isSignUp={isSignUp} onModeChange={changeMode} />

            {/* Main Content */}
            <div id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center p-4 sm:p-8">
                <div className="w-full max-w-5xl bg-white rounded-3xl shadow-sm border border-[#f5c4b5] overflow-hidden flex flex-col md:flex-row min-h-[600px]">

                    {/* Left Side - Illustration Panel */}
                    <div aria-hidden="true" className="hidden md:flex md:w-[45%] bg-[#faebe3] p-8 sm:p-10 lg:p-12 flex-col justify-between relative overflow-hidden">
                        {/* Big Prominent quizeee Brand Logo */}
                        <div className="relative z-10 pt-2">
                            <Image
                                src="/quizeee-hero.png"
                                alt="quizeee"
                                width={2172}
                                height={724}
                                sizes="256px"
                                className="w-56 sm:w-64 h-auto select-none pointer-events-none drop-shadow-xs"
                            />
                        </div>

                        {/* Centered & Elevated PC / Laptop Illustration */}
                        <div className="relative z-10 flex-1 flex items-center justify-center py-6">
                            <div className="relative w-[300px] h-[240px] pointer-events-none scale-95 sm:scale-100">
                                {/* Accent spark marks */}
                                <div className="absolute top-2 right-24 w-1.5 h-5 bg-[#E86F47] transform rotate-45 rounded-full opacity-80"></div>
                                <div className="absolute top-8 right-32 w-1.5 h-4 bg-[#E86F47] transform rotate-[65deg] rounded-full opacity-80"></div>
                                <div className="absolute bottom-24 left-4 w-1.5 h-4 bg-[#E86F47] transform rotate-[-45deg] rounded-full opacity-80"></div>

                                {/* Floating Question Card */}
                                <div className="absolute top-10 right-10 w-16 h-20 bg-[#f5c4b5] rounded-xl transform rotate-12 shadow-md flex items-center justify-center text-[#E86F47] font-bold text-4xl z-10">
                                    ?
                                </div>

                                {/* Floating List Card */}
                                <div className="absolute top-20 right-1 w-20 h-24 bg-[#fdf5f1] rounded-xl transform rotate-[-10deg] shadow-lg p-3 flex flex-col gap-2 z-20">
                                    <div className="w-full h-3 bg-[#f5c4b5] rounded-full"></div>
                                    <div className="w-full h-3 bg-[#f5c4b5] rounded-full"></div>
                                    <div className="w-3/4 h-3 bg-[#f5c4b5] rounded-full"></div>
                                </div>

                                {/* Laptop Base Screen */}
                                <div className="absolute bottom-6 left-6 w-52 h-36 bg-[#f09e86] rounded-xl border-[5px] border-[#E86F47] shadow-lg transform -rotate-3 z-20">
                                    <div className="absolute top-2.5 left-2.5 w-[180px] h-26 bg-[#fff5f0] rounded overflow-hidden p-2.5 flex flex-col gap-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-6 h-6 rounded bg-[#E86F47] flex items-center justify-center text-white"><CheckSquare size={13} /></div>
                                            <div className="w-24 h-2 bg-[#f5c4b5] rounded-full"></div>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-6 h-6 rounded bg-[#fbe6df]"></div>
                                            <div className="w-20 h-2 bg-[#f5c4b5] rounded-full"></div>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-6 h-6 rounded bg-[#fbe6df]"></div>
                                            <div className="w-24 h-2 bg-[#f5c4b5] rounded-full"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Laptop Bottom Stand */}
                                <div className="absolute bottom-4 left-3 w-60 h-3 bg-[#E86F47] rounded-full shadow-lg transform -rotate-3 z-30"></div>
                            </div>
                        </div>

                        {/* Subtle bottom spacer for balanced layout */}
                        <div className="h-2"></div>
                    </div>

                    {/* Right Side - Form Panel */}
                    <div className="md:w-[55%] bg-white p-6 sm:p-10 md:p-12 lg:px-20 flex flex-col justify-center">
                        <div className="w-full">
                            <h1 className="text-3xl sm:text-[2.5rem] font-mono font-bold text-black mb-3 tracking-tight">
                                {isResetting ? 'Set New Password' : isRecovering ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
                            </h1>
                            <p className="text-gray-500 font-mono text-sm mb-8">
                                {isResetting ? 'Use the recovery link from your email to set a new password.' : isRecovering ? 'Enter your email to receive a recovery link.' : isSignUp
                                    ? 'Create your account to start managing quizzes'
                                    : 'Login to your account'}
                            </p>

                            {errorMsg && (
                                <div id="auth-error" role="alert" className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                                    {errorMsg}
                                </div>
                            )}
                            {infoMsg && <p role="status" className="mb-6 p-3 bg-green-50 text-green-800 text-sm rounded-lg border border-green-200">{infoMsg}</p>}

                            <form onSubmit={handleAuth} className="space-y-6">
                                {isSignUp && !isRecovering && !isResetting && (
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-400 font-mono text-lg">@</span>
                                        </div>
                                        <input
                                            id="auth-name"
                                            aria-label="Full name"
                                            autoComplete="name"
                                            maxLength={100}
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3.5 border border-[#f5c4b5] rounded-xl focus:ring-1 focus:ring-[#E86F47] focus:border-[#E86F47] outline-none font-mono text-sm bg-white text-[#1c1917] font-medium placeholder:text-[#8c827a] transition-colors"
                                            placeholder="Full Name"
                                        />
                                    </div>
                                )}

                                {!isResetting && <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <input
                                        id="auth-email"
                                        aria-label="Email address"
                                        autoComplete="email"
                                        maxLength={254}
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 border border-[#f5c4b5] rounded-xl focus:ring-1 focus:ring-[#E86F47] focus:border-[#E86F47] outline-none font-mono text-sm bg-white text-[#1c1917] font-medium placeholder:text-[#8c827a] transition-colors"
                                        placeholder="Email address"
                                    />
                                </div>}

                                {!isRecovering && <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <input
                                        id="auth-password"
                                        aria-label={isResetting ? 'New password' : 'Password'}
                                        autoComplete={isSignUp || isResetting ? 'new-password' : 'current-password'}
                                        minLength={isSignUp || isResetting ? 8 : undefined}
                                        maxLength={128}
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-12 py-3.5 border border-[#f5c4b5] rounded-xl focus:ring-1 focus:ring-[#E86F47] focus:border-[#E86F47] outline-none font-mono text-sm bg-white text-[#1c1917] font-medium placeholder:text-[#8c827a] transition-colors"
                                        placeholder="Password"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        aria-pressed={showPassword}
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>}
                                {isResetting && <input type="password" aria-label="Confirm new password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full px-4 py-3.5 border border-brand-light rounded-xl focus:ring-2 focus:ring-brand font-mono text-sm" />}

                                {isSignUp && !isRecovering && !isResetting && (
                                    <div className="pt-2">
                                        <label className="block text-sm font-mono text-gray-500 mb-3">Register as:</label>
                                        <div role="group" aria-label="Register as" className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setRole('teacher')}
                                                aria-pressed={role === 'teacher'}
                                                className={`py-3 rounded-xl font-mono text-sm transition-colors border ${role === 'teacher'
                                                    ? 'bg-[#E86F47] text-black border-[#E86F47]'
                                                    : 'bg-white text-gray-600 border-[#f5c4b5] hover:bg-[#fff5f0]'
                                                    }`}
                                            >
                                                Teacher
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRole('student')}
                                                aria-pressed={role === 'student'}
                                                className={`py-3 rounded-xl font-mono text-sm transition-colors border ${role === 'student'
                                                    ? 'bg-[#E86F47] text-black border-[#E86F47]'
                                                    : 'bg-white text-gray-600 border-[#f5c4b5] hover:bg-[#fff5f0]'
                                                    }`}
                                            >
                                                Student
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!isSignUp && !isRecovering && !isResetting && (
                                    <div className="flex flex-wrap gap-2 items-center justify-between pt-1">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-[#f5c4b5] text-[#E86F47] focus:ring-[#E86F47] accent-[#E86F47] cursor-pointer"
                                            />
                                            <span className="text-sm font-mono text-gray-700">Remember me</span>
                                        </label>
                                        <button type="button" onClick={() => { setIsRecovering(true); setErrorMsg(''); setInfoMsg(''); }} className="text-sm font-mono text-brand-ink hover:underline">Forgot Password?</button>
                                    </div>
                                )}
                                {isSignUp && !isRecovering && !isResetting && (
                                    <div className="flex items-center justify-between pt-1">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-[#f5c4b5] text-[#E86F47] focus:ring-[#E86F47] accent-[#E86F47] cursor-pointer"
                                            />
                                            <span className="text-sm font-mono text-gray-700">Remember me</span>
                                        </label>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 mt-2 bg-[#E86F47] hover:bg-[#d65b33] text-black font-mono font-bold text-lg rounded-xl transition-all shadow-sm"
                                >
                                    {loading ? 'Processing...' : isResetting ? 'Update Password' : isRecovering ? 'Send reset email' : isSignUp ? 'Sign Up' : 'Login'}
                                </button>
                            </form>

                            {/* <div className="my-8 flex items-center before:flex-1 before:border-t before:border-[#f5c4b5] after:flex-1 after:border-t after:border-[#f5c4b5]">
                                <span className="px-4 text-sm font-mono text-gray-400">or continue with</span>
                            </div> */}

                            <div className="w-full">
                                {/* <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-[#f5c4b5] rounded-xl hover:bg-[#fff5f0] hover:border-[#E86F47]/60 transition-all font-mono text-sm font-semibold text-black shadow-2xs group cursor-pointer"
                                >
                                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    <span className="group-hover:text-[#E86F47] transition-colors">Continue with Google</span>
                                </button> */}
                            </div>

                            <div className="mt-8 text-center font-mono text-sm text-black">
                                {isRecovering || isResetting ? 'Remember your password? ' : isSignUp ? "Already have an account? " : "Don't have an account? "}
                                <button
                                    onClick={() => changeMode(isRecovering || isResetting ? false : !isSignUp)}
                                    className="text-[#E86F47] hover:underline"
                                >
                                    {isRecovering || isResetting || isSignUp ? 'Login' : 'Sign Up'}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
