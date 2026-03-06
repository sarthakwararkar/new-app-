"use client";

import { AuthForm } from '@/components/AuthForm';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
    const { signIn } = useAuth();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (data: any) => {
        setError(null);
        const { error } = await signIn(data.email, data.password);
        if (error) {
            setError(error.message);
        } else {
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl max-w-md w-full text-center">
                    {error}
                </div>
            )}

            <AuthForm type="login" onSubmit={handleLogin} />
        </div>
    );
}
