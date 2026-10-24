'use client';

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main id="main-content" className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 font-mono text-center">
            <h1 className="text-3xl font-bold text-black mb-4">Something went wrong</h1>
            <p role="alert" className="max-w-md text-muted mb-6">This page could not be loaded. Try again, or refresh to recover your session.</p>
            <button onClick={reset} className="rounded-xl bg-brand px-6 py-3 font-bold text-black">Try again</button>
        </main>
    );
}
