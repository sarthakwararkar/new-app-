"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { History, FolderOpen, Cpu, Plus, Settings } from "lucide-react";

export default function Sidebar() {
    const [activeId, setActiveId] = useState<number | null>(1);

    const historyItems = [
        { id: 1, title: "Study Lamp Rev 2", date: "Today" },
        { id: 2, title: "Drone Motor Controller", date: "Yesterday" },
        { id: 3, title: "ESP32 Weather Station", date: "Last Week" },
    ];

    return (
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
                <a href="/" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-md py-2 px-4 flex items-center gap-2 transition-colors justify-center font-medium text-sm">
                    <Plus size={16} />
                    <span>New Project</span>
                </a>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-4 pt-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    <History size={14} />
                    <span>Project History</span>
                </div>
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
                                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-emerald-500 rounded-r-full" />}
                                <FolderOpen size={16} className={isActive ? "text-emerald-500" : ""} />
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate">{item.title}</span>
                                    <span className="text-[10px] text-muted-foreground leading-tight">{item.date}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Footer Settings */}
            <div className="p-4 border-t border-border">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors">
                    <Settings size={16} />
                    <span>Settings</span>
                </button>
            </div>
        </div>
    );
}
