'use client';

import { useEffect, useState, use, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, MonitorPlay, Trophy, Clock, Zap, ArrowLeft, Gamepad2 } from 'lucide-react';
import DashboardBackground from '@/components/DashboardBackground';
import { joinInstantQuizAction } from '@/actions/instantQuiz';

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
  const searchParams = useSearchParams();
  const isInstant = searchParams.get('instant') === 'true';
  
  const [session, setSession] = useState<LiveSession | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Student');
  const [status, setStatus] = useState<'joining' | 'prompt_nickname' | 'waiting' | 'active' | 'feedback' | 'leaderboard' | 'finished' | 'completed'>('joining');
  const [guestNicknameInput, setGuestNicknameInput] = useState('');
  const [guestJoinError, setGuestJoinError] = useState('');
  const [guestJoining, setGuestJoining] = useState(false);
  const [triggerJoinCount, setTriggerJoinCount] = useState(0);
  
  const [currentQuestion, setCurrentQuestion] = useState<LiveQuestion | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const hasAuthoritativeLeaderboard = useRef(false);
  const restoredSubmission = useRef(false);
  const questionDuration = useRef(30);
  const questionEndTimeRef = useRef<number>(0);

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
      const questionKey = `live-quiz-${updatedSession.id}-question-${updatedSession.current_question_index}-end`;
      const storedEndTime = window.localStorage.getItem(questionKey);
      const now = Date.now();
      let targetEnd = storedEndTime ? Number(storedEndTime) : 0;
      if (!targetEnd || isNaN(targetEnd)) {
        targetEnd = now + questionDuration.current * 1000;
        window.localStorage.setItem(questionKey, String(targetEnd));
      }
      questionEndTimeRef.current = targetEnd;
      setQuestionStartTime(targetEnd - questionDuration.current * 1000);
      const remaining = Math.max(0, Math.ceil((targetEnd - now) / 1000));
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
        setStatus('prompt_nickname');
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
        router.push(isInstant ? '/' : '/dashboard/student');
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

      // Connect to Supabase Realtime for both Broadcast and Database Changes
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
          const { index, duration, endTime } = payload.payload;
          questionDuration.current = duration;
          const now = Date.now();
          const targetEnd = (typeof endTime === 'number' && endTime > now) ? endTime : now + duration * 1000;
          questionEndTimeRef.current = targetEnd;
          const questionKey = `live-quiz-${sessionData.id}-question-${index}-end`;
          window.localStorage.setItem(questionKey, String(targetEnd));
          setStatus('active');
          setHasSubmitted(false);
          restoredSubmission.current = false;
          setAnswerFeedback(null);
          setTimeLeft(Math.max(0, Math.ceil((targetEnd - now) / 1000)));
          setQuestionStartTime(now);
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
  }, [roomCode, router, triggerJoinCount]);

  // Synchronized countdown based on target end timestamp
  useEffect(() => {
    if (status !== 'active' && status !== 'feedback') return;
    const checkTime = () => {
      const targetEnd = questionEndTimeRef.current;
      if (!targetEnd) return;
      const remaining = Math.max(0, Math.ceil((targetEnd - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    checkTime();
    const timer = window.setInterval(checkTime, 250);
    return () => window.clearInterval(timer);
  }, [status]);

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
    const responseTimeMs = Math.max(0, Date.now() - questionStartTime);
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

  const handleGuestJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNicknameInput.trim()) {
      setGuestJoinError('Please enter a nickname.');
      return;
    }
    setGuestJoining(true);
    setGuestJoinError('');
    try {
      const res = await joinInstantQuizAction({
        roomCode,
        nickname: guestNicknameInput.trim(),
      });
      if (!res.success || !res.guestEmail || !res.guestPassword) {
        throw new Error(res.error || 'Failed to join room.');
      }
      await supabase.auth.signInWithPassword({
        email: res.guestEmail,
        password: res.guestPassword,
      });
      setStatus('joining');
      setTriggerJoinCount((c) => c + 1);
    } catch (err: any) {
      setGuestJoinError(err.message || 'Failed to join');
      setGuestJoining(false);
    }
  };

  if (status === 'prompt_nickname') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff5f0] p-6 text-black relative overflow-hidden font-mono">
        <DashboardBackground />
        <div className="relative z-10 backdrop-blur-md bg-white/95 border-2 border-brand-light rounded-[2.5rem] p-8 sm:p-12 text-center max-w-md w-full shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-brand/20 flex items-center justify-center text-brand mx-auto mb-4 shadow-2xs">
            <Gamepad2 className="w-7 h-7 text-[#E86F47]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-black mb-1">
            Join Live Room
          </h2>
          <p className="text-xs font-mono text-[#8c827a] mb-6">
            Room Code: <strong className="text-brand font-black text-sm tracking-widest">#{roomCode}</strong>
          </p>

          {guestJoinError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-left font-mono">
              {guestJoinError}
            </div>
          )}

          <form onSubmit={handleGuestJoinSubmit} className="space-y-4">
            <div className="text-left">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#8c827a] mb-1.5">
                Your Nickname
              </label>
              <input
                type="text"
                maxLength={24}
                required
                value={guestNicknameInput}
                onChange={(e) => setGuestNicknameInput(e.target.value)}
                placeholder="e.g. Flash, Rocket, Alex"
                className="w-full px-4 py-3 border-2 border-brand-light rounded-xl outline-none focus:ring-2 focus:ring-brand font-mono text-sm font-bold bg-[#fbf5f0] text-black"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={guestJoining}
              className="w-full py-4 rounded-xl bg-brand hover:brightness-105 active:scale-[0.99] text-black font-mono font-black text-base shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {guestJoining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Joining Room...</span>
                </>
              ) : (
                <span>Enter Room Now →</span>
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-[#8c827a] border-t border-brand-light/60 pt-4">
            Already have an account?{' '}
            <button
              onClick={() => router.push(`/auth?next=/quiz/live/student/${roomCode}`)}
              className="text-brand font-bold hover:underline cursor-pointer"
            >
              Log in here
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (status === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff5f0] relative overflow-hidden">
        <DashboardBackground />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin" />
          <p className="mt-4 font-mono font-bold text-[#8c827a] text-sm animate-pulse">Connecting to live room...</p>
        </div>
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="min-h-screen bg-[#fff5f0] flex flex-col items-center justify-center p-6 text-black relative overflow-hidden">
        <DashboardBackground />
        <div className="relative z-10 backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-10 sm:p-12 text-center max-w-xl w-full shadow-lg flex flex-col items-center">
          <button
            onClick={() => router.push(isInstant ? '/' : '/dashboard/student')}
            className="inline-flex items-center gap-2 text-xs font-bold font-mono text-[#E86F47] hover:text-black mb-6 px-3.5 py-1.5 rounded-full bg-white border border-[#E86F47]/20 shadow-xs cursor-pointer self-start"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isInstant ? 'Back to Home' : 'Back to Dashboard'}
          </button>

          {isInstant && (
            <span className="px-3.5 py-1.5 rounded-xl bg-brand text-black font-mono font-bold text-xs uppercase tracking-wider shadow-2xs mb-4 inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Instant Game • Room #{roomCode}</span>
            </span>
          )}

          <div className="inline-flex bg-brand-light p-6 rounded-full mb-6 border-2 border-brand-light shadow-sm">
            <MonitorPlay className="w-12 h-12 text-brand" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black font-mono tracking-tight mb-2 text-black">
            You&apos;re in, {userName}!
          </h2>
          <p className="text-[#8c827a] font-mono text-base sm:text-lg font-bold">
            Waiting for the host to start the game...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'feedback') {
    if (restoredSubmission.current && timeLeft > 0) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff5f0] p-6 text-center relative overflow-hidden">
          <DashboardBackground />
          <div className="relative z-10 backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-12 max-w-xl w-full shadow-lg text-center">
            <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin mx-auto mb-6" />
            <h1 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-black">
              Answer submitted
            </h1>
            <p className="mt-3 text-[#8c827a] font-mono font-bold text-lg">
              Waiting for the teacher to start the next question...
            </p>
          </div>
        </div>
      );
    }

    if (timeLeft > 0 || !currentQuestion || !answerFeedback) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff5f0] p-6 text-center relative overflow-hidden">
          <DashboardBackground />
          <div className="relative z-10 backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-12 max-w-xl w-full shadow-lg text-center">
            <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin mx-auto mb-6" />
            <h1 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-black">
              Waiting for the question timer...
            </h1>
            <p className="mt-3 text-[#8c827a] font-mono font-bold text-lg">
              The answer result will appear when the timer reaches zero.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-light border-2 border-brand-light">
              <Clock className="w-6 h-6 text-brand" />
              <span className="text-3xl font-black font-mono text-brand">{timeLeft}s remaining</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#fff5f0] p-6 relative overflow-x-hidden">
        <DashboardBackground />
        <main className="relative z-10 max-w-4xl mx-auto pt-10">
          <div className="backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-8 sm:p-12 shadow-lg mb-8 text-center">
            <p className={`text-3xl sm:text-4xl font-black font-mono tracking-tight mb-8 ${answerFeedback.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {answerFeedback.isCorrect ? '✓ Your answer was correct!' : '✗ Your answer was wrong.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 text-left">
              {currentQuestion.options.map((option, index) => {
                const isCorrect = index === answerFeedback.correctIndex;
                const isSelected = index === answerFeedback.selectedIndex;
                return (
                  <div
                    key={`${currentQuestion.id}-${index}`}
                    className={`rounded-2xl border-2 p-6 text-lg sm:text-xl font-mono font-bold transition-all shadow-sm ${
                      isCorrect
                        ? 'border-green-500 bg-green-50 text-green-900'
                        : isSelected
                          ? 'border-red-500 bg-red-50 text-red-900'
                          : 'border-brand-light bg-white/90 text-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="mr-3 font-black text-xl">{String.fromCharCode(65 + index)}.</span>
                      <span>{option}</span>
                    </div>
                    {isCorrect && <p className="mt-3 text-xs font-black text-green-700 uppercase tracking-widest">Correct answer</p>}
                    {isSelected && !isCorrect && <p className="mt-3 text-xs font-black text-red-700 uppercase tracking-widest">Your answer</p>}
                  </div>
                );
              })}
            </div>
            <p className="mt-10 text-[#8c827a] font-mono font-bold text-lg">Waiting for the teacher to start the next question...</p>
          </div>
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
      <div className="min-h-screen bg-[#fff5f0] p-6 text-black relative overflow-x-hidden">
        <DashboardBackground />
        <main className="relative z-10 max-w-4xl mx-auto pt-10">
          {status === 'finished' && winner ? (
            <div className="text-center mb-10 animate-bounce backdrop-blur-md bg-white/85 p-10 sm:p-12 rounded-[2.5rem] border-2 border-brand-light shadow-lg">
              <Trophy className="w-20 h-20 text-brand mx-auto mb-4" />
              <p className="text-brand uppercase tracking-widest font-black font-mono text-lg mb-2">
                {isWinner ? 'You are the winner!' : 'Winner'}
              </p>
              <h1 className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-black">{winner.name}</h1>
              <p className="text-[#8c827a] font-bold font-mono text-xl mt-4">
                {winner.correctAnswers} correct answers • {winner.score} points
              </p>
            </div>
          ) : <h1 className="text-4xl sm:text-5xl font-black font-mono tracking-tight mb-8 text-center text-black">Leaderboard</h1>}
          {studentRank > 0 && (
            <p className="mb-6 text-center text-2xl font-black font-mono text-brand">
              Your position: #{studentRank}
            </p>
          )}
          <ol className="space-y-4 font-mono">
            {leaderboard.slice(status === 'finished' ? 1 : 0).map((entry, index) => (
              <li key={entry.studentId} className="rounded-2xl border-2 border-brand-light backdrop-blur-md bg-white/90 p-6 shadow-sm">
                <div className="flex justify-between items-center text-lg sm:text-xl">
                  <span className="font-bold text-black">{index + (status === 'finished' ? 2 : 1)}. {entry.name}</span>
                  <strong className="text-brand font-black">{entry.correctAnswers} correct • {entry.score} pts</strong>
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
            onClick={() => router.push(isInstant ? '/' : '/dashboard/student')}
            className="mt-10 w-full rounded-2xl bg-brand hover:bg-[#c47155] px-8 py-5 font-black font-mono text-2xl text-black transition shadow-md cursor-pointer"
          >
            {isInstant ? 'Back to Home' : 'Return to dashboard'}
          </button>
          {status === 'finished' && isInstant && (
            <div className="mt-8 p-6 rounded-2xl bg-white/95 border-2 border-brand-light text-center font-mono shadow-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/20 text-black text-xs font-bold uppercase mb-2">
                <Zap className="w-3.5 h-3.5 text-brand" />
                <span>Instant Game Finished</span>
              </div>
              <h4 className="text-base font-black text-black">Enjoyed playing live on Quizeee?</h4>
              <p className="text-xs text-[#5c544e] mt-1 max-w-md mx-auto">
                Create a student account to save your scores, build your streak, and participate in classroom assignments!
              </p>
              <button
                onClick={() => router.push('/auth?mode=signup&role=student')}
                className="mt-3 px-6 py-2.5 rounded-xl bg-black hover:bg-brand text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Create Student Account →
              </button>
            </div>
          )}
          {status !== 'finished' && <p className="mt-8 text-[#8c827a] font-mono text-center font-bold">Waiting for the teacher to start the next question...</p>}
        </main>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff5f0] p-6 text-black relative overflow-hidden font-mono">
        <DashboardBackground />
        <div className="relative z-10 backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-12 text-center shadow-lg max-w-md w-full">
          <p className="text-3xl font-black font-mono tracking-tight mb-8 text-black">This live quiz has ended.</p>
          <button
            onClick={() => router.push(isInstant ? '/' : '/dashboard/student')}
            className="w-full rounded-xl bg-brand hover:bg-[#c47155] px-8 py-5 font-black font-mono text-xl text-black transition shadow-sm cursor-pointer"
          >
            {isInstant ? 'Back to Home' : 'Return to dashboard'}
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff5f0] relative overflow-hidden">
        <DashboardBackground />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin" />
          <p className="mt-4 font-mono font-bold text-[#8c827a] text-sm animate-pulse">Loading question...</p>
        </div>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff5f0] p-6 text-center relative overflow-hidden">
        <DashboardBackground />
        <div className="relative z-10 backdrop-blur-md bg-white/85 border-2 border-brand-light rounded-[2.5rem] p-12 max-w-xl w-full shadow-lg text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#edd6cb] border-t-[#E86F47] animate-spin mx-auto mb-6" />
          <h1 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-black">Waiting for next question...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff5f0] p-6 flex flex-col items-center relative overflow-x-hidden">
      <DashboardBackground />
      <main className="relative z-10 max-w-4xl w-full pt-10">
        <div className="flex justify-between items-center mb-8 backdrop-blur-md bg-white/85 border-2 border-brand-light p-6 rounded-2xl shadow-md">
          <p className="text-lg font-black font-mono uppercase tracking-widest text-brand">Live quiz</p>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-[#8c827a]">Time left:</span>
            <span className={`text-2xl font-black font-mono px-5 py-2.5 rounded-xl border-2 transition ${
              timeLeft < 10 ? 'bg-red-50 text-red-600 border-red-300' : 'bg-brand-light text-black border-brand-light'
            }`}>
              {timeLeft}s
            </span>
          </div>
        </div>
        
        <div className="backdrop-blur-md bg-white/85 p-8 sm:p-12 rounded-[2.5rem] shadow-lg border-2 border-brand-light mb-8">
          <h1 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-black mb-10 leading-snug">
            {currentQuestion.question_text}
          </h1>
          <div className="grid gap-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={`${currentQuestion.id}-${index}`}
                onClick={() => handleAnswerSubmit(index)}
                className="w-full rounded-2xl bg-white/95 border-2 border-brand-light p-6 text-left text-xl sm:text-2xl font-bold font-mono text-black shadow-sm transition hover:border-brand hover:bg-brand-lightest hover:scale-[1.01] flex items-center"
              >
                <span className="mr-4 inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full bg-brand-light text-brand font-black border-2 border-brand-light">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="leading-snug">{option}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
