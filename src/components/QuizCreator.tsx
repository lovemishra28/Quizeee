'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { processStudyMaterial } from '@/actions/generateQuiz';
import { UploadCloud, Loader2, CheckCircle, Trash2, Plus, Calendar, Clock } from 'lucide-react';

const formatForInput = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return '';
    }
};

const getTodayPreset = () => {
    const from = new Date();
    const until = new Date();
    until.setHours(23, 59, 0, 0);
    return {
        from: formatForInput(from),
        until: formatForInput(until),
    };
};

const getTomorrowPreset = () => {
    const from = new Date();
    from.setDate(from.getDate() + 1);
    from.setHours(8, 0, 0, 0);
    const until = new Date();
    until.setDate(until.getDate() + 1);
    until.setHours(23, 59, 0, 0);
    return {
        from: formatForInput(from),
        until: formatForInput(until),
    };
};

export default function QuizCreator({ teacherId, onComplete }: { teacherId: string, onComplete?: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [type, setType] = useState('static');
    const [schedulePreset, setSchedulePreset] = useState<'today' | 'tomorrow' | 'custom'>('today');
    const [availableFrom, setAvailableFrom] = useState('');
    const [availableUntil, setAvailableUntil] = useState('');
    const [totalDurationMinutes, setTotalDurationMinutes] = useState<number>(45);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
    const [isReviewing, setIsReviewing] = useState(false);

    const fromInputRef = useRef<HTMLInputElement>(null);
    const untilInputRef = useRef<HTMLInputElement>(null);

    // Auto-populate 'Today' preset when static mode is active and empty
    useEffect(() => {
        if (type === 'static' && (!availableFrom || !availableUntil)) {
            const { from, until } = getTodayPreset();
            setAvailableFrom(from);
            setAvailableUntil(until);
            setSchedulePreset('today');
        }
    }, [type]);

    const applyPreset = (preset: 'today' | 'tomorrow') => {
        setSchedulePreset(preset);
        if (preset === 'today') {
            const { from, until } = getTodayPreset();
            setAvailableFrom(from);
            setAvailableUntil(until);
        } else if (preset === 'tomorrow') {
            const { from, until } = getTomorrowPreset();
            setAvailableFrom(from);
            setAvailableUntil(until);
        }
    };

    const openCalendar = (ref: React.RefObject<HTMLInputElement | null>) => {
        try {
            const input = ref.current;
            if (input) {
                if (typeof (input as any).showPicker === 'function') {
                    (input as any).showPicker();
                } else {
                    input.focus();
                }
            }
        } catch {
            ref.current?.focus();
        }
    };

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

            if (!aiResponse.success || !aiResponse.questions) {
                throw new Error(aiResponse.error || 'Failed to generate questions');
            }

            // 2. Load the questions into state and switch to the review screen
            setGeneratedQuestions(aiResponse.questions);
            setIsReviewing(true);
            setStatus(
                aiResponse.isMultimodal
                    ? 'Questions generated successfully from presentation slides using AI Vision! Please review them.'
                    : 'Questions generated successfully! Please review them.'
            );

        } catch (error: any) {
            console.error(error);
            const msg = error.message || 'Failed to process document';
            if (msg.toLowerCase().includes('fetch')) {
                setStatus('Error: Upload interrupted or server took too long. Please try again.');
            } else {
                setStatus(`Error: ${msg}`);
            }
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
                    total_duration_minutes: type === 'static' ? Math.max(1, Number(totalDurationMinutes) || 45) : null,
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
                const { from, until } = getTodayPreset();
                setAvailableFrom(from);
                setAvailableUntil(until);
                setSchedulePreset('today');
                setTotalDurationMinutes(45);
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
            <div className="bg-brand-lightest p-8 sm:p-10 rounded-[2rem] border-2 border-brand-light shadow-md max-h-[85vh] overflow-y-auto mb-12">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-brand font-bold font-mono uppercase tracking-widest text-sm mb-1">Question Review</p>
                        <h3 className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-black">Review Generated Questions</h3>
                        <p className="text-[#8c827a] font-mono text-base mt-1">Make any necessary edits or adjustments before saving to the database.</p>
                    </div>
                    <span className="px-4 py-2 rounded-xl bg-white border-2 border-brand-light font-mono font-black text-black text-sm shadow-sm shrink-0">
                        {generatedQuestions.length} Questions
                    </span>
                </div>

                <div className="space-y-6">
                    {generatedQuestions.map((q, qIndex) => (
                        <div key={qIndex} className="p-6 bg-white/90 backdrop-blur-md rounded-2xl border-2 border-brand-light shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-base font-bold font-mono text-black">Question {qIndex + 1}</label>
                                <button
                                    onClick={() => handleDeleteQuestion(qIndex)}
                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition"
                                    title="Delete Question"
                                    type="button"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                            <textarea
                                value={q.question_text}
                                onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                                className="w-full px-5 py-3 mb-4 border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none resize-none bg-white text-[#1c1917] font-mono font-bold text-lg leading-relaxed shadow-sm"
                                rows={2}
                            />

                            <div className="space-y-3">
                                {q.options.map((option: string, oIndex: number) => (
                                    <div key={oIndex} className="flex items-center gap-3">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`correct-${qIndex}`}
                                                checked={q.correct_option_index === oIndex}
                                                onChange={() => handleCorrectAnswerChange(qIndex, oIndex)}
                                                className="w-5 h-5 accent-[#E86F47] cursor-pointer"
                                            />
                                        </label>
                                        <div className="flex-1 flex items-center bg-white border-2 border-brand-light rounded-xl px-4 py-2.5 focus-within:border-brand shadow-sm">
                                            <span className="font-mono font-black text-brand mr-3 text-lg">
                                                {String.fromCharCode(65 + oIndex)}.
                                            </span>
                                            <input
                                                type="text"
                                                value={option}
                                                onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                className="w-full outline-none bg-transparent text-[#1c1917] font-mono font-bold text-base"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4 pt-4 border-t-2 border-brand-light/60">
                    <button
                        onClick={() => setIsReviewing(false)}
                        className="flex-1 py-4 bg-white border-2 border-brand-light text-black font-bold font-mono text-lg rounded-xl hover:bg-brand-lightest transition shadow-sm"
                        type="button"
                    >
                        Cancel & Discard
                    </button>
                    <button
                        onClick={handleAddQuestion}
                        className="flex-1 py-4 bg-brand-light text-black border-2 border-brand-light hover:border-brand font-bold font-mono text-lg rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                        type="button"
                    >
                        <Plus className="w-5 h-5" /> Add Question
                    </button>
                    <button
                        onClick={handleSaveQuiz}
                        disabled={loading}
                        className="flex-1 py-4 bg-brand hover:bg-[#c47155] disabled:bg-brand-light text-black font-black font-mono text-xl rounded-xl transition shadow-sm"
                        type="button"
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
                            className="w-full px-6 py-6 border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none bg-white text-2xl font-mono font-bold text-[#1c1917] placeholder:text-[#8c827a] placeholder:font-normal"
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
                            className="w-full px-6 py-6 border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none bg-white text-2xl font-mono font-bold text-[#1c1917] placeholder:text-[#8c827a] placeholder:font-normal"
                        />
                    </div>

                    <div className="w-full sm:w-[350px]">
                        <label className="flex flex-col items-center justify-center w-full h-full min-h-[160px] border-2 border-brand-light rounded-xl cursor-pointer bg-white hover:bg-gray-50 transition">
                            <div className="flex flex-col items-center justify-center p-8">
                                <UploadCloud className="w-10 h-10 text-black mb-4" />
                                <p className="text-sm text-black text-center">
                                    <span className="font-bold">Click to Upload</span> or drag<br />and drop
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
                    <div className="rounded-2xl bg-white/80 border-2 border-brand-light p-6 shadow-sm space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <label className="block text-base font-mono font-bold text-black">
                                    Quiz Availability Window
                                </label>
                                <p className="text-xs font-mono text-[#8c827a] mt-0.5">
                                    Select quick dates or open the calendar to schedule
                                </p>
                            </div>

                            {/* Quick Presets: Today, Tomorrow, Others */}
                            <div className="inline-flex p-1.5 bg-[#fbf5f0] border-2 border-brand-light rounded-xl gap-1.5 self-start sm:self-auto">
                                <button
                                    type="button"
                                    onClick={() => applyPreset('today')}
                                    className={`px-4 py-1.5 rounded-lg font-mono text-sm font-bold transition flex items-center gap-1.5 ${schedulePreset === 'today'
                                            ? 'bg-brand text-black shadow-sm'
                                            : 'text-[#5c544e] hover:text-black hover:bg-white/60'
                                        }`}
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('tomorrow')}
                                    className={`px-4 py-1.5 rounded-lg font-mono text-sm font-bold transition flex items-center gap-1.5 ${schedulePreset === 'tomorrow'
                                            ? 'bg-brand text-black shadow-sm'
                                            : 'text-[#5c544e] hover:text-black hover:bg-white/60'
                                        }`}
                                >
                                    Tomorrow
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSchedulePreset('custom');
                                        setTimeout(() => openCalendar(fromInputRef), 50);
                                    }}
                                    className={`px-4 py-1.5 rounded-lg font-mono text-sm font-bold transition flex items-center gap-1.5 ${schedulePreset === 'custom'
                                            ? 'bg-brand text-black shadow-sm'
                                            : 'text-[#5c544e] hover:text-black hover:bg-white/60'
                                        }`}
                                >
                                    <Calendar className="w-4 h-4 text-brand" />
                                    Others
                                </button>
                            </div>
                        </div>

                        {/* Date & Time Pickers with Direct Calendar Popout */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-mono font-bold text-[#1c1917] mb-1.5">
                                    Available from
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        ref={fromInputRef}
                                        type="datetime-local"
                                        required
                                        value={availableFrom}
                                        onChange={(e) => {
                                            setAvailableFrom(e.target.value);
                                            setSchedulePreset('custom');
                                        }}
                                        style={{ colorScheme: 'light' }}
                                        className="w-full px-4 py-3 pr-24 border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none bg-white font-mono text-base font-bold text-[#1c1917] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openCalendar(fromInputRef)}
                                        className="absolute right-2 px-2.5 py-1.5 rounded-lg bg-brand/15 hover:bg-brand text-black font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                        title="Open calendar picker"
                                    >
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Pick</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-mono font-bold text-[#1c1917] mb-1.5">
                                    Available until
                                </label>
                                <div className="relative flex items-center">
                                    <input
                                        ref={untilInputRef}
                                        type="datetime-local"
                                        required
                                        value={availableUntil}
                                        onChange={(e) => {
                                            setAvailableUntil(e.target.value);
                                            setSchedulePreset('custom');
                                        }}
                                        style={{ colorScheme: 'light' }}
                                        className="w-full px-4 py-3 pr-24 border-2 border-brand-light rounded-xl focus:ring-2 focus:ring-brand outline-none bg-white font-mono text-base font-bold text-[#1c1917] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openCalendar(untilInputRef)}
                                        className="absolute right-2 px-2.5 py-1.5 rounded-lg bg-brand/15 hover:bg-brand text-black font-mono text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                        title="Open calendar picker"
                                    >
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Pick</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Static Quiz Duration (Timer) Setting */}
                        <div className="pt-3 border-t border-brand-light/60">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-mono font-bold text-[#1c1917]">
                                        <Clock className="w-4 h-4 text-brand" />
                                        Quiz Time Limit (Timer)
                                    </label>
                                    <p className="text-xs font-mono text-[#8c827a] mt-0.5">
                                        Each student gets this countdown timer once they begin
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {[15, 30, 45, 60, 90].map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setTotalDurationMinutes(mins)}
                                            className={`px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition cursor-pointer ${
                                                totalDurationMinutes === mins
                                                    ? 'bg-brand text-black shadow-sm'
                                                    : 'bg-white border-2 border-brand-light text-[#5c544e] hover:text-black hover:bg-brand-light/20'
                                            }`}
                                        >
                                            {mins}m
                                        </button>
                                    ))}

                                    <div className="flex items-center gap-1.5 ml-1">
                                        <input
                                            type="number"
                                            min="1"
                                            max="360"
                                            value={totalDurationMinutes || ''}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value, 10);
                                                setTotalDurationMinutes(isNaN(val) ? 0 : val);
                                            }}
                                            className="w-16 px-2 py-1.5 border-2 border-brand-light rounded-lg font-mono text-sm font-bold text-center bg-white outline-none focus:ring-2 focus:ring-brand text-[#1c1917]"
                                        />
                                        <span className="text-xs font-mono font-bold text-[#8c827a]">mins</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Helpful Active Summary Badge */}
                        {availableFrom && availableUntil && (
                            <div className="px-4 py-2.5 rounded-xl bg-brand-light/20 border border-brand-light flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#5c544e]">
                                <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#E86F47] animate-pulse"></span>
                                    <span>
                                        Active window: <strong className="text-black">{formatDisplayDate(availableFrom)}</strong> to <strong className="text-black">{formatDisplayDate(availableUntil)}</strong>
                                    </span>
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-brand-light font-bold text-black shadow-2xs">
                                        <Clock className="w-3 h-3 text-brand" />
                                        {totalDurationMinutes || 45} mins timer
                                    </span>
                                    <span className="font-bold uppercase tracking-wider text-brand px-2.5 py-0.5 rounded-lg bg-white border border-brand-light shadow-2xs">
                                        {schedulePreset === 'today' ? 'Today Preset' : schedulePreset === 'tomorrow' ? 'Tomorrow Preset' : 'Custom Schedule'}
                                    </span>
                                </div>
                            </div>
                        )}
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