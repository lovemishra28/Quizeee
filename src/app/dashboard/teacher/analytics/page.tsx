'use client';

import { useEffect, useState } from 'react';
import { BarChart3, FilePlus2, Home, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type AnalyticsSession = {
  id: string;
  status: string;
  created_at: string;
  quizzes: { title: string; type: string; available_until?: string | null } | { title: string; type: string; available_until?: string | null }[] | null;
};

export default function TeacherAnalyticsIndex() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadSessions() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();
      if (!profile || profile.role !== 'teacher') {
        router.push('/dashboard/student');
        return;
      }

      setUserName(profile.full_name);
      const { data: sessionData, error } = await supabase
        .from('quiz_sessions')
        .select('id, status, created_at, quizzes!inner(title, type, teacher_id, available_until)')
        .eq('quizzes.teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load analytics sessions', error);
      } else {
        setSessions((sessionData || []) as AnalyticsSession[]);
      }
      setLoading(false);
    }

    void loadSessions();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-12">
      <nav className="border-b border-brand-light px-12 py-6 flex justify-between items-center sticky top-0 z-10 bg-bg">
        <div className="flex flex-col items-start gap-1">
          <span className="text-4xl font-black text-brand tracking-tighter">quizeee</span>
          <span className="bg-brand-light text-black text-xs px-3 py-1 rounded-full font-medium tracking-wide">
            Teachers Hub
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push('/dashboard/teacher')}
            className="rounded-full bg-white px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/dashboard/teacher/analytics')}
            className="rounded-full bg-brand-light px-6 py-2.5 text-sm font-medium text-black transition"
          >
            Analytics
          </button>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-black font-bold text-sm">{userName || 'Name'}</span>
            <button
              onClick={handleSignOut}
              className="ml-2 flex items-center text-sm text-gray-500 hover:text-red-600 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 mt-4">
        <h1 className="text-5xl font-bold font-mono tracking-tighter text-black">Quiz Analytics</h1>
        <p className="mt-2 text-gray-600 font-mono">Choose a quiz session to view classroom performance.</p>

        {sessions.length === 0 ? (
          <div className="mt-8 rounded-xl border-2 border-brand-light bg-white p-8 text-center text-gray-500 font-mono shadow-sm">
            No quiz sessions are available for analytics yet.
          </div>
        ) : (
          <div className="mt-12 space-y-4">
            {sessions.map((session) => {
              const quiz = Array.isArray(session.quizzes) ? session.quizzes[0] : session.quizzes;
              
              let displayStatus = session.status;
              if (quiz?.type === 'static' && quiz.available_until) {
                const isPassed = currentTime >= new Date(quiz.available_until).getTime();
                if (isPassed && displayStatus !== 'completed') {
                  displayStatus = 'completed';
                }
              }

              return (
                <button
                  key={session.id}
                  onClick={() => router.push(`/dashboard/teacher/analytics/${session.id}`)}
                  className="w-full bg-transparent border-b border-brand-light border-dashed transition-all duration-200 block text-left"
                >
                  <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:bg-brand-lightest/50 rounded-xl gap-4">
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                      <h2 className="text-3xl font-normal font-mono text-black truncate" title={quiz?.title || 'Untitled quiz'}>{quiz?.title || 'Untitled quiz'}</h2>
                      <div className="flex items-center space-x-4">
                        <span className="text-xs font-mono text-gray-600 font-bold">
                          Session created on: {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 sm:mt-0 flex gap-4 shrink-0">
                      <div className="w-40 py-2 border-2 border-brand-light rounded-xl text-center">
                        <span className={`text-xl font-mono font-bold text-brand capitalize`}>
                          {quiz?.type || 'quiz'}
                        </span>
                      </div>
                      <div className="w-40 py-2 border-2 border-brand-light bg-brand-light rounded-xl text-center">
                        <span className={`text-xl font-mono font-bold text-black capitalize`}>
                          {displayStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
