'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, BarChart3, Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type TopicStats = {
  correct: number;
  total: number;
};

type SessionData = {
  quizzes?: QuizMetadata | QuizMetadata[] | null;
};

type QuizMetadata = {
  title?: string;
  type?: string;
};

type ChartPoint = {
  name: string;
  accuracy: number;
};

export default function AnalyticsDashboard({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [overallAccuracy, setOverallAccuracy] = useState(0);
  const quizMetadata = Array.isArray(sessionData?.quizzes)
    ? sessionData.quizzes[0]
    : sessionData?.quizzes;

  useEffect(() => {
    let cancelled = false;

    async function fetchAnalytics() {
      setLoading(true);
      setErrorMessage(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || profile?.role !== 'teacher') {
        router.push('/dashboard/student');
        return;
      }

      const { data: sessionInfo, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id, quiz_id, quizzes(title, type)')
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionInfo) {
        if (!cancelled) {
          setErrorMessage('Session data not found.');
          setLoading(false);
        }
        return;
      }

      const { data: submissions, error: submissionError } = await supabase
        .from('submissions')
        .select('is_correct, questions(subtopic)')
        .eq('session_id', sessionId);

      if (submissionError) {
        console.error('Error fetching submissions:', submissionError);
        if (!cancelled) {
          setErrorMessage('Unable to load analytics for this session.');
          setLoading(false);
        }
        return;
      }

      let totalCorrect = 0;
      const topicStats: Record<string, TopicStats> = {};

      (submissions || []).forEach((submission) => {
        const question = Array.isArray(submission.questions)
          ? submission.questions[0]
          : submission.questions;
        const subtopic = question?.subtopic?.trim() || 'General';
        const isCorrect = submission.is_correct === true;

        if (isCorrect) totalCorrect += 1;
        topicStats[subtopic] ??= { correct: 0, total: 0 };
        topicStats[subtopic].total += 1;
        if (isCorrect) topicStats[subtopic].correct += 1;
      });

      const formattedChartData = Object.entries(topicStats).map(([name, stats]) => ({
        name,
        accuracy: Math.round((stats.correct / stats.total) * 100),
      }));

      if (!cancelled) {
        setSessionData(sessionInfo);
        setChartData(formattedChartData);
        setOverallAccuracy(
          submissions && submissions.length > 0
            ? Math.round((totalCorrect / submissions.length) * 100)
            : 0
        );
        setLoading(false);
      }
    }

    void fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (errorMessage || !sessionData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-gray-700">{errorMessage || 'Analytics are unavailable.'}</p>
        <button
          onClick={() => router.push('/dashboard/teacher')}
          className="mt-6 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          Return to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/teacher')}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </button>

        <div className="flex items-center gap-3 mb-8">
          <BarChart3 className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Post-Quiz Analytics: {quizMetadata?.title || 'Quiz'}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Class Accuracy</p>
            <h2 className="text-4xl font-black text-indigo-600">{overallAccuracy}%</h2>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Topics Assessed</p>
            <h2 className="text-4xl font-black text-gray-900">{chartData.length}</h2>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-1">Quiz Type</p>
            <h2 className="text-2xl font-black capitalize text-gray-900">
              {quizMetadata?.type || 'Unknown'}
            </h2>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm h-[400px]">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Classroom Comprehension by Subtopic
          </h2>
          {chartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-gray-500">
              No submissions are available for this session yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280' }}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? 0}%`, 'Accuracy']}
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="accuracy" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </RechartsBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
