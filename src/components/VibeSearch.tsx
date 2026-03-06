import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

interface VibeSearchProps {
    onSearch: (text: string) => Promise<void>;
}

export default function VibeSearch({ onSearch }: VibeSearchProps) {
    const [text, setText] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!text.trim() || isSearching) return;
        setIsSearching(true);
        try {
            await onSearch(text);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="relative w-full max-w-3xl mx-auto group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-emerald-500 transition-colors">
                <Search size={20} />
            </div>
            <input
                type="text"
                placeholder="e.g., Cheap NPN transistor for high-frequency switching under ₹10..."
                className="w-full bg-card border border-border text-foreground rounded-xl py-4 pl-12 pr-28 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-muted-foreground/70"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                disabled={isSearching}
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                <button
                    onClick={handleSearch}
                    disabled={isSearching || !text.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                    {isSearching ? <Loader2 size={14} className="animate-spin" /> : null}
                    {isSearching ? "Searching..." : "Vibe Search"}
                </button>
            </div>
        </div>
    );
}
