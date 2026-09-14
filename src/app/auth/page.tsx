import AuthForm from '@/components/AuthForm';

export default function AuthPage() {
    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold text-indigo-600 tracking-tight">Quizeee</h1>
                    <p className="text-gray-500 mt-2">AI-Powered Real-Time Classroom Quizzes</p>
                </div>
                <AuthForm />
            </div>
        </main>
    );
}