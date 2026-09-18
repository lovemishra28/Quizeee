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
        <div className="bg-brand-lightest p-8 rounded-[2rem] border border-brand-light shadow-sm mb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h3 className="text-5xl sm:text-6xl font-bold font-mono tracking-tighter text-black">Create Quiz</h3>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setType('static')}
                        className={`px-6 sm:px-8 py-2 sm:py-3 rounded-xl font-mono text-lg sm:text-xl font-bold border-2 transition ${type === 'static' ? 'bg-white border-brand-light text-black shadow-sm' : 'border-transparent text-gray-500 hover:text-black'}`}
                    >
                        Static
                    </button>
                    <button
                        type="button"
                        onClick={() => setType('competitive')}
                        className={`px-6 sm:px-8 py-2 sm:py-3 rounded-xl font-mono text-lg sm:text-xl font-bold border-2 transition ${type === 'competitive' ? 'bg-brand border-brand text-black shadow-sm' : 'border-transparent text-gray-500 hover:text-black'}`}
                    >
                        Competitive
                    </button>
                </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-stretch">
                    <div className="flex-1 flex flex-col justify-between gap-6">
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Title...."
                            className="w-full px-6 py-6 border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none bg-white text-2xl font-light placeholder:text-gray-400"
                        />
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={Number.isNaN(questionCount) ? '' : questionCount}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setQuestionCount(isNaN(val) ? 0 : val);
                            }}
                            placeholder="No. of Questions"
                            className="w-full px-6 py-6 border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none bg-white text-2xl font-light placeholder:text-gray-400"
                        />
                    </div>
                    
                    <div className="w-full sm:w-[350px]">
                        <label className="flex flex-col items-center justify-center w-full h-full min-h-[160px] border-2 border-brand-light rounded-xl cursor-pointer bg-white hover:bg-gray-50 transition">
                            <div className="flex flex-col items-center justify-center p-8">
                                <UploadCloud className="w-10 h-10 text-black mb-4" />
                                <p className="text-sm text-black text-center">
                                    <span className="font-bold">Click to Upload</span> or drag<br/>and drop
                                </p>
                                {file && <p className="text-xs text-brand mt-4 font-bold">{file.name}</p>}
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

                {type === 'static' && (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-xl bg-white/50 border border-brand-light p-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Available from</label>
                            <input
                                type="datetime-local"
                                required
                                value={availableFrom}
                                onChange={(e) => setAvailableFrom(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-brand-light rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Available until</label>
                            <input
                                type="datetime-local"
                                required
                                value={availableUntil}
                                onChange={(e) => setAvailableUntil(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-brand-light rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white"
                            />
                        </div>
                    </div>
                )}

                {status && (
                    <div className={`p-4 rounded-xl text-sm flex items-center font-medium ${status.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        {loading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-3" />}
                        {status}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !file || !title}
                    className="w-full py-5 bg-brand hover:bg-[#c47155] disabled:bg-brand-light text-black font-mono text-3xl font-normal tracking-wide rounded-xl transition shadow-sm"
                >
                    {loading ? 'Processing...' : 'Generate Quiz'}
                </button>
            </form>
        </div>
    );
}