'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { processStudyMaterial } from '@/actions/generateQuiz';
import { UploadCloud, Loader2, CheckCircle, Trash2, Plus } from 'lucide-react';

export default function QuizCreator({ teacherId, onComplete }: { teacherId: string, onComplete?: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [type, setType] = useState('static');
    const [availableFrom, setAvailableFrom] = useState('');
    const [availableUntil, setAvailableUntil] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
    const [isReviewing, setIsReviewing] = useState(false);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) return;
        if (type === 'static' && (!availableFrom || !availableUntil)) {
            setStatus('Set both the static quiz start and end times.');
            return;
        }
        if (type === 'static' && new Date(availableUntil) <= new Date(availableFrom)) {
            setStatus('The quiz end time must be after the start time.');
            return;
        }

        setLoading(true);
        setStatus('Analyzing document and generating AI questions...');

        try {
            // 1. Call AI Server Action
            const formData = new FormData();
            formData.append('file', file);
            formData.append('questionCount', questionCount.toString());

            const aiResponse = await processStudyMaterial(formData);

            if (!aiResponse.success) throw new Error(aiResponse.error);

            // 2. Load the questions into state and switch to the review screen
            setGeneratedQuestions(aiResponse.questions);
            setIsReviewing(true);
            setStatus('Questions generated successfully! Please review them.');

        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleQuestionChange = (index: number, newText: string) => {
        const updatedQuestions = [...generatedQuestions];
        updatedQuestions[index].question_text = newText;
        setGeneratedQuestions(updatedQuestions);
    };

    const handleOptionChange = (questionIndex: number, optionIndex: number, newText: string) => {
        const updatedQuestions = [...generatedQuestions];
        updatedQuestions[questionIndex].options[optionIndex] = newText;
        setGeneratedQuestions(updatedQuestions);
    };

    const handleCorrectAnswerChange = (questionIndex: number, correctIndex: number) => {
        const updatedQuestions = [...generatedQuestions];
        updatedQuestions[questionIndex].correct_option_index = correctIndex;
        setGeneratedQuestions(updatedQuestions);
    };

    const handleDeleteQuestion = (index: number) => {
        const updatedQuestions = [...generatedQuestions];
        updatedQuestions.splice(index, 1);
        setGeneratedQuestions(updatedQuestions);
    };

    const handleAddQuestion = () => {
        setGeneratedQuestions([
            ...generatedQuestions,
            {
                question_text: '',
                options: ['', '', '', ''],
                correct_option_index: 0,
                explanation: '',
                subtopic: ''
            }
        ]);
    };

    const handleSaveQuiz = async () => {
        setLoading(true);
        setStatus('Saving quiz to database...');

        try {
            // 1. Insert parent quiz record
            const { data: quizData, error: quizError } = await supabase
                .from('quizzes')
                .insert({
                    teacher_id: teacherId,
                    title: title,
                    type: type, 
                    available_from: type === 'static' ? new Date(availableFrom).toISOString() : null,
                    available_until: type === 'static' ? new Date(availableUntil).toISOString() : null,
                })
                .select()
                .single();

            if (quizError) throw quizError;

            // 2. Attach quiz_id and order index to the reviewed questions
            const questionsToInsert = generatedQuestions.map((q: any, index: number) => ({
                quiz_id: quizData.id,
                question_text: q.question_text,
                options: q.options,
                correct_option_index: q.correct_option_index,
                explanation: q.explanation,
                subtopic: q.subtopic,
                order_index: index + 1,
            }));

            // 3. Bulk insert child question records
            const { error: questionsError } = await supabase
                .from('questions')
                .insert(questionsToInsert);

            if (questionsError) throw questionsError;

            setStatus('Quiz saved successfully!');
            setTimeout(() => {
                setStatus('');
                setFile(null);
                setTitle('');
                setAvailableFrom('');
                setAvailableUntil('');
                setGeneratedQuestions([]);
                setIsReviewing(false);
                if (onComplete) onComplete();
            }, 2000);
        } catch (error: any) {
            console.error(error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (isReviewing) {
        return (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-h-[80vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Review Generated Questions</h3>
                <p className="text-gray-500 mb-6 text-sm">Make any necessary edits before saving to the database.</p>
                
                <div className="space-y-8">
                    {generatedQuestions.map((q, qIndex) => (
                        <div key={qIndex} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-bold text-gray-700">Question {qIndex + 1}</label>
                                <button
                                    onClick={() => handleDeleteQuestion(qIndex)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Delete Question"
                                    type="button"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                            <textarea
                                value={q.question_text}
                                onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                                className="w-full px-4 py-2 mb-4 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                rows={2}
                            />
                            
                            <div className="space-y-3">
                                {q.options.map((option: string, oIndex: number) => (
                                    <div key={oIndex} className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name={`correct-${qIndex}`}
                                            checked={q.correct_option_index === oIndex}
                                            onChange={() => handleCorrectAnswerChange(qIndex, oIndex)}
                                            className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={() => setIsReviewing(false)}
                        className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                    >
                        Cancel & Discard
                    </button>
                    <button
                        onClick={handleAddQuestion}
                        className="flex-1 py-3 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 transition flex items-center justify-center gap-2"
                        type="button"
                    >
                        <Plus className="w-5 h-5" /> Add Question
                    </button>
                    <button
                        onClick={handleSaveQuiz}
                        disabled={loading}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg transition"
                    >
                        {loading ? 'Saving to Database...' : 'Confirm & Save Quiz'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Generate AI Quiz</h3>
            <form onSubmit={handleUpload} className="space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1">
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
                    <div className="w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            <option value="static">Static (Self-paced)</option>
                            <option value="competitive">Competitive (Live)</option>
                        </select>
                    </div>
                </div>

                {type === 'static' && (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-lg bg-indigo-50 p-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Available from</label>
                            <input
                                type="datetime-local"
                                required
                                value={availableFrom}
                                onChange={(e) => setAvailableFrom(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Available until</label>
                            <input
                                type="datetime-local"
                                required
                                value={availableUntil}
                                onChange={(e) => setAvailableUntil(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                            />
                        </div>
                    </div>
                )}

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