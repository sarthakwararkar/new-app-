"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ExternalLink, ShieldAlert, Zap, TrendingDown } from "lucide-react";
import { ShoppingListItem, VendorResult } from "@/types";

interface LiveComparisonTableProps {
    data: ShoppingListItem[];
}

export default function LiveComparisonTable({ data }: LiveComparisonTableProps) {
    // Helper to mock status
    const getMockStatus = (itemName?: string) => {
        if (!itemName) return "in-stock";
        const hash = itemName.length;
        if (hash % 3 === 0) return "low-stock";
        if (hash % 5 === 0) return "out-of-stock";
        return "in-stock";
    };

    const getStatusIcon = (status: "in-stock" | "out-of-stock" | "low-stock") => {
        switch (status) {
            case "in-stock": return <CheckCircle2 size={12} className="text-emerald-500" />;
            case "out-of-stock": return <XCircle size={12} className="text-red-500" />;
            case "low-stock": return <Clock size={12} className="text-amber-500" />;
        }
    };

    // Helper to parse price for sorting
    const parsePrice = (priceStr?: string): number => {
        if (!priceStr) return 0;
        return parseFloat(priceStr.replace(/[^\d.]/g, "")) || 0;
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card/50 border border-border border-dashed rounded-3xl">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <Zap size={24} className="text-muted-foreground opacity-20" />
                </div>
                <p className="text-muted-foreground font-medium">No components scanned yet</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-12 px-2 md:px-0">
            {data.map((item, idx) => {
                const status = getMockStatus(item.part_name);

                // Sort vendors by price (lowest first)
                const sortedVendors = [...(item.all_vendors || [])].sort((a, b) =>
                    parsePrice(a.price) - parsePrice(b.price)
                );

                const bestVendor = sortedVendors[0];

                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="group relative flex flex-col bg-card/40 backdrop-blur-xl border border-border/50 hover:border-emerald-500/30 rounded-2xl md:rounded-[2rem] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/5"
                    >
                        {/* Status Bar */}
                        <div className="flex items-center justify-between px-6 py-4 bg-muted/20 border-b border-border/50">
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-background/50 border border-border/50 backdrop-blur-md">
                                {getStatusIcon(status)}
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${status === "in-stock" ? "text-emerald-500" : status === "low-stock" ? "text-amber-500" : "text-red-500"
                                    }`}>
                                    {status.replace("-", " ")}
                                </span>
                            </div>
                            {item.is_safety_warning && (
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                    <ShieldAlert size={12} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Safety Warning</span>
                                </div>
                            )}
                        </div>

                        {/* Content Area */}
                        <div className="p-6 flex gap-4 items-start">
                            {/* Part Image */}
                            <div className="relative shrink-0 w-24 h-24 rounded-2xl bg-white/5 border border-border/50 p-2 group-hover:scale-105 transition-transform duration-500">
                                <img
                                    src={item.image_url || "https://img.icons8.com/color/96/processor.png"}
                                    alt={item.part_name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).src = "https://img.icons8.com/color/96/processor.png"; }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <div className="flex flex-col gap-1 w-full">
                                <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-emerald-400 transition-colors">
                                    {item.part_name}
                                </h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {item.specifications}
                                </p>
                            </div>
                        </div>

                        {/* Vendors List */}
                        <div className="px-6 pb-6 flex flex-col gap-3">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-1 px-1">
                                Available Scouter Results
                            </h4>

                            {sortedVendors.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {sortedVendors.map((vendor, vIdx) => (
                                        <a
                                            key={vIdx}
                                            href={vendor.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${vIdx === 0
                                                ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20"
                                                : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${vIdx === 0 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${vIdx === 0 ? "text-emerald-300" : "text-foreground"}`}>
                                                        {vendor.vendor}
                                                    </span>
                                                    {vIdx === 0 && (
                                                        <span className="text-[10px] text-emerald-500/70 font-bold flex items-center gap-1">
                                                            <TrendingDown size={10} /> Best Price Found
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className={`font-mono font-black ${vIdx === 0 ? "text-lg text-emerald-400" : "text-sm text-muted-foreground"}`}>
                                                    {vendor.price}
                                                </span>
                                                <ExternalLink size={10} className="text-muted-foreground/40 mt-1" />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 border-dashed text-center">
                                    <span className="text-xs text-muted-foreground italic">No vendors detected for this part</span>
                                </div>
                            )}
                        </div>

                        {/* Action Bar (Only for best vendor) */}
                        {bestVendor && (
                            <div className="mt-auto p-4 bg-emerald-500/5 border-t border-emerald-500/10">
                                <a
                                    href={bestVendor.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-colors"
                                >
                                    Get for {bestVendor.price} from {bestVendor.vendor}
                                </a>
                            </div>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}
