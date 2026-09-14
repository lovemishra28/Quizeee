'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { processStudyMaterial } from '@/actions/generateQuiz';
import { UploadCloud, Loader2, CheckCircle } from 'lucide-react';

export default function QuizCreator({ teacherId, onComplete }: { teacherId: string, onComplete?: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) return;

        setLoading(true);
        setStatus('Analyzing document and generating AI questions...');

        try {
            // 1. Call AI Server Action
            const formData = new FormData();
            formData.append('file', file);
            formData.append('questionCount', questionCount.toString());

            const aiResponse = await processStudyMaterial(formData);

            if (!aiResponse.success) throw new Error(aiResponse.error);

            setStatus('Structuring and saving to database...');

            // 2. Insert parent quiz record
            const { data: quizData, error: quizError } = await supabase
                .from('quizzes')
                .insert({
                    teacher_id: teacherId,
                    title: title,
                    type: 'competitive', // Defaulting to competitive for now
                })
                .select()
                .single();

            if (quizError) throw quizError;

            // 3. Attach quiz_id and order index to AI questions
            const questionsToInsert = aiResponse.questions.map((q: any, index: number) => ({
                quiz_id: quizData.id,
                question_text: q.question_text,
                options: q.options,
                correct_option_index: q.correct_option_index,
                explanation: q.explanation,
                subtopic: q.subtopic,
                order_index: index + 1,
            }));

            // 4. Bulk insert child question records
            const { error: questionsError } = await supabase
                .from('questions')
                .insert(questionsToInsert);

            if (questionsError) throw questionsError;

            setStatus('Quiz created successfully!');
            setTimeout(() => {
                setStatus('');
                setFile(null);
                setTitle('');
                if (onComplete) onComplete();
            }, 2000);

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Generate AI Quiz</h3>
            <form onSubmit={handleUpload} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Biology Chapter 4: Cell Division"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Study Material (PDF)</label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500">
                                        <span className="font-semibold">Click to upload</span> or drag and drop
                                    </p>
                                    {file && <p className="text-xs text-indigo-600 mt-2 font-medium">{file.name}</p>}
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="application/pdf"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Questions</label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={Number.isNaN(questionCount) ? '' : questionCount}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setQuestionCount(isNaN(val) ? 0 : val);
                            }}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                {status && (
                    <div className={`p-3 rounded-lg text-sm flex items-center ${status.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        {status}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !file || !title}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg transition"
                >
                    {loading ? 'Processing...' : 'Generate Questions'}
                </button>
            </form>
        </div>
    );
}