'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client runs only on the server, safely bypassing RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

interface SubmitStaticQuizParams {
    quizId: string;
    userId: string;
    answers: Record<string, number>;
}

export async function submitStaticQuiz({ quizId, userId, answers }: SubmitStaticQuizParams) {
    try {
        if (!quizId || !userId) {
            throw new Error('Missing required quiz or user information');
        }

        // 1. Fetch official questions from the database to securely grade on backend
        const { data: questions, error: questionsError } = await supabaseAdmin
            .from('questions')
            .select('id, correct_option_index')
            .eq('quiz_id', quizId)
            .order('order_index', { ascending: true });

        if (questionsError || !questions) {
            throw new Error(questionsError?.message || 'Failed to fetch questions for grading');
        }

        // 2. Create the completed quiz session using service-role permissions
        const { data: sessionData, error: sessionError } = await supabaseAdmin
            .from('quiz_sessions')
            .insert({
                quiz_id: quizId,
                status: 'completed',
                room_code: Math.floor(100000 + Math.random() * 900000).toString(),
            })
            .select()
            .single();

        if (sessionError || !sessionData) {
            throw new Error(sessionError?.message || 'Failed to create quiz session');
        }

        // 3. Server-side grading of student answers
        let correctCount = 0;
        const submissionsToInsert = questions.map((q) => {
            const selectedIndex = answers[q.id] ?? -1;
            const isCorrect = selectedIndex === q.correct_option_index;

            if (isCorrect) correctCount++;

            return {
                session_id: sessionData.id,
                student_id: userId,
                question_id: q.id,
                selected_option_index: selectedIndex,
                is_correct: isCorrect,
                score_awarded: isCorrect ? 10 : 0,
                response_time_ms: 0,
            };
        });

        // 4. Bulk insert submissions
        const { error: subError } = await supabaseAdmin
            .from('submissions')
            .insert(submissionsToInsert);

        if (subError) {
            throw new Error(subError.message);
        }

        return {
            success: true,
            score: correctCount,
            totalQuestions: questions.length,
        };
    } catch (error: any) {
        console.error('Error submitting static quiz:', error);
        return {
            success: false,
            error: error.message || 'Failed to submit quiz',
        };
    }
}
