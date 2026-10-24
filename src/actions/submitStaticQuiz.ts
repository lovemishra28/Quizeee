'use server';

import { isRecord, isUuid } from '@/lib/quizValidation';
import { ActionError, logActionError, publicActionError } from '@/lib/server/errors';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase';
import { withSubmissionLock } from '@/lib/server/rateLimit';

interface SubmitStaticQuizParams {
    quizId: string;
    accessToken: string;
    answers: Record<string, number>;
    sessionId?: string;
}

export async function submitStaticQuiz(input: SubmitStaticQuizParams) {
    try {
        if (!isRecord(input) || !isUuid(input.quizId) || (input.sessionId !== undefined && !isUuid(input.sessionId)) || !isRecord(input.answers) || Object.keys(input.answers).length > 20) {
            throw new ActionError('Invalid quiz submission. Please reopen the quiz and try again.');
        }
        const { user } = await requireUser(input.accessToken, 'student');
        const admin = getSupabaseAdmin();
        const { data: quiz, error: quizError } = await admin.from('quizzes')
            .select('id, type, available_from, available_until').eq('id', input.quizId).single();
        if (quizError || !quiz || quiz.type !== 'static') throw new ActionError('This static quiz is unavailable.', 'QUIZ_UNAVAILABLE');
        const now = Date.now();
        const startsAt = quiz.available_from ? Date.parse(quiz.available_from) : null;
        const endsAt = quiz.available_until ? Date.parse(quiz.available_until) : null;
        if ((startsAt !== null && (!Number.isFinite(startsAt) || now < startsAt)) || (endsAt !== null && (!Number.isFinite(endsAt) || now >= endsAt))) {
            throw new ActionError('This quiz is outside its availability window.', 'QUIZ_CLOSED');
        }
        let sessionQuery = admin.from('quiz_sessions').select('id, quiz_id, status').eq('quiz_id', input.quizId).in('status', ['waiting', 'active']);
        if (input.sessionId) sessionQuery = sessionQuery.eq('id', input.sessionId);
        const { data: sessions, error: sessionError } = await sessionQuery.order('created_at', { ascending: false }).limit(1);
        const session = sessions?.[0];
        if (sessionError || !session) throw new ActionError('The quiz session is unavailable. Rejoin using your teacher’s code.', 'SESSION_UNAVAILABLE');

        return await withSubmissionLock(`${session.id}:${user.id}`, async () => {
            const { data: existing, error: existingError } = await admin.from('submissions').select('id').eq('session_id', session.id).eq('student_id', user.id).limit(1);
            if (existingError) throw new Error('Unable to verify attempt');
            if (existing?.length) throw new ActionError('This attempt has already been submitted. View it in your quiz history.', 'ALREADY_SUBMITTED');

            const { data: questions, error: questionsError } = await admin.from('questions')
                .select('id, options, correct_option_index').eq('quiz_id', input.quizId).order('order_index', { ascending: true });
            if (questionsError || !questions?.length || questions.length > 20 || questions.some(question => !Array.isArray(question.options) || question.options.length !== 4 || !Number.isInteger(question.correct_option_index) || question.correct_option_index < 0 || question.correct_option_index > 3)) {
                throw new ActionError('This quiz is not ready for submission. Please contact your teacher.', 'INVALID_QUIZ');
            }
            const validIds = new Set(questions.map(question => question.id));
            for (const [questionId, selectedIndex] of Object.entries(input.answers)) {
                if (!validIds.has(questionId) || typeof selectedIndex !== 'number' || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
                    throw new ActionError('The submission contains an invalid answer. Please reopen the quiz.');
                }
            }
            let correctCount = 0;
            const submissions = questions.map(question => {
                const selectedIndex = input.answers[question.id] ?? -1;
                const isCorrect = selectedIndex === question.correct_option_index;
                if (isCorrect) correctCount++;
                return { session_id: session.id, student_id: user.id, question_id: question.id, selected_option_index: selectedIndex, is_correct: isCorrect, score_awarded: isCorrect ? 10 : 0, response_time_ms: 0 };
            });
            const { error: submissionError } = await admin.from('submissions').insert(submissions);
            if (submissionError) throw new Error('Submission persistence failed');
            return { success: true as const, score: correctCount, totalQuestions: questions.length, sessionId: session.id };
        });
    } catch (error) {
        logActionError('static-submit', error);
        return { success: false as const, error: publicActionError(error, 'Unable to record your answers. Please try again.') };
    }
}
