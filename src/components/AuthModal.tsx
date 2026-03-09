"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Loader2, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const { signIn, signUp } = useAuth();
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            if (mode === "signin") {
                const { error } = await signIn(email, password);
                if (error) {
                    setError(error.message);
                } else {
                    onClose();
                    resetForm();
                }
            } else {
                const { error } = await signUp(email, password);
                if (error) {
                    setError(error.message);
                } else {
                    setSuccessMessage("Account created! You can now sign in.");
                    setMode("signin");
                    setPassword("");
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEmail("");
        setPassword("");
        setError(null);
        setSuccessMessage(null);
    };

    const toggleMode = () => {
        setMode(mode === "signin" ? "signup" : "signin");
        setError(null);
        setSuccessMessage(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-[95%] sm:w-full max-w-md mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header gradient bar */}
                        <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500" />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50"
                        >
                            <X size={18} />
                        </button>

                        {/* Content */}
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                                    {mode === "signin" ? <LogIn size={24} /> : <UserPlus size={24} />}
                                </div>
                                <h2 className="text-xl font-bold text-foreground">
                                    {mode === "signin" ? "Welcome Back" : "Create Account"}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {mode === "signin"
                                        ? "Sign in to access your search history"
                                        : "Sign up to save your searches"}
                                </p>
                            </div>

                            {/* Success Message */}
                            {successMessage && (
                                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-sm text-center font-medium">
                                    {successMessage}
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm text-center font-medium">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                {/* Email */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                        <Mail size={16} />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-muted/50 border border-border text-foreground rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-muted-foreground/60"
                                    />
                                </div>

                                {/* Password */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full bg-muted/50 border border-border text-foreground rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-muted-foreground/60"
                                    />
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    {loading && <Loader2 size={16} className="animate-spin" />}
                                    {mode === "signin" ? "Sign In" : "Create Account"}
                                </button>
                            </form>

                            {/* Toggle Mode */}
                            <div className="mt-6 text-center text-sm text-muted-foreground">
                                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                                <button
                                    onClick={toggleMode}
                                    className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
                                >
                                    {mode === "signin" ? "Sign Up" : "Sign In"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
