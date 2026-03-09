"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VibeSearch from "@/components/VibeSearch";
import UploadZone from "@/components/UploadZone";
import ResultsSplitView from "@/components/ResultsSplitView";
import { ProjectAnalysisResponse } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { user } = useAuth();
  const [showResults, setShowResults] = useState(false);
  const [analysisData, setAnalysisData] = useState<ProjectAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveSearchHistory = async (queryText: string) => {
    if (!user) return;
    try {
      const title = queryText.length > 50 ? queryText.substring(0, 50) + "…" : queryText;
      await supabase.from("search_history").insert({
        user_id: user.id,
        query_text: queryText,
        title,
      });
    } catch (err) {
      console.error("Failed to save search history:", err);
    }
  };

  const performAnalysis = async (text: string, file: File | null = null) => {
    setError(null);
    try {
      const formData = new FormData();
      if (text) formData.append("text_description", text);
      if (file) formData.append("image", file);

      // Using relative path for Vercel compatibility
      const response = await fetch("/api/analyze-project", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data: ProjectAnalysisResponse = await response.json();
      setAnalysisData(data);
      setShowResults(true);

      // Save search to history if user is logged in
      const searchQuery = text || (file ? `Image: ${file.name}` : "Unknown search");
      await saveSearchHistory(searchQuery);
    } catch (err: unknown) {
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze project. Is the backend running?");
    }
  };

  const handleReset = () => {
    setShowResults(false);
    setAnalysisData(null);
    setError(null);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center">
      <div className="relative z-10 w-full p-4 md:p-12 lg:p-16 flex flex-col items-center">
        <motion.div
          layout
          className="w-full max-w-5xl mx-auto"
        >
          {/* Header Section */}
          <motion.div
            layout
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 md:mb-12"
          >
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white">
              Discover Components <span className="text-emerald-500">Intelligently</span>
            </h1>
            <p className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto px-4">
              Describe your project, drop a schematic, or vibe search. SpecScouter will find the exact parts you need, check live stock, and get you building faster.
            </p>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-3xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-center font-medium shadow-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Input Section */}
          <motion.div layout className="flex flex-col gap-12 w-full">
            {!showResults && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="inputs"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-12"
                >
                  <VibeSearch onSearch={async (text) => await performAnalysis(text)} />

                  <div className="relative flex items-center py-5">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium uppercase tracking-widest">
                      OR
                    </span>
                    <div className="flex-grow border-t border-border"></div>
                  </div>

                  <UploadZone onAnalyze={async (text, file) => await performAnalysis(text, file)} />
                </motion.div>
              </AnimatePresence>
            )}

            {/* Results Section */}
            <AnimatePresence mode="wait">
              {showResults && analysisData && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="w-full mt-4"
                >
                  {/* Back button to reset */}
                  <button
                    onClick={handleReset}
                    className="mb-6 text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-2"
                  >
                    &larr; Start New Search
                  </button>

                  <ResultsSplitView data={analysisData} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
