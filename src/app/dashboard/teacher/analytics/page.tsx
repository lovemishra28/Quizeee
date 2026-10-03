'use client';

import { useEffect, useState } from 'react';
import { BarChart3, FilePlus2, Home, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import DashboardNavbar from '@/components/DashboardNavbar';
import DashboardLoading from '@/components/DashboardLoading';
import { getCachedProfile, setCachedProfile, markClientHydrated, getCachedProfileDirect } from '@/lib/authCache';

type AnalyticsSession = {
  id: string;
  status: string;
  created_at: string;
  quizzes: { title: string; type: string; available_until?: string | null } | { title: string; type: string; available_until?: string | null }[] | null;
};

export default function TeacherAnalyticsIndex() {
  const router = useRouter();
  const cached = getCachedProfile();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(cached?.full_name || '');
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    markClientHydrated();
    const storedProfile = getCachedProfileDirect();
    if (storedProfile) {
      setUserName(storedProfile.full_name);
    }

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
      setCachedProfile({
        id: user.id,
        full_name: profile.full_name,
        role: profile.role,
      });
      const { data: sessionData, error } = await supabase
        .from('quiz_sessions')
        .select('id, status, created_at, quizzes!inner(title, type, teacher_id, available_until)')
        .eq('quizzes.teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load analytics sessions', error);
      } else {
        // Filter out duplicate or orphaned 'waiting' sessions for competitive quizzes:
        // When a competitive quiz has a played session (status != 'waiting'), any unplayed 'waiting'
        // lobby for that same quiz is excluded so duplicate entries never appear in Analytics.
        const validSessions = (sessionData || []).filter((session: any) => {
          const quiz = Array.isArray(session.quizzes) ? session.quizzes[0] : session.quizzes;
          if (quiz?.type === 'static') return true;

          // For competitive quizzes:
          if (session.status !== 'waiting') return true;

          // If status is 'waiting', only show it if there is NO played session for the same quiz title
          const hasPlayedSession = (sessionData || []).some((other: any) => {
            if (other.id === session.id) return false;
            const otherQuiz = Array.isArray(other.quizzes) ? other.quizzes[0] : other.quizzes;
            return otherQuiz?.title === quiz?.title && other.status !== 'waiting';
          });

          return !hasPlayedSession;
        });

        setSessions(validSessions as AnalyticsSession[]);
      }
      setLoading(false);
    }

    void loadSessions();
  }, [router]);

  const handleSignOut = async () => {
    setCachedProfile(null);
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <div className="min-h-screen bg-[#fff5f0] text-foreground font-mono relative flex flex-col selection:bg-[#E86F47] selection:text-white pb-12">
      {/* Shared Top Navigation */}
      <DashboardNavbar
        role="teacher"
        userName={userName}
        onSignOut={handleSignOut}
        activeTab="analytics"
      />

      {/* Main Content Area */}
      {loading && sessions.length === 0 ? (
        <DashboardLoading />
      ) : (
        <main className="max-w-6xl w-full mx-auto p-6 mt-4 relative z-10">
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
      )}
    </div>
  );
}
