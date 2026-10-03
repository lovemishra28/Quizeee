'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { processStudyMaterial } from '@/actions/generateQuiz';
import { createInstantQuizAction } from '@/actions/instantQuiz';
import {
    Search,
    Upload,
    Sparkles,
    ArrowRight,
    Play,
    Loader2,
    Hash,
    FileText,
    X,
    AlertCircle,
} from 'lucide-react';

export default function InstantQuizSection() {
    const router = useRouter();

    // ------------------------------------------
    // CREATE SECTION STATE
    // ------------------------------------------
    const [topicInput, setTopicInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [questionCount, setQuestionCount] = useState<number>(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [createError, setCreateError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ------------------------------------------
    // JOIN SECTION STATE
    // ------------------------------------------
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState('');

    // Handle File Selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setCreateError('');
        }
    };

    const handleClearFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // ------------------------------------------
    // HANDLE GENERATE INSTANT QUIZ
    // ------------------------------------------
    const handleGenerateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');

        const cleanTopic = topicInput.trim();
        if (!cleanTopic && !selectedFile) {
            setCreateError('Please enter a topic or upload notes to generate.');
            return;
        }

        setIsGenerating(true);

        try {
            const formData = new FormData();
            if (selectedFile) {
                formData.append('file', selectedFile);
            }
            if (cleanTopic) {
                formData.append('topic', cleanTopic);
            }
            formData.append('questionCount', questionCount.toString());

            const res = await processStudyMaterial(formData);

            if (!res.success || !res.questions || res.questions.length === 0) {
                throw new Error(res.error || 'Failed to generate questions. Please try again.');
            }

            const mapped = res.questions.map((q: any) => ({
                question_text: q.question_text,
                options: q.options || ['', '', '', ''],
                correct_option_index: q.correct_option_index ?? 0,
                explanation: q.explanation || '',
                subtopic: q.subtopic || 'General',
            }));

            const quizTitle = cleanTopic || selectedFile?.name.replace(/\.[^/.]+$/, '') || 'Instant Competitive Quiz';

            const createRes = await createInstantQuizAction({
                title: quizTitle,
                questions: mapped,
                perQuestionTimer: 30,
            });

            if (!createRes.success || !createRes.quizId || !createRes.hostEmail || !createRes.hostPassword) {
                throw new Error(createRes.error || 'Failed to initialize instant room.');
            }

            // Sign into the instant host account in browser
            await supabase.auth.signInWithPassword({
                email: createRes.hostEmail,
                password: createRes.hostPassword,
            });

            router.push(`/quiz/live/host/${createRes.quizId}?instant=true`);
        } catch (err: any) {
            console.error('Instant quiz creation error:', err);
            setCreateError(err.message || 'Could not generate quiz. Please retry.');
            setIsGenerating(false);
        }
    };

    // ------------------------------------------
    // HANDLE JOIN INSTANT QUIZ
    // ------------------------------------------
    const handleJoinQuiz = (e: React.FormEvent) => {
        e.preventDefault();
        setJoinError('');

        const cleanCode = roomCodeInput.trim().replace(/\D/g, '');
        if (!cleanCode || cleanCode.length < 4) {
            setJoinError('Please enter a valid 6-digit room code.');
            return;
        }

        setIsJoining(true);
        router.push(`/quiz/live/student/${cleanCode}?instant=true`);
    };

    return (
        <section id="instant-quiz" className="relative w-full py-16 lg:py-24 bg-[#fff5f0] overflow-hidden select-none font-mono">
            {/* Background Ambient Circuit Blobs */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute -top-12 left-12 w-60 h-60 rounded-full bg-[#edd6cb]/50 blur-xl" />
                <div className="absolute top-1/2 -left-28 -translate-y-1/2 w-96 h-96 rounded-full bg-[#edd6cb]/40 blur-2xl" />
                <div className="absolute top-16 -right-28 w-[420px] h-[420px] rounded-full bg-[#edd6cb]/45 blur-2xl" />
                <div className="absolute -bottom-20 -right-16 w-80 h-80 rounded-full bg-[#edd6cb]/40 blur-xl" />
            </div>

            <div className="relative z-20 max-w-[1380px] mx-auto px-4 sm:px-8 lg:px-12">
                {/* Main Outer Rounded Box with Border and Integrated Circuit Tracks */}
                <div className="relative w-full rounded-[28px] border border-[#efc0ad] bg-[#fff5f0] shadow-[0_8px_30px_rgba(232,111,71,0.06)] overflow-visible">

                    {/* ================= CIRCUIT TRACKS & CONNECTED NODES ================= */}

                    {/* 1. Top-Left Circuit Line */}
                    <div className="hidden xl:block absolute -top-10 left-0 w-full h-10 pointer-events-none overflow-visible z-20">
                        <svg className="w-full h-full overflow-visible" fill="none">
                            <path
                                d="M -600 0 L 32 0 A 28 28 0 0 1 60 28 L 60 40"
                                stroke="#efc0ad"
                                strokeWidth="1.5"
                            />
                            <g transform="translate(-40, 0)">
                                <circle cx="0" cy="0" r="11" fill="#E86F47" opacity="0.22" />
                                <circle cx="0" cy="0" r="7" fill="#E86F47" />
                                <circle cx="0" cy="0" r="2.5" fill="#ffffff" opacity="0.9" />
                            </g>
                        </svg>
                    </div>

                    {/* Node on Top-Left border (x = 60) */}
                    <div className="hidden xl:flex absolute -top-2.5 left-[60px] -translate-x-1/2 items-center justify-center z-30 pointer-events-none">
                        <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                            <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                                <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                            </span>
                        </span>
                    </div>

                    {/* 2. Bottom-Left Circuit Line extending out */}
                    <div className="hidden xl:flex items-center absolute right-full bottom-8 h-[1.5px] bg-[#efc0ad] w-[50vw] pointer-events-none z-20">
                        <div className="absolute right-28 top-1/2 -translate-y-1/2">
                            <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                                <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                                    <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Node on Bottom-Left corner */}
                    <div className="hidden xl:flex absolute -bottom-2 -left-2 items-center justify-center z-30 pointer-events-none">
                        <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                            <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                                <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                            </span>
                        </span>
                    </div>

                    {/* 3. Center Divider Circuit Node (between Create and Join) */}
                    <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 items-center justify-center pointer-events-none">
                        <div className="absolute w-8 h-[1.5px] bg-[#efc0ad]"></div>
                        <span className="relative w-6 h-6 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                            <span className="w-3.5 h-3.5 rounded-full bg-[#E86F47] flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-white opacity-95"></span>
                            </span>
                        </span>
                    </div>

                    {/* 4. Right Circuit Line extending from right border */}
                    <div className="hidden xl:flex items-center absolute left-full top-1/3 -translate-y-1/2 h-[1.5px] bg-[#efc0ad] w-[50vw] pointer-events-none z-20">
                        <div className="absolute left-28 top-1/2 -translate-y-1/2">
                            <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                                <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                                    <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Node on Right border */}
                    <div className="hidden xl:flex absolute -right-2.5 top-1/3 -translate-y-1/2 items-center justify-center z-30 pointer-events-none">
                        <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                            <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                                <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                            </span>
                        </span>
                    </div>

                    {/* Node on Bottom Right border */}
                    <div className="hidden xl:flex absolute -bottom-2 -right-2 items-center justify-center z-30 pointer-events-none">
                        <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                            <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                                <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                            </span>
                        </span>
                    </div>

                    {/* ======================================================== */}
                    {/* TOP SECTION: CREATE (Generate an Instant Quiz)           */}
                    {/* ======================================================== */}
                    <div className="relative p-8 sm:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                        {/* Left Column: Form & Actions */}
                        <div className="lg:col-span-7 flex flex-col items-start gap-5">
                            {/* Label */}
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#8c827a]">
                                CREATE
                            </span>

                            {/* Main Heading */}
                            <h3 className="text-3xl sm:text-4xl lg:text-[44px] font-black font-mono text-[#1f1a17] tracking-tight leading-[1.12]">
                                Generate an<br />
                                <span className="text-[#E86F47]">Instant Quiz.</span>
                            </h3>

                            {/* Consolidated Input Bar with Upload icon inside */}
                            <form onSubmit={handleGenerateQuiz} className="w-full space-y-3.5 pt-1">
                                <div className="relative flex items-center w-full">
                                    <Search className="w-4 h-4 text-[#8c827a] absolute left-4 pointer-events-none" />

                                    <input
                                        type="text"
                                        value={topicInput}
                                        onChange={(e) => {
                                            setTopicInput(e.target.value);
                                            setCreateError('');
                                        }}
                                        placeholder="Enter a topic, paste a prompt, or upload notes..."
                                        className="w-full pl-11 pr-14 py-3.5 bg-white border border-[#efc0ad] rounded-2xl outline-none focus:ring-2 focus:ring-[#E86F47] font-mono text-sm text-[#1f1a17] placeholder:text-[#a89f91] shadow-2xs transition"
                                    />

                                    {/* Upload notes icon button inside right edge */}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute right-2.5 p-2 rounded-xl text-[#8c827a] hover:text-[#E86F47] hover:bg-[#faebe3] transition cursor-pointer"
                                        title="Upload PDF notes or document"
                                    >
                                        <Upload className="w-4 h-4" />
                                    </button>

                                    {/* Hidden File Input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.txt"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </div>

                                {/* Uploaded File Pill (if any) */}
                                {selectedFile && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#faebe3] border border-[#efc0ad] text-xs font-mono font-bold text-[#1f1a17]">
                                        <FileText className="w-3.5 h-3.5 text-[#E86F47]" />
                                        <span className="truncate max-w-[220px]">{selectedFile.name}</span>
                                        <button
                                            type="button"
                                            onClick={handleClearFile}
                                            className="text-[#8c827a] hover:text-black transition cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

                                {/* Error alert */}
                                {createError && (
                                    <p className="text-xs font-mono text-red-600 flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span>{createError}</span>
                                    </p>
                                )}

                                {/* Action Bar: Generate Quiz Button + Number of Questions Field */}
                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                    <button
                                        type="submit"
                                        disabled={isGenerating}
                                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#E86F47] hover:bg-[#d55e37] active:scale-[0.99] text-white font-mono text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                                <span>Generating Quiz...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4 text-white" />
                                                <span>Generate Quiz</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>

                                    {/* Number of questions selector right beside the button */}
                                    <div className="flex items-center gap-2 px-3 py-2 bg-white/90 border border-[#efc0ad] rounded-xl text-xs font-mono font-bold text-[#1f1a17] shadow-2xs">
                                        <span className="text-[#8c827a] font-medium">Questions:</span>
                                        <div className="flex items-center gap-1">
                                            {[3, 5, 10].map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setQuestionCount(num)}
                                                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                                        questionCount === num
                                                            ? 'bg-[#E86F47] text-white'
                                                            : 'text-[#5c544e] hover:text-black hover:bg-[#faebe3]'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Right Column: Exact 3D Quiz Card Graphic matching the user's mockup */}
                        <div className="lg:col-span-5 relative flex items-center justify-center">
                            <div className="relative w-full max-w-[340px] aspect-[4/3] flex items-center justify-center">
                                {/* Soft warm glow behind graphic */}
                                <div className="absolute inset-0 rounded-full bg-[#edd6cb]/40 blur-2xl pointer-events-none" />

                                {/* Angled Main Quiz Card */}
                                <div className="relative w-[280px] sm:w-[300px] bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-[#efc0ad]/80 shadow-[0_16px_40px_rgba(232,111,71,0.12)] rotate-[2.5deg] space-y-3.5 transition-transform duration-300 hover:rotate-0">
                                    {/* Header: Q. */}
                                    <div className="flex items-center justify-between pb-1">
                                        <span className="text-xl font-bold font-mono text-[#5c544e]">Q.</span>
                                    </div>

                                    {/* Option Row 1 (Unselected) */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#d6c7be]" />
                                        <div className="h-2 w-28 rounded-full bg-[#edd6cb]" />
                                    </div>

                                    {/* Option Row 2 (Selected Active with Orange Pill Highlight) */}
                                    <div className="flex items-center gap-3 px-3 py-2 -mx-2 rounded-xl bg-[#faebe3] border border-[#efc0ad]">
                                        <div className="w-3.5 h-3.5 rounded-full bg-[#E86F47] flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                        </div>
                                        <div className="h-2.5 w-36 rounded-full bg-[#E86F47]/80" />
                                    </div>

                                    {/* Option Row 3 (Unselected) */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#d6c7be]" />
                                        <div className="h-2 w-32 rounded-full bg-[#edd6cb]" />
                                    </div>

                                    {/* Option Row 4 (Unselected) */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#d6c7be]" />
                                        <div className="h-2 w-24 rounded-full bg-[#edd6cb]" />
                                    </div>
                                </div>

                                {/* Floating Top-Right Document Badge with Speed Lines */}
                                <div className="absolute -top-3 -right-2 sm:right-2 flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-2xl bg-[#faebe3] border border-[#efc0ad] shadow-md flex items-center justify-center text-[#E86F47]">
                                        <FileText className="w-6 h-6 stroke-[2.2]" />
                                    </div>
                                    {/* Subtle decorative rays */}
                                    <div className="absolute -top-2 -right-1 flex gap-1">
                                        <span className="w-1 h-2.5 bg-[#E86F47]/60 rounded-full rotate-45" />
                                        <span className="w-1 h-3 bg-[#E86F47]/80 rounded-full rotate-12 -mt-1" />
                                    </div>
                                </div>

                                {/* Floating Bottom-Left Analytics Chart Badge */}
                                <div className="absolute -bottom-2 left-0 sm:left-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[#faebe3] border border-[#efc0ad] shadow-md flex items-end justify-center gap-1 p-2.5 text-[#E86F47]">
                                        <span className="w-1.5 h-3 bg-[#E86F47] rounded-sm" />
                                        <span className="w-1.5 h-5 bg-[#E86F47] rounded-sm" />
                                        <span className="w-1.5 h-4 bg-[#E86F47] rounded-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ======================================================== */}
                    {/* CENTER DIVIDER CIRCUIT LINE & CENTER NODE                */}
                    {/* ======================================================== */}
                    <div className="relative w-full border-t border-[#efc0ad]">
                        <div className="absolute left-1/2 -top-2.5 -translate-x-1/2 flex items-center justify-center">
                            <span className="w-5 h-5 rounded-full bg-[#E86F47]/20 flex items-center justify-center shadow-xs">
                                <span className="w-3 h-3 rounded-full bg-[#E86F47] flex items-center justify-center">
                                    <span className="w-1 h-1 rounded-full bg-white opacity-95"></span>
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* ======================================================== */}
                    {/* BOTTOM SECTION: JOIN (Join an Instant Quiz)              */}
                    {/* ======================================================== */}
                    <div className="relative p-8 sm:p-12 lg:p-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                        {/* Left Column: Keypad Graphic matching the user's mockup */}
                        <div className="lg:col-span-5 order-last lg:order-first relative flex items-center justify-center">
                            <div className="relative w-full max-w-[340px] aspect-[4/3] flex items-center justify-center">
                                {/* Soft warm glow behind graphic */}
                                <div className="absolute inset-0 rounded-full bg-[#edd6cb]/40 blur-2xl pointer-events-none" />

                                {/* Angled Main PIN Card */}
                                <div className="relative w-[280px] sm:w-[310px] bg-white/95 backdrop-blur-md rounded-2xl p-5 border border-[#efc0ad]/80 shadow-[0_16px_40px_rgba(232,111,71,0.12)] -rotate-[3deg] transition-transform duration-300 hover:rotate-0">
                                    {/* 6 PIN Digit Slots */}
                                    <div className="grid grid-cols-6 gap-2">
                                        {[0, 0, 0, 0, 0, 0].map((digit, idx) => (
                                            <div
                                                key={idx}
                                                className="aspect-[3/4] rounded-xl bg-[#fbf5f0] border border-[#efc0ad] flex items-center justify-center text-sm font-bold font-mono text-[#5c544e] shadow-2xs"
                                            >
                                                {digit}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Floating Top-Right Game Controller Badge */}
                                <div className="absolute -top-3 right-6 sm:right-10 flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-2xl bg-[#faebe3] border border-[#efc0ad] shadow-md flex items-center justify-center text-[#E86F47]">
                                        <svg className="w-6 h-6 stroke-[2.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <line x1="6" y1="12" x2="10" y2="12" strokeLinecap="round" />
                                            <line x1="8" y1="10" x2="8" y2="14" strokeLinecap="round" />
                                            <line x1="15" y1="13" x2="15.01" y2="13" strokeWidth="2.5" strokeLinecap="round" />
                                            <line x1="18" y1="11" x2="18.01" y2="11" strokeWidth="2.5" strokeLinecap="round" />
                                            <rect x="2" y="6" width="20" height="12" rx="6" />
                                        </svg>
                                    </div>
                                    {/* Decorative rays */}
                                    <div className="absolute -top-2 right-1 flex gap-1">
                                        <span className="w-1 h-2.5 bg-[#E86F47]/60 rounded-full rotate-45" />
                                        <span className="w-1 h-3 bg-[#E86F47]/80 rounded-full rotate-12 -mt-1" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Join Form & Actions */}
                        <div className="lg:col-span-7 flex flex-col items-start gap-5">
                            {/* Label */}
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#8c827a]">
                                JOIN
                            </span>

                            {/* Main Heading */}
                            <h3 className="text-3xl sm:text-4xl lg:text-[44px] font-black font-mono text-[#1f1a17] tracking-tight leading-[1.12]">
                                Join an<br />
                                <span className="text-[#E86F47]">Instant Quiz.</span>
                            </h3>

                            {/* Consolidated 6-Digit Code Input Bar */}
                            <form onSubmit={handleJoinQuiz} className="w-full space-y-3.5 pt-1">
                                <div className="relative flex items-center w-full">
                                    <Hash className="w-4 h-4 text-[#8c827a] absolute left-4 pointer-events-none" />

                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={roomCodeInput}
                                        onChange={(e) => {
                                            setRoomCodeInput(e.target.value.replace(/\D/g, ''));
                                            setJoinError('');
                                        }}
                                        placeholder="Enter 6-digit code..."
                                        className="w-full pl-11 pr-4 py-3.5 bg-white border border-[#efc0ad] rounded-2xl outline-none focus:ring-2 focus:ring-[#E86F47] font-mono text-sm tracking-wider text-[#1f1a17] placeholder:text-[#a89f91] shadow-2xs transition"
                                    />
                                </div>

                                {/* Join Error Alert */}
                                {joinError && (
                                    <p className="text-xs font-mono text-red-600 flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span>{joinError}</span>
                                    </p>
                                )}

                                {/* Action: Join Quiz Button */}
                                <div className="pt-1">
                                    <button
                                        type="submit"
                                        disabled={isJoining}
                                        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-[#E86F47] hover:bg-[#d55e37] active:scale-[0.99] text-white font-mono text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-60"
                                    >
                                        {isJoining ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                                <span>Connecting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 fill-current text-white" />
                                                <span>Join Quiz</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
