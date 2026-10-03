'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const INSTANT_HOST_EMAIL = 'instanthost@quizeee.app';
const INSTANT_HOST_PASSWORD = 'InstantHostPassword123!@#';

/**
 * Ensures a designated system guest host user exists in Supabase Auth & Profiles.
 */
async function getOrCreateInstantHostUser() {
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    let hostUser = usersData?.users?.find((u) => u.email === INSTANT_HOST_EMAIL);

    if (!hostUser) {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: INSTANT_HOST_EMAIL,
            password: INSTANT_HOST_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: 'Instant Host' },
        });

        if (createError || !newUser?.user) {
            throw new Error(`Failed to initialize instant host: ${createError?.message}`);
        }
        hostUser = newUser.user;

        await supabaseAdmin.from('profiles').upsert({
            id: hostUser.id,
            full_name: 'Instant Host',
            role: 'teacher',
        });
    }

    return hostUser;
}

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

/**
 * Creates an instant competitive quiz and initializes a live room session.
 * No user login required by caller. Uses secure admin credentials on server.
 */
export async function createInstantQuizAction({
    title,
    questions,
    perQuestionTimer = 30,
}: CreateInstantQuizParams) {
    try {
        if (!questions || questions.length === 0) {
            throw new Error('At least one question is required to create a quiz.');
        }

        const hostUser = await getOrCreateInstantHostUser();

        // 1. Insert into quizzes table (competitive only, temporary session)
        const quizTitle = title.trim() || 'Instant Competitive Quiz';
        const { data: quizData, error: quizError } = await supabaseAdmin
            .from('quizzes')
            .insert({
                teacher_id: hostUser.id,
                title: quizTitle,
                type: 'competitive',
                per_question_timer: perQuestionTimer,
                description: 'Instant competitive quiz (temporary)',
            })
            .select()
            .single();

        if (quizError || !quizData) {
            throw new Error(quizError?.message || 'Failed to create instant quiz.');
        }

        // 2. Insert questions
        const questionsToInsert = questions.map((q, idx) => ({
            quiz_id: quizData.id,
            question_text: q.question_text,
            options: q.options,
            correct_option_index: q.correct_option_index,
            explanation: q.explanation || '',
            subtopic: q.subtopic || 'General',
            order_index: idx + 1,
        }));

        const { error: questionsError } = await supabaseAdmin
            .from('questions')
            .insert(questionsToInsert);

        if (questionsError) {
            // Rollback quiz
            await supabaseAdmin.from('quizzes').delete().eq('id', quizData.id);
            throw new Error(questionsError.message || 'Failed to save questions.');
        }

        // 3. Generate a 6-digit room code
        let roomCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Create waiting live session
        const { data: sessionData, error: sessionError } = await supabaseAdmin
            .from('quiz_sessions')
            .insert({
                quiz_id: quizData.id,
                room_code: roomCode,
                status: 'waiting',
                current_question_index: -1,
            })
            .select()
            .single();

        if (sessionError || !sessionData) {
            throw new Error(sessionError?.message || 'Failed to initialize live room session.');
        }

        return {
            success: true,
            quizId: quizData.id,
            sessionId: sessionData.id,
            roomCode,
            hostEmail: INSTANT_HOST_EMAIL,
            hostPassword: INSTANT_HOST_PASSWORD,
        };
    } catch (err: any) {
        console.error('[createInstantQuizAction Error]', err);
        return {
            success: false,
            error: err.message || 'Failed to create instant quiz.',
        };
    }
}

/**
 * Validates a room code and creates an instant guest student account to participate live.
 */
export async function joinInstantQuizAction({
    roomCode,
    nickname,
}: {
    roomCode: string;
    nickname: string;
}) {
    try {
        const cleanCode = roomCode.trim().replace(/\s+/g, '');
        const cleanName = nickname.trim() || 'Player';

        if (!cleanCode || cleanCode.length < 4) {
            throw new Error('Please enter a valid room code.');
        }

        // 1. Verify the session exists and is active or waiting
        const { data: sessionData, error: sessionError } = await supabaseAdmin
            .from('quiz_sessions')
            .select('id, quiz_id, status, room_code')
            .eq('room_code', cleanCode)
            .in('status', ['waiting', 'active', 'leaderboard', 'finished'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (sessionError || !sessionData) {
            throw new Error('No active quiz found for room code: ' + cleanCode);
        }

        // 2. Generate a lightweight guest credentials
        const unique = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        const guestEmail = `guest_${unique}@guest.quizeee.internal`;
        const guestPassword = `Guest!_${unique}`;

        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: guestEmail,
            password: guestPassword,
            email_confirm: true,
            user_metadata: { full_name: cleanName },
        });

        if (userError || !userData?.user) {
            throw new Error('Unable to create guest session: ' + userError?.message);
        }

        // 3. Upsert profile as student
        await supabaseAdmin.from('profiles').upsert({
            id: userData.user.id,
            full_name: cleanName,
            role: 'student',
        });

        return {
            success: true,
            roomCode: sessionData.room_code,
            sessionId: sessionData.id,
            quizId: sessionData.quiz_id,
            studentId: userData.user.id,
            nickname: cleanName,
            guestEmail,
            guestPassword,
        };
    } catch (err: any) {
        console.error('[joinInstantQuizAction Error]', err);
        return {
            success: false,
            error: err.message || 'Unable to join quiz room.',
        };
    }
}
