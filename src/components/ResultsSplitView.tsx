"use client";

import { motion } from "framer-motion";
import { ListChecks, TrendingUp, RefreshCw, AlertTriangle, Zap, Cpu } from "lucide-react";
import LiveComparisonTable from "./LiveComparisonTable";
import { ProjectAnalysisResponse } from "@/types";

interface ResultsSplitViewProps {
    data: ProjectAnalysisResponse;
}

export default function ResultsSplitView({ data }: ResultsSplitViewProps) {
    return (
        <div className="w-full flex flex-col lg:flex-row gap-6">
            {/* Left Side: Required Components List */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full lg:w-1/3 flex flex-col gap-4"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <ListChecks size={20} className="text-emerald-500" />
                        Analysis & Requirements
                    </h2>
                    <span className="text-xs font-medium bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        AI Generated
                    </span>
                </div>

                <div className="flex flex-col gap-3">
                    {/* Core Controller */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-card border border-border rounded-xl p-4 hover:border-emerald-500/50 transition-colors group cursor-default shadow-sm"
                    >
                        <h3 className="font-medium text-foreground group-hover:text-emerald-500 transition-colors flex items-center gap-2">
                            <Cpu size={16} /> Core Controller
                        </h3>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                            {data.core_controller}
                        </p>
                    </motion.div>

                    {/* Power Needs */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-card border border-border rounded-xl p-4 hover:border-emerald-500/50 transition-colors group cursor-default shadow-sm"
                    >
                        <h3 className="font-medium text-foreground group-hover:text-emerald-500 transition-colors flex items-center gap-2">
                            <Zap size={16} /> Power Needs
                        </h3>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                            {data.power_needs}
                        </p>
                    </motion.div>

                    {/* Safety Warnings */}
                    {data.safety_checking && data.safety_checking.toLowerCase() !== "none" && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 group cursor-default shadow-sm"
                        >
                            <h3 className="font-medium text-red-500 flex items-center gap-2">
                                <AlertTriangle size={16} /> Safety Check
                            </h3>
                            <p className="text-sm text-red-500/90 mt-2 leading-relaxed font-medium">
                                {data.safety_checking}
                            </p>
                        </motion.div>
                    )}
                </div>
            </motion.div>

            {/* Right Side: Live Market Prices */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full lg:w-2/3 flex flex-col gap-4"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-500" />
                        Live Market Prices & Shopping List
                    </h2>
                    <button className="text-xs font-medium text-muted-foreground hover:text-emerald-500 flex items-center gap-1.5 transition-colors bg-muted/50 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                        <RefreshCw size={14} />
                        Refresh Web Search
                    </button>
                </div>

                <LiveComparisonTable data={data.shopping_list} />
            </motion.div>
        </div>
    );
}
