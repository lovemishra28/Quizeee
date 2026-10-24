'use server';

import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { isRecord, validateQuizQuestions } from '@/lib/quizValidation';
import { ActionError, logActionError, publicActionError } from '@/lib/server/errors';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { limitPublicAction } from '@/lib/server/rateLimit';

export interface InstantQuestionInput {
    question_text: string;
    options: string[];
    correct_option_index: number;
    explanation?: string;
    subtopic?: string;
}

export interface CreateInstantQuizParams {
    title: string;
    questions: InstantQuestionInput[];
    perQuestionTimer?: number;
}

// Each guest receives an isolated account; no reusable system-host identity is distributed.
async function createGuestAccount(fullName: string, role: 'teacher' | 'student') {
    const admin = getSupabaseAdmin();
    const email = `guest_${role}_${randomUUID()}@guest.quizeee.internal`;
    const password = `Guest_A1!${randomBytes(32).toString('base64url')}`;
    const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName, role, is_guest: true },
    });
    if (error || !data.user) throw new Error('Guest account creation failed');
    const { error: profileError } = await admin.from('profiles').upsert({ id: data.user.id, full_name: fullName, role });
    if (profileError) throw new Error('Guest profile creation failed');
    return { id: data.user.id, email, password };
}

export async function createInstantQuizAction(input: CreateInstantQuizParams) {
    try {
        if (!isRecord(input) || typeof input.title !== 'string' || input.title.trim().length > 200) {
            throw new ActionError('Enter a quiz title of at most 200 characters.');
        }
        let questions;
        try { questions = validateQuizQuestions(input.questions); }
        catch (error) { throw new ActionError(error instanceof Error ? error.message : 'Review the quiz questions.'); }
        const timer = input.perQuestionTimer ?? 30;
        if (!Number.isInteger(timer) || timer < 1 || timer > 300) throw new ActionError('Choose a question timer between 1 and 300 seconds.');
        await limitPublicAction('instant-create', 5);
        const admin = getSupabaseAdmin();
        const host = await createGuestAccount('Instant Host', 'teacher');
        const { data: quiz, error: quizError } = await admin.from('quizzes').insert({
            teacher_id: host.id,
            title: input.title.trim() || 'Instant Competitive Quiz',
            type: 'competitive', per_question_timer: timer,
            description: 'Instant competitive quiz (temporary)',
        }).select('id').single();
        if (quizError || !quiz) throw new Error('Quiz creation failed');

        try {
            const { error: questionsError } = await admin.from('questions').insert(questions.map((question, index) => ({ ...question, quiz_id: quiz.id, order_index: index + 1 })));
            if (questionsError) throw new Error('Question creation failed');
            const roomCode = randomInt(100000, 1000000).toString();
            const { data: session, error: sessionError } = await admin.from('quiz_sessions').insert({
                quiz_id: quiz.id, room_code: roomCode, status: 'waiting', current_question_index: -1,
            }).select('id, room_code').single();
            if (sessionError || !session) throw new Error('Room creation failed');
            return { success: true, quizId: quiz.id, sessionId: session.id, roomCode: session.room_code, hostEmail: host.email, hostPassword: host.password };
        } catch (error) {
            // Compensate only records created by this request. Database transactions remain a launch requirement.
            const { error: questionCleanupError } = await admin.from('questions').delete().eq('quiz_id', quiz.id);
            const { error: quizCleanupError } = await admin.from('quizzes').delete().eq('id', quiz.id);
            if (questionCleanupError || quizCleanupError) logActionError('instant-create-cleanup', error);
            throw error;
        }
    } catch (error) {
        logActionError('instant-create', error);
        return { success: false, error: publicActionError(error, 'Unable to create the quiz room. Please try again.') };
    }
}

export async function joinInstantQuizAction(input: { roomCode: string; nickname: string }) {
    try {
        if (!isRecord(input) || typeof input.roomCode !== 'string' || !/^\d{6}$/.test(input.roomCode.trim())) {
            throw new ActionError('Please enter a valid 6-digit room code.');
        }
        if (typeof input.nickname !== 'string' || !input.nickname.trim() || input.nickname.trim().length > 24) {
            throw new ActionError('Enter a nickname between 1 and 24 characters.');
        }
        // Accommodate a classroom behind one shared school/NAT address.
        await limitPublicAction('guest-join', 200);
        const admin = getSupabaseAdmin();
        const { data: session, error } = await admin.from('quiz_sessions')
            .select('id, quiz_id, status, room_code, quizzes(type)')
            .eq('room_code', input.roomCode.trim()).in('status', ['waiting', 'active'])
            .order('created_at', { ascending: false }).limit(1).single();
        const quiz = Array.isArray(session?.quizzes) ? session.quizzes[0] : session?.quizzes;
        if (error || !session || quiz?.type !== 'competitive') throw new ActionError('No open live quiz was found for this room code.', 'ROOM_UNAVAILABLE');
        const guest = await createGuestAccount(input.nickname.trim(), 'student');
        return { success: true, roomCode: session.room_code, sessionId: session.id, quizId: session.quiz_id, studentId: guest.id, nickname: input.nickname.trim(), guestEmail: guest.email, guestPassword: guest.password };
    } catch (error) {
        logActionError('guest-join', error);
        return { success: false, error: publicActionError(error, 'Unable to join this room. Please try again.') };
    }
}
