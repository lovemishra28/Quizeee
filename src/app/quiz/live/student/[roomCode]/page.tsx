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
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-12 h-12 text-brand animate-spin" />
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-black">
        <div className="bg-brand-lightest border-2 border-brand-light rounded-[2rem] p-12 text-center max-w-xl w-full shadow-sm">
          <div className="inline-flex bg-brand-light p-6 rounded-full mb-8">
            <MonitorPlay className="w-12 h-12 text-brand" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black font-mono tracking-tighter mb-4">You're in, {userName}!</h2>
          <p className="text-gray-600 font-mono text-xl">Waiting for the teacher to start...</p>
        </div>
      </div>
    );
  }

  if (status === 'feedback') {
    if (restoredSubmission.current && timeLeft > 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
          <Loader2 className="w-12 h-12 text-brand animate-spin mb-6" />
          <h1 className="text-3xl font-black font-mono tracking-tighter text-black">Answer submitted</h1>
          <p className="mt-4 text-gray-500 font-mono text-lg">Waiting for the teacher to start the next question...</p>
        </div>
      );
    }

    if (timeLeft > 0 || !currentQuestion || !answerFeedback) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
          <Loader2 className="w-12 h-12 text-brand animate-spin mb-6" />
          <h1 className="text-3xl font-black font-mono tracking-tighter text-black">Waiting for the question timer...</h1>
          <p className="mt-4 text-gray-500 font-mono text-lg">The answer result will appear when the timer reaches zero.</p>
          <p className="mt-6 text-3xl font-black font-mono text-brand">{timeLeft}s remaining</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-bg p-6">
        <main className="max-w-4xl mx-auto pt-10">
          <p className={`text-center text-4xl font-black font-mono tracking-tighter mb-12 ${answerFeedback.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {answerFeedback.isCorrect ? 'Your answer was correct!' : 'Your answer was wrong.'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {currentQuestion.options.map((option, index) => {
              const isCorrect = index === answerFeedback.correctIndex;
              const isSelected = index === answerFeedback.selectedIndex;
              return (
                <div
                  key={`${currentQuestion.id}-${index}`}
                  className={`rounded-xl border-2 p-6 text-xl font-mono font-bold transition-all ${
                    isCorrect
                      ? 'border-green-500 bg-green-50 text-green-900 shadow-sm'
                      : isSelected
                        ? 'border-red-500 bg-red-50 text-red-900 shadow-sm'
                        : 'border-brand-light bg-white text-gray-700 opacity-60'
                  }`}
                >
                  <span className="mr-4 font-black">{String.fromCharCode(65 + index)}.</span>
                  {option}
                  {isCorrect && <p className="mt-3 text-sm font-black text-green-700 uppercase tracking-widest">Correct answer</p>}
                  {isSelected && !isCorrect && <p className="mt-3 text-sm font-black text-red-700 uppercase tracking-widest">Your answer</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-12 text-center text-gray-500 font-mono font-bold">Waiting for the teacher to start the next question...</p>
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
      <div className="min-h-screen bg-bg p-6 text-black">
        <main className="max-w-4xl mx-auto pt-10">
          {status === 'finished' && winner ? (
            <div className="text-center mb-12 animate-bounce bg-brand-lightest p-10 rounded-[2rem] border-2 border-brand-light shadow-sm">
              <Trophy className="w-20 h-20 text-brand mx-auto mb-4" />
              <p className="text-brand uppercase tracking-widest font-black font-mono text-xl mb-2">
                {isWinner ? 'You are the winner!' : 'Winner'}
              </p>
              <h1 className="text-6xl font-black font-mono tracking-tighter text-black">{winner.name}</h1>
              <p className="text-gray-500 font-bold font-mono text-lg mt-4">
                {winner.correctAnswers} correct answers • {winner.score} points
              </p>
            </div>
          ) : <h1 className="text-5xl font-black font-mono tracking-tighter mb-10 text-center">Leaderboard</h1>}
          {studentRank > 0 && (
            <p className="mb-8 text-center text-2xl font-black font-mono text-brand">
              Your position: #{studentRank}
            </p>
          )}
          <ol className="space-y-4">
            {leaderboard.slice(status === 'finished' ? 1 : 0).map((entry, index) => (
              <li key={entry.studentId} className="rounded-2xl border-2 border-brand-light bg-brand-lightest p-6 shadow-sm">
                <div className="flex justify-between items-center font-mono text-xl">
                  <span className="font-bold text-black">{index + (status === 'finished' ? 2 : 1)}. {entry.name}</span>
                  <strong className="text-brand">{entry.correctAnswers} correct • {entry.score} pts</strong>
                </div>
                <div className="mt-4 h-3 rounded-full bg-brand-light overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-brand transition-all duration-1000"
                    style={{ width: `${leaderboard[0]?.score ? (entry.score / leaderboard[0].score) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          <button
            onClick={() => router.push('/dashboard/student')}
            className="mt-12 w-full rounded-xl bg-brand hover:bg-[#c47155] px-8 py-5 font-black font-mono text-2xl text-black transition shadow-sm"
          >
            Return to dashboard
          </button>
          {status !== 'finished' && <p className="mt-8 text-gray-500 font-mono text-center font-bold">Waiting for the teacher to start the next question...</p>}
        </main>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-black">
        <div className="bg-brand-lightest border-2 border-brand-light rounded-[2rem] p-12 text-center shadow-sm">
          <p className="text-3xl font-black font-mono tracking-tighter mb-8">This live quiz has ended.</p>
          <button
            onClick={() => router.push('/dashboard/student')}
            className="w-full rounded-xl bg-brand hover:bg-[#c47155] px-8 py-5 font-black font-mono text-xl text-black transition shadow-sm"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-12 h-12 text-brand animate-spin" />
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
        <Loader2 className="w-12 h-12 text-brand animate-spin mb-6" />
        <h1 className="text-3xl font-black font-mono tracking-tighter text-black">Waiting for next question...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6 flex flex-col items-center">
      <main className="max-w-4xl w-full pt-10">
        <div className="flex justify-between items-center mb-8 bg-brand-lightest border-2 border-brand-light p-6 rounded-2xl shadow-sm">
          <p className="text-lg font-bold font-mono uppercase tracking-widest text-brand">Live quiz</p>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-gray-500">Time left:</span>
            <span className={`text-2xl font-black font-mono px-4 py-2 rounded-xl ${timeLeft < 10 ? 'bg-red-100 text-red-600' : 'bg-brand-light text-black'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>
        
        <div className="bg-brand-lightest p-10 rounded-[2rem] shadow-sm border-2 border-brand-light mb-8">
          <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-black mb-12 leading-tight">
            {currentQuestion.question_text}
          </h1>
          <div className="grid gap-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={`${currentQuestion.id}-${index}`}
                onClick={() => handleAnswerSubmit(index)}
                className="w-full rounded-xl bg-white border-2 border-brand-light p-6 text-left text-2xl font-bold font-mono text-black shadow-sm transition hover:border-brand hover:bg-brand-lightest hover:scale-[1.01]"
              >
                <span className="mr-4 inline-block w-10 h-10 text-center leading-[2.1rem] rounded-full bg-brand-light text-black border-2 border-transparent">
                  {String.fromCharCode(65 + index)}
                </span>
                {option}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
