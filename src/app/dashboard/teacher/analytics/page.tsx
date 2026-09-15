'use client';

import { useEffect, useState } from 'react';
import { BarChart3, FilePlus2, Home, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type AnalyticsSession = {
  id: string;
  status: string;
  created_at: string;
  quizzes: { title: string; type: string } | { title: string; type: string }[] | null;
};

export default function TeacherAnalyticsIndex() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);

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
        .select('id, status, created_at, quizzes!inner(title, type, teacher_id)')
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-indigo-600">Quizeee</span>
          <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-semibold">
            Teacher Hub
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/')} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-indigo-600">
            <Home className="w-4 h-4" /> Home
          </button>
          <button onClick={() => router.push('/dashboard/teacher')} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-indigo-600">
            <FilePlus2 className="w-4 h-4" /> Quiz
          </button>
          <button className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <span className="ml-2 text-gray-700 font-medium">{userName}</span>
          <button onClick={handleSignOut} className="flex items-center text-sm text-gray-500 hover:text-red-600 transition">
            <LogOut className="w-4 h-4 mr-1" /> Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900">Quiz Analytics</h1>
        <p className="mt-1 text-gray-500">Choose a quiz session to view classroom performance.</p>

        {sessions.length === 0 ? (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            No quiz sessions are available for analytics yet.
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {sessions.map((session) => {
              const quiz = Array.isArray(session.quizzes) ? session.quizzes[0] : session.quizzes;
              return (
                <button
                  key={session.id}
                  onClick={() => router.push(`/dashboard/teacher/analytics/${session.id}`)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{quiz?.title || 'Untitled quiz'}</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {new Date(session.created_at).toLocaleString()} · {quiz?.type || 'quiz'}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-600">
                      {session.status}
                    </span>
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
