import AuthForm from '@/components/AuthForm';
import { safeAuthReturnPath } from '@/lib/authRedirect';

export default async function AuthPage({
    searchParams,
}: {
    searchParams: Promise<{ mode?: string; role?: string; next?: string }>;
}) {
    const params = await searchParams;
    return (
        <main className="min-h-screen bg-bg font-sans">
            <AuthForm
                initialSignUp={params?.mode === 'signup'}
                initialRole={params?.role === 'student' ? 'student' : 'teacher'}
                returnTo={safeAuthReturnPath(params?.next)}
                initialReset={params?.mode === 'reset'}
            />
        </main>
    );
}
