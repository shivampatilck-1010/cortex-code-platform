'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, ArrowRight, CheckCircle2, Award, Sparkles } from 'lucide-react';
import { COURSES } from '@/lib/learning/courses-data';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function LearnIndexPage() {
  return (
    <div className="min-h-screen bg-[#0b0c0e] text-gray-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="h-14 bg-[#141518] border-b border-[#252830] px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <nav className="hidden sm:flex items-center space-x-1 pl-3 border-l border-[#252830]">
            <Link href="/" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              IDE
            </Link>
            <Link href="/challenges" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Challenges
            </Link>
            <Link href="/learn" className="px-2.5 py-1 rounded text-xs bg-[#1e2026] text-[#ff9100] font-bold transition">
              Learn
            </Link>
            <Link href="/compare" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Benchmark
            </Link>
            <Link href="/dashboard" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Dashboard
            </Link>
          </nav>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold text-[#0b0c0e] bg-[#ff9100] hover:bg-[#e07f00] px-3 py-1.5 rounded transition shadow"
        >
          Launch Cloud IDE
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 overflow-y-auto">
        {/* Banner */}
        <div className="p-6 bg-gradient-to-r from-[#172520] to-[#181a20] border border-emerald-900/40 rounded-xl flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs mb-1">
              <BookOpen className="w-4 h-4" />
              <span>Universal Educational Track</span>
            </div>
            <h1 className="text-xl font-bold text-white">Learn to Code Entirely Online</h1>
            <p className="text-gray-400 text-xs mt-1">
              Interactive tutorials, live compiler evaluation, and automated feedback with zero device setup.
            </p>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COURSES.map((course) => (
            <div
              key={course.id}
              className="bg-[#18191d] border border-[#262832] rounded-xl p-5 flex flex-col justify-between hover:border-cyan-500/50 transition group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{course.icon}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#252830] text-gray-300">
                    {course.level}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition">
                    {course.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{course.description}</p>
                </div>
              </div>

              <div className="pt-5 border-t border-[#262832] flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-mono">{course.lessonsCount} Interactive Lessons</span>
                <Link
                  href={`/learn/${course.id}`}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition"
                >
                  <span>Start Course</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
