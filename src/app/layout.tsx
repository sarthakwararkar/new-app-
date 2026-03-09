"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { ShaderAnimation } from "@/components/ui/shader-animation";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <html lang="en" className="dark">
      <body className="bg-black text-foreground antialiased overflow-x-hidden">
        <ShaderAnimation />
        <AuthProvider>
          <div className="relative z-10 flex flex-col lg:flex-row h-screen overflow-hidden bg-transparent">
            <MobileNav onMenuClick={() => setIsSidebarOpen(true)} />
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
