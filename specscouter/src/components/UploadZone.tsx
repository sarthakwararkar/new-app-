"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, Loader2, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UploadZoneProps {
    onAnalyze: (text: string, file: File | null) => Promise<void>;
}

export default function UploadZone({ onAnalyze }: UploadZoneProps) {
    const [isHovering, setIsHovering] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [description, setDescription] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAnalyze = async () => {
        if (!description.trim() && !file) return;
        setIsAnalyzing(true);
        try {
            await onAnalyze(description, file);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsHovering(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
            {/* Drag & Drop Zone */}
            <div
                className={`relative w-full h-48 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer group bg-card ${isHovering ? "border-emerald-500 bg-emerald-500/5 text-emerald-500" : "border-border text-muted-foreground hover:border-emerald-500/50 hover:bg-muted/30"
                    }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                onDragLeave={() => setIsHovering(false)}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => e.target.files && setFile(e.target.files[0])}
                    accept="image/*,.pdf"
                />
                <div className="p-4 rounded-full bg-muted/50 group-hover:bg-emerald-500/10 transition-colors">
                    <UploadCloud size={32} className="group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="text-center">
                    {file ? (
                        <div className="flex flex-col items-center gap-2">
                            <span className="font-medium text-emerald-500">{file.name}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1"
                            >
                                <X size={14} /> Remove File
                            </button>
                        </div>
                    ) : (
                        <>
                            <p className="font-medium text-foreground group-hover:text-emerald-500 transition-colors">
                                Drop circuit sketches or images here
                            </p>
                            <p className="text-sm mt-1 opacity-80">or click to browse files</p>
                        </>
                    )}
                </div>
            </div>

            {/* Description Textarea */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2 text-foreground/90">
                    <FileText size={16} className="text-emerald-500" />
                    Project Description
                </label>
                <textarea
                    className="w-full h-32 bg-card border border-border rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none shadow-sm placeholder:text-muted-foreground/60"
                    placeholder="e.g., I want to build a voice-controlled study lamp. I need a microcontroller, a microphone module, and some power LEDs..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isAnalyzing}
                />
            </div>

            {/* Action Button */}
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || (!description.trim() && !file)}
                className="w-full relative overflow-hidden bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
                <AnimatePresence mode="popLayout">
                    {isAnalyzing ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center justify-center gap-3"
                        >
                            <Loader2 size={18} className="animate-spin" />
                            <span>Consulting Engineer Agent...</span>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center justify-center gap-2"
                        >
                            <Sparkles size={18} className="text-emerald-200 group-hover:text-white transition-colors" />
                            <span>Analyze Requirements</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
        </div>
    );
}
