"use client";

import { Menu, X, Cpu } from "lucide-react";

interface MobileNavProps {
    onMenuClick: () => void;
}

export default function MobileNav({ onMenuClick }: MobileNavProps) {
    return (
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-40">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <Cpu size={20} />
                </div>
                <h1 className="font-semibold text-lg tracking-tight">SpecScouter</h1>
            </div>
            <button
                onClick={onMenuClick}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-muted rounded-md"
                aria-label="Open Menu"
            >
                <Menu size={24} />
            </button>
        </div>
    );
}
