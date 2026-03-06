"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, FolderOpen, Cpu, Plus, Settings, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import AuthModal from "./AuthModal";

interface SearchHistoryItem {
    id: string;
    title: string;
    created_at: string;
}

function getRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function Sidebar() {
    const { user, loading: authLoading, signOut } = useAuth();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Fetch search history when user changes
    useEffect(() => {
        if (!user) {
            setHistoryItems([]);
            return;
        }

        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from("search_history")
                .select("id, title, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (!error && data) {
                setHistoryItems(data);
                if (data.length > 0) setActiveId(data[0].id);
            }
        };

        fetchHistory();

        // Realtime subscription for live updates
        const channel = supabase
            .channel("search_history_changes")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "search_history",
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newItem = payload.new as SearchHistoryItem;
                    setHistoryItems((prev) => [newItem, ...prev].slice(0, 20));
                    setActiveId(newItem.id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return (
        <>
            <div className="w-64 h-screen border-r border-border bg-card flex flex-col flex-shrink-0">
                {/* Brand Header */}
                <div className="p-4 flex items-center gap-3 border-b border-border">
                    <div className="w-8 h-8 rounded-md bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                        <Cpu size={20} />
                    </div>
                    <h1 className="font-semibold text-lg tracking-tight">SpecScouter</h1>
                </div>

                {/* New Project Button */}
                <div className="p-4">
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                    <a
                        href="/"
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-md py-2 px-4 flex items-center gap-2 transition-colors justify-center font-medium text-sm"
                    >
                        <Plus size={16} />
                        <span>New Project</span>
                    </a>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto p-4 pt-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        <History size={14} />
                        <span>Search History</span>
                    </div>

                    {!user && !authLoading && (
                        <div className="text-center py-8 px-2">
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                Sign in to save and view your search history
                            </p>
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="w-full bg-muted/50 hover:bg-muted text-foreground text-xs font-medium py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2 border border-border"
                            >
                                <LogIn size={14} />
                                Sign In
                            </button>
                        </div>
                    )}

                    {user && historyItems.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">
                            No searches yet. Try a vibe search!
                        </p>
                    )}

                    {user && (
                        <div className="flex flex-col gap-1">
                            {historyItems.map((item) => {
                                const isActive = activeId === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveId(item.id)}
                                        className={`relative px-3 py-2 text-sm text-left rounded-md transition-colors flex items-center gap-3 ${isActive
                                                ? "text-foreground"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="sidebar-active"
                                                className="absolute inset-0 bg-muted rounded-md -z-10"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                            />
                                        )}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-500 rounded-r-full" />
                                        )}
                                        <FolderOpen
                                            size={16}
                                            className={isActive ? "text-emerald-500 flex-shrink-0" : "flex-shrink-0"}
                                        />
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="truncate">{item.title}</span>
                                            <span className="text-[10px] text-muted-foreground leading-tight">
                                                {getRelativeDate(item.created_at)}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer - User Info / Settings */}
                <div className="p-4 border-t border-border">
                    {user ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3 px-3 py-2 text-sm">
                                <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center flex-shrink-0">
                                    <User size={14} />
                                </div>
                                <span className="text-foreground truncate text-xs font-medium">
                                    {user.email}
                                </span>
                            </div>
                            <button
                                onClick={signOut}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/5 rounded-md transition-colors"
                            >
                                <LogOut size={16} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                        >
                            <Settings size={16} />
                            <span>Settings</span>
                        </button>
                    )}
                </div>
            </div>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </>
    );
}
