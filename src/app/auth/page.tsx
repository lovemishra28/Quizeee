import AuthForm from '@/components/AuthForm';

export default async function AuthPage({
    searchParams,
}: {
    searchParams: Promise<{ mode?: string }>;
}) {
    const params = await searchParams;
    return (
        <main className="min-h-screen bg-bg font-sans">
            <AuthForm initialSignUp={params?.mode === 'signup'} />
        </main>
    );
}