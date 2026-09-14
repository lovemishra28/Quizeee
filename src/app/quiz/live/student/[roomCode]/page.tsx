'use client';

import { useEffect, useState, use, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Loader2, MonitorPlay, Trophy } from 'lucide-react';

type LiveSession = {
  id: string;
  quiz_id: string;
  status: 'waiting' | 'active' | 'leaderboard' | 'finished' | 'completed';
  current_question_index: number;
};

type LiveQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
};

type LeaderboardEntry = {
  studentId: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalResponseTime: number;
};

type AnswerFeedback = {
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
};

export default function StudentLiveRoom({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params);
  const router = useRouter();
  
  const [session, setSession] = useState<LiveSession | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Student');
  const [status, setStatus] = useState<'joining' | 'waiting' | 'active' | 'feedback' | 'leaderboard' | 'finished' | 'completed'>('joining');
  
  const [currentQuestion, setCurrentQuestion] = useState<LiveQuestion | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const hasAuthoritativeLeaderboard = useRef(false);
  const restoredSubmission = useRef(false);
  const questionDuration = useRef(30);

  useEffect(() => {
    let channel: RealtimeChannel | undefined;
    let poller: number | undefined;
    let cancelled = false;
    let authenticatedStudentId: string | null = null;

    async function fetchQuestionByIndex(quizId: string, index: number): Promise<LiveQuestion | null> {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        // Live session indexes are zero-based; question.order_index is one-based.
        .eq('order_index', index + 1)
        .single();
      if (error) {
        console.error('Failed to load live question', error);
        return null;
      }
      setCurrentQuestion(data);
      return data;
    }

    const applySessionUpdate = async (updatedSession: LiveSession) => {
      setSession(updatedSession);
      if (updatedSession.status === 'leaderboard') {
        setStatus('feedback');
        return;
      }
      if (updatedSession.status === 'finished' || updatedSession.status === 'completed') {
        setStatus(updatedSession.status);
        return;
      }
      if (updatedSession.status === 'waiting' || updatedSession.current_question_index < 0) {
        setStatus('waiting');
        setCurrentQuestion(null);
        return;
      }
      setStatus('active');
      const questionKey = `live-quiz-${updatedSession.id}-question-${updatedSession.current_question_index}`;
      const storedStartTime = window.localStorage.getItem(questionKey);
      const startTime = storedStartTime ? Number(storedStartTime) : Date.now();
      if (!storedStartTime) {
        window.localStorage.setItem(questionKey, String(startTime));
      }
      setQuestionStartTime(startTime);
      const remaining = Math.max(0, questionDuration.current - Math.floor((Date.now() - startTime) / 1000));
      setTimeLeft(remaining);
      setAnswerFeedback(null);
      if (remaining === 0) {
        setStatus('feedback');
      }
      const question = await fetchQuestionByIndex(updatedSession.quiz_id, updatedSession.current_question_index);
      if (!question || !authenticatedStudentId) {
        setHasSubmitted(false);
        return;
      }

      const { data: existingSubmission, error: submissionError } = await supabase
        .from('submissions')
        .select('id, selected_option_index, is_correct')
        .eq('session_id', updatedSession.id)
        .eq('student_id', authenticatedStudentId)
        .eq('question_id', question.id)
        .limit(1);

      if (submissionError) {
        console.error('Failed to restore live quiz progress', submissionError);
        return;
      }

      const submission = existingSubmission?.[0];
      if (submission) {
        setHasSubmitted(true);
        restoredSubmission.current = true;
        setAnswerFeedback({
          selectedIndex: submission.selected_option_index,
          correctIndex: question.correct_option_index,
          isCorrect: submission.is_correct,
        });
        setStatus('feedback');
      } else {
        setHasSubmitted(false);
        restoredSubmission.current = false;
      }
    };

    async function joinRoom() {
      // 1. Fetch current user to get their name
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }
      authenticatedStudentId = user.id;
      setStudentId(user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
        
      if (profile) setUserName(profile.full_name);

      // 2. Verify the room code exists and is active
      const { data: sessionData, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('room_code', roomCode)
        .single();

      if (error || !sessionData) {
        alert('Invalid or expired room code.');
        router.push('/dashboard/student');
        return;
      }

      const { data: quizData } = await supabase
        .from('quizzes')
        .select('per_question_timer')
        .eq('id', sessionData.quiz_id)
        .single();
      questionDuration.current = quizData?.per_question_timer || 30;

      await applySessionUpdate(sessionData);
      let lastQuestionIndex = sessionData.current_question_index;
      let lastStatus = sessionData.status;

      // 3 & 5. Connect to Supabase Realtime for both Broadcast and Database Changes
      const roomChannel = supabase
        .channel(`room-${roomCode}`, {
          config: { presence: { key: user.id } },
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'quiz_sessions',
            filter: `id=eq.${sessionData.id}`,
          },
          (payload) => { void applySessionUpdate(payload.new as LiveSession); }
        )
        .on('broadcast', { event: 'question-started' }, (payload) => {
          const { index, duration, startTime } = payload.payload;
          questionDuration.current = duration;
          const questionKey = `live-quiz-${sessionData.id}-question-${index}`;
          const authoritativeStartTime = typeof startTime === 'number' ? startTime : Date.now();
          window.localStorage.setItem(questionKey, String(authoritativeStartTime));
          setStatus('active');
          setHasSubmitted(false);
          restoredSubmission.current = false;
          setAnswerFeedback(null);
          setTimeLeft(Math.max(0, duration - Math.floor((Date.now() - authoritativeStartTime) / 1000)));
          setQuestionStartTime(authoritativeStartTime);
          lastQuestionIndex = index;
          lastStatus = 'active';
          void fetchQuestionByIndex(sessionData.quiz_id, index);
        })
        .on('broadcast', { event: 'leaderboard-updated' }, (payload) => {
          hasAuthoritativeLeaderboard.current = true;
          setLeaderboard(payload.payload.entries || []);
          if (payload.payload.isFinal) {
            setStatus('finished');
          } else {
            setStatus('feedback');
          }
        });

      if (cancelled) {
        await supabase.removeChannel(roomChannel);
        return;
      }

      channel = roomChannel;
      roomChannel.subscribe(async (connectionStatus: string) => {
        if (connectionStatus === 'SUBSCRIBED') {
          // Presence uses the authenticated user ID, so reloads do not double-count.
          const presenceStatus = await roomChannel.track({
            user_id: user.id,
            name: profile?.full_name || 'Student',
          });
          if (presenceStatus !== 'ok') {
            console.error('Failed to publish student presence', presenceStatus);
          }
        }
      });

      poller = window.setInterval(async () => {
        const { data: latestSession } = await supabase
          .from('quiz_sessions')
          .select('*')
          .eq('id', sessionData.id)
          .single();
        if (
          !cancelled &&
          latestSession &&
          (latestSession.current_question_index !== lastQuestionIndex || latestSession.status !== lastStatus)
        ) {
          lastQuestionIndex = latestSession.current_question_index;
          lastStatus = latestSession.status;
          await applySessionUpdate(latestSession);
        }
      }, 2000);

    }

    joinRoom();

    return () => {
      cancelled = true;
      if (poller) window.clearInterval(poller);
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomCode, router]);

  useEffect(() => {
    if (status !== 'active' && status !== 'feedback') return;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, questionStartTime]);

  useEffect(() => {
    if (status !== 'finished' || !session) return;
    if (hasAuthoritativeLeaderboard.current) return;
    const sessionId = session.id;

    async function loadLeaderboard() {
      const { data, error } = await supabase
        .from('submissions')
        .select('student_id, score_awarded, is_correct, response_time_ms, profiles(full_name)')
        .eq('session_id', sessionId);

      if (error) {
        console.error('Failed to load leaderboard', error);
        return;
      }

      const totals = new Map<string, LeaderboardEntry>();
      (data || []).forEach((submission) => {
        const current = totals.get(submission.student_id);
        const profile = Array.isArray(submission.profiles) ? submission.profiles[0] : submission.profiles;
        totals.set(submission.student_id, {
          studentId: submission.student_id,
          name: current?.name || profile?.full_name || 'Student',
          score: (current?.score || 0) + (submission.is_correct ? Math.max(0, submission.score_awarded || 0) : 0),
          correctAnswers: (current?.correctAnswers || 0) + (submission.is_correct ? 1 : 0),
          totalResponseTime: (current?.totalResponseTime || 0) + (submission.response_time_ms || 0),
        });
      });
      setLeaderboard(Array.from(totals.values()).sort((a, b) =>
        b.correctAnswers - a.correctAnswers ||
        b.score - a.score ||
        a.totalResponseTime - b.totalResponseTime
      ));
    }

    void loadLeaderboard();
  }, [status, session]);

  const handleAnswerSubmit = async (selectedIndex: number) => {
    if (hasSubmitted || !currentQuestion || !session) return;
    
    setHasSubmitted(true);
    restoredSubmission.current = false;
    const responseTimeMs = Date.now() - questionStartTime;
    const isCorrect = selectedIndex === currentQuestion.correct_option_index;
    setAnswerFeedback({
      selectedIndex,
      correctIndex: currentQuestion.correct_option_index,
      isCorrect,
    });
    setStatus('feedback');
    
    // Correct: 1000 base points + up to 500 speed points.
    // Incorrect: zero points and zero speed bonus, with no deduction.
    const maxTime = questionDuration.current * 1000;
    const speedBonus = isCorrect
      ? Math.max(0, Math.round(((maxTime - Math.min(responseTimeMs, maxTime)) / maxTime) * 500))
      : 0;
    const score = isCorrect ? 1000 + speedBonus : 0;

    await supabase
      .from('submissions')
      .insert({
        session_id: session.id,
        student_id: (await supabase.auth.getUser()).data.user?.id,
        question_id: currentQuestion.id,
        selected_option_index: selectedIndex,
        is_correct: isCorrect,
        score_awarded: score,
        response_time_ms: responseTimeMs,
      });
  };

  if (status === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-white/10 p-6 rounded-full mb-6">
          <MonitorPlay className="w-12 h-12 text-indigo-100" />
        </div>
        <h2 className="text-3xl font-bold mb-2">You're in, {userName}!</h2>
        <p className="text-indigo-200 text-lg">Waiting for the teacher to start...</p>
      </div>
    );
  }

  if (status === 'feedback') {
    if (restoredSubmission.current && timeLeft > 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Answer submitted</h1>
          <p className="mt-2 text-gray-500">Waiting for the teacher to start the next question...</p>
        </div>
      );
    }

    if (timeLeft > 0 || !currentQuestion || !answerFeedback) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Waiting for the question timer...</h1>
          <p className="mt-2 text-gray-500">The answer result will appear when the timer reaches zero.</p>
          <p className="mt-4 text-xl font-bold text-indigo-600">{timeLeft}s remaining</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <main className="max-w-2xl mx-auto pt-10">
          <p className={`text-center text-2xl font-black mb-8 ${answerFeedback.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {answerFeedback.isCorrect ? 'Your answer was correct!' : 'Your answer was wrong.'}
          </p>
          <div className="grid gap-4">
            {currentQuestion.options.map((option, index) => {
              const isCorrect = index === answerFeedback.correctIndex;
              const isSelected = index === answerFeedback.selectedIndex;
              return (
                <div
                  key={`${currentQuestion.id}-${index}`}
                  className={`rounded-xl border-2 p-5 text-lg font-semibold ${
                    isCorrect
                      ? 'border-green-500 bg-green-50 text-green-900'
                      : isSelected
                        ? 'border-red-500 bg-red-50 text-red-900'
                        : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  <span className="mr-3">{String.fromCharCode(65 + index)}.</span>
                  {option}
                  {isCorrect && <p className="mt-2 text-sm font-bold text-green-700">Correct answer</p>}
                  {isSelected && !isCorrect && <p className="mt-2 text-sm font-bold text-red-700">Your answer</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-center text-gray-500">Waiting for the teacher to start the next question...</p>
        </main>
      </div>
    );
  }

  if (status === 'finished') {
    const winner = leaderboard[0];
    const studentRank = studentId
      ? leaderboard.findIndex((entry) => entry.studentId === studentId) + 1
      : 0;
    const isWinner = status === 'finished' && winner?.studentId === studentId;

    return (
      <div className="min-h-screen bg-indigo-600 p-6 text-white">
        <main className="max-w-2xl mx-auto pt-10">
          {status === 'finished' && winner ? (
            <div className="text-center mb-8 animate-bounce">
              <Trophy className="w-16 h-16 text-yellow-300 mx-auto mb-3" />
              <p className="text-yellow-200 uppercase tracking-widest font-bold">
                {isWinner ? 'You are the winner!' : 'Winner'}
              </p>
              <h1 className="text-4xl font-black">{winner.name}</h1>
              <p className="text-indigo-200 mt-1">
                {winner.correctAnswers} correct answers · {winner.score} points
              </p>
            </div>
          ) : <h1 className="text-3xl font-black mb-8">Leaderboard</h1>}
          {studentRank > 0 && (
            <p className="mb-6 text-center text-lg font-bold text-yellow-200">
              Your position: #{studentRank}
            </p>
          )}
          <ol className="space-y-3">
            {leaderboard.slice(status === 'finished' ? 1 : 0).map((entry, index) => (
              <li key={entry.studentId} className="rounded-xl bg-white/10 p-4">
                <div className="flex justify-between">
                  <span>{index + (status === 'finished' ? 2 : 1)}. {entry.name}</span>
                  <strong>{entry.correctAnswers} correct · {entry.score} pts</strong>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-indigo-300"
                    style={{ width: `${leaderboard[0]?.score ? (entry.score / leaderboard[0].score) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <button
            onClick={() => router.push('/dashboard/student')}
            className="mt-8 w-full rounded-xl bg-white px-5 py-3 font-bold text-indigo-700 transition hover:bg-indigo-50"
          >
            Return to dashboard
          </button>
          {status !== 'finished' && <p className="mt-8 text-indigo-200">Waiting for the teacher to start the next question...</p>}
        </main>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-600 p-6 text-white">
        <p className="text-xl font-semibold">This live quiz has ended.</p>
        <button
          onClick={() => router.push('/dashboard/student')}
          className="mt-6 rounded-xl bg-white px-5 py-3 font-bold text-indigo-700 transition hover:bg-indigo-50"
        >
          Return to dashboard
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Waiting for next question...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <main className="max-w-2xl mx-auto pt-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 mb-3">Live quiz</p>
        <p className="text-sm font-bold text-gray-500 mb-3">Time left: {timeLeft}s</p>
        <h1 className="text-3xl font-black text-gray-900 mb-8">{currentQuestion.question_text}</h1>
        <div className="grid gap-4">
          {currentQuestion.options.map((option, index) => (
            <button
              key={`${currentQuestion.id}-${index}`}
              onClick={() => handleAnswerSubmit(index)}
              className="w-full rounded-xl bg-white border border-gray-200 p-5 text-left text-lg font-semibold text-gray-900 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50"
            >
              <span className="mr-3 text-indigo-600">{String.fromCharCode(65 + index)}.</span>
              {option}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
