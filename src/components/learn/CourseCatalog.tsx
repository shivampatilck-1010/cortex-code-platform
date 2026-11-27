'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Moon,
  Search,
  Sun,
  Terminal,
  X,
} from 'lucide-react';
import { COURSE_CATEGORIES, COURSES, getCourseStats } from '@/data/courses';
import { useCortexTheme, useLearnProgress } from '@/hooks';
import type { Course, CourseCategory } from '@/types/learn';
import { CourseCard } from './CourseCard';
import { SandboxDrawer } from './SandboxDrawer';

type CategoryFilter = 'All Courses' | CourseCategory;
type SortOption = 'popular' | 'latest' | 'duration' | 'lessons';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  courseSlug: string;
  gradient: string;
  mockupEyebrow: string;
  mockupTitle: string;
  mockupMeta: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-dsa',
    title: 'Master Data Structures With Live IDE Labs',
    subtitle:
      'Practice hash tables, stacks, and asymptotic analysis inside structured modules with real test execution and timed exams.',
    ctaLabel: 'Start Python & DSA',
    courseSlug: 'python-dsa-mastery',
    gradient: 'from-[#180705] via-[#6B1508] to-[#A62E09]',
    mockupEyebrow: 'INTERACTIVE COURSE TRACK',
    mockupTitle: 'Python & Data Structures',
    mockupMeta: '2 Modules · 2 IDE Labs · Timed Exam',
  },
  {
    id: 'slide-systems',
    title: 'Zero-Leak C++20 & Relational SQL Craft',
    subtitle:
      'Build rock-solid engineering depth across RAII smart pointers, PostgreSQL/SQLite windowing, and join mechanics.',
    ctaLabel: 'Explore Systems & C++',
    courseSlug: 'modern-cpp-systems',
    gradient: 'from-[#0B132B] via-[#1C2541] to-[#1D4E89]',
    mockupEyebrow: 'SYSTEMS & DATABASES',
    mockupTitle: 'Modern C++ & SQL',
    mockupMeta: 'RAII Lifetimes · Window Functions · Live Sandbox',
  },
  {
    id: 'slide-ml',
    title: 'Applied ML, Data Pipelines & Async Web',
    subtitle:
      'Implement gradient descent, min-max normalization pipelines, and Promise concurrency hands-on in Cortex.',
    ctaLabel: 'Explore Machine Learning',
    courseSlug: 'applied-machine-learning-foundations',
    gradient: 'from-[#0D1B1E] via-[#133C38] to-[#1B5E4A]',
    mockupEyebrow: 'APPLIED AI & WEB',
    mockupTitle: 'ML & Data Pipelines',
    mockupMeta: 'Gradient Descent · Statistics · Node.js Async',
  },
];

const GUIDE_GOALS: Array<{
  id: string;
  goal: string;
  subtitle: string;
  courseId: string;
}> = [
  {
    id: 'goal-interviews',
    goal: 'Crack Coding Interviews',
    subtitle: 'Data Structures · Hash Maps, Stacks & Timed Exam',
    courseId: 'python-dsa',
  },
  {
    id: 'goal-ml',
    goal: 'Build Machine Learning Intuitions',
    subtitle: 'Machine Learning · MSE Loss, Scaling & Optimization',
    courseId: 'ml-foundations',
  },
  {
    id: 'goal-sql',
    goal: 'Master Databases & SQL Analytics',
    subtitle: 'Databases & SQL · Joins, Grouping & Window Functions',
    courseId: 'sql-design',
  },
  {
    id: 'goal-cpp',
    goal: 'Write Fast Memory-Safe Systems Code',
    subtitle: 'Systems & C++ · RAII, References & Smart Pointers',
    courseId: 'cpp-systems',
  },
];

export const CourseCatalog: React.FC = () => {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useCortexTheme();
  const { hydrated, getCourseProgress } = useLearnProgress();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Courses');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [heroIdx, setHeroIdx] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);

  const catStripRef = useRef<HTMLDivElement>(null);
  const followingStripRef = useRef<HTMLDivElement>(null);

  const q = searchQuery.trim().toLowerCase();
  const isFiltered = activeCategory !== 'All Courses' || q.length > 0;

  const resetFilters = () => {
    setActiveCategory('All Courses');
    setSearchQuery('');
  };

  const filteredAndSorted = useMemo(() => {
    const base = COURSES.filter((c) => {
      if (activeCategory !== 'All Courses' && c.category !== activeCategory) {
        return false;
      }
      if (q) {
        const hay = `${c.title} ${c.category} ${c.instructor} ${c.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...base];
    switch (sortBy) {
      case 'duration':
        sorted.sort((a, b) => b.estimatedHours - a.estimatedHours);
        break;
      case 'lessons':
        sorted.sort((a, b) => getCourseStats(b).totalItems - getCourseStats(a).totalItems);
        break;
      case 'latest':
        sorted.sort((a, b) => (b.publishedOrder ?? 0) - (a.publishedOrder ?? 0));
        break;
      case 'popular':
      default:
        sorted.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
        break;
    }
    return sorted;
  }, [activeCategory, q, sortBy]);

  const latestCourses = useMemo(
    () =>
      [...COURSES]
        .sort((a, b) => (b.publishedOrder ?? 0) - (a.publishedOrder ?? 0))
        .slice(0, 4),
    []
  );

  const followingCourses = useMemo(
    () => COURSES.filter((c) => c.following !== false),
    []
  );

  const recommendedDisplay = useMemo(
    () => (isFiltered ? filteredAndSorted : filteredAndSorted.slice(0, 4)),
    [isFiltered, filteredAndSorted]
  );

  const slide = HERO_SLIDES[heroIdx] ?? HERO_SLIDES[0];

  const openCourse = (course: Course) => {
    router.push(`/learn/${course.slug}`);
  };

  const getProgressNumbers = (course: Course) => {
    if (!hydrated) {
      return { pct: 0, completedCount: 0 };
    }
    const summary = getCourseProgress(course);
    return {
      pct: summary.pct,
      completedCount: summary.completedCount,
    };
  };

  return (
    <div
      className={`min-h-screen bg-[#F4F6F9] dark:bg-[#15181E] text-[#0F172A] dark:text-zinc-100 antialiased ${
        isDarkMode ? 'dark' : ''
      }`}
    >
      {/* 1. Streamlined 62px Sticky Glass Navbar */}
      <header className="fixed top-0 inset-x-0 z-40 h-[62px] px-4 sm:px-6 lg:px-8 bg-white/75 dark:bg-[#21242B]/75 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              resetFilters();
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            data-testid="cortex-learn-brand"
            className="inline-flex items-center gap-2 focus:outline-none"
          >
            <span className="w-7 h-7 rounded-full flex items-center justify-center bg-[#F3912E]/15 border border-[#F3912E]/40 text-[#F3912E] font-bold text-xs">
              C
            </span>
            <span className="text-[19px] font-bold tracking-[-0.025em] text-[#0F172A] dark:text-white">
              Cortex<span className="text-[#F3912E]">Learn</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            data-testid="guide-me-btn"
            className="hidden sm:inline-flex items-center h-8 px-3 rounded-md text-[12.5px] font-medium text-[#0F172A] dark:text-zinc-200 bg-[#F1F5F9] dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-[#F3912E]/45 hover:border-[#F3912E] hover:text-[#F3912E] transition-colors"
          >
            Guide Me
          </button>
        </div>

        {/* Center Wide Search Bar (Desktop MD+) */}
        <div className="flex-1 max-w-[560px] hidden md:block">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search and Learn"
              aria-label="Search courses"
              data-testid="learn-search-input"
              className="w-full h-10 pl-4 pr-10 rounded-lg text-[13.5px] bg-[#F1F5F9] dark:bg-[#1A1D24] text-[#0F172A] dark:text-zinc-100 placeholder:text-[#64748B] dark:placeholder:text-zinc-500 border border-[#E2E8F0] dark:border-white/[0.08] focus:border-[#F3912E] focus:outline-none transition-colors"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="w-4 h-4 text-[#64748B] dark:text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Right: IDE Sandbox + Frosted Glass Light/Dark Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setSandboxOpen(true)}
            data-testid="ide-sandbox-btn"
            className="h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-[#F1F5F9] hover:bg-slate-200/80 dark:bg-[#1A1D24] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.1] text-[#0F172A] dark:text-zinc-200 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-[#F3912E]" />
            <span className="hidden sm:inline">IDE Sandbox</span>
          </button>

          <button
            type="button"
            onClick={(e) => toggleTheme(e)}
            aria-label="Toggle Light and Dark Mode"
            data-testid="learn-theme-toggle"
            className="theme-glass-btn w-8 h-8 rounded-md inline-flex items-center justify-center bg-slate-100/90 hover:bg-slate-200/90 dark:bg-[#1A1D24]/90 dark:hover:bg-white/[0.08] border border-slate-300 dark:border-white/[0.16] text-slate-700 dark:text-zinc-200"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[#F3912E]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. Full-Width Courses Content */}
      <main className="pt-[86px] pb-16 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto space-y-7">
        {/* Mobile Search Bar Fallback (< MD) */}
        <div className="md:hidden">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search and Learn"
              aria-label="Search courses mobile"
              className="w-full h-10 pl-4 pr-10 rounded-lg text-[13.5px] bg-white dark:bg-[#1A1D24] text-[#0F172A] dark:text-zinc-100 placeholder:text-[#64748B] dark:placeholder:text-zinc-500 border border-[#E2E8F0] dark:border-white/[0.08] focus:border-[#F3912E] focus:outline-none transition-colors"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear mobile search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="w-4 h-4 text-[#64748B] dark:text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Horizontal Category Strip */}
        <div className="relative flex items-center">
          <div
            ref={catStripRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar pr-14 py-0.5 w-full scroll-smooth"
            role="tablist"
            aria-label="Course categories"
          >
            {COURSE_CATEGORIES.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 h-11 px-5 rounded-lg text-[13.5px] font-medium whitespace-nowrap transition-all border ${
                    active
                      ? 'bg-[#F3912E]/15 text-[#F3912E] border-[#F3912E] font-semibold'
                      : 'bg-white dark:bg-[#252830] text-[#0F172A] dark:text-zinc-200 border-[#E2E8F0] dark:border-white/[0.07] hover:border-[#F3912E]/50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => catStripRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
            aria-label="Scroll categories right"
            className="absolute right-0 w-9 h-9 rounded-full bg-white text-slate-900 shadow-lg border border-[#E2E8F0] dark:border-transparent flex items-center justify-center hover:scale-105 transition-transform z-10"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3. Promo Hero Carousel (Auto-hidden when filtering/searching) */}
        {!isFiltered && slide && (
          <section
            data-testid="learn-hero-carousel"
            className="relative rounded-2xl overflow-hidden shadow-xl select-none border border-white/[0.07]"
          >
            <div
              className={`w-full min-h-[250px] sm:min-h-[295px] bg-gradient-to-r ${slide.gradient} px-8 sm:px-14 py-8 flex flex-col lg:flex-row items-center justify-between gap-8`}
            >
              <div className="max-w-[460px] space-y-3.5 z-10">
                <h1 className="text-[26px] sm:text-[34px] font-bold tracking-tight text-white leading-[1.15]">
                  {slide.title}
                </h1>
                <p className="text-[14.5px] sm:text-[15.5px] text-white/85 leading-relaxed">
                  {slide.subtitle}
                </p>
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => router.push(`/learn/${slide.courseSlug}`)}
                    className="h-11 px-6 rounded-lg bg-white hover:bg-zinc-100 text-slate-950 font-semibold text-[14px] shadow-md transition-colors"
                  >
                    {slide.ctaLabel}
                  </button>
                </div>
              </div>

              {/* Right Angled Floating UI Preview Cards */}
              <div className="hidden lg:flex items-center gap-4 -rotate-2 translate-y-2 z-10">
                <div className="w-[300px] rounded-xl bg-white text-slate-900 p-5 shadow-2xl space-y-3">
                  <div className="text-[10.5px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
                    {slide.mockupEyebrow}
                  </div>
                  <div className="text-[20px] font-extrabold tracking-tight leading-tight">
                    {slide.mockupTitle}
                  </div>
                  <p className="text-[11.5px] text-slate-500 leading-relaxed">
                    {slide.mockupMeta}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-3 py-1.5 rounded-md bg-[#F3912E] text-white text-[11px] font-semibold">
                      Start Learning →
                    </span>
                    <span className="px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                      Live IDE
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setHeroIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
              }
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-md flex items-center justify-center z-20"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setHeroIdx((i) => (i + 1) % HERO_SLIDES.length)}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-slate-900 shadow-md flex items-center justify-center z-20"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
              {HERO_SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setHeroIdx(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === heroIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Active Filter Banner */}
        {isFiltered && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.07] text-[13px]">
            <span className="text-[#64748B] dark:text-zinc-300">
              Showing {filteredAndSorted.length} course
              {filteredAndSorted.length === 1 ? '' : 's'}
              {activeCategory !== 'All Courses' ? ` in ${activeCategory}` : ''}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[#F3912E] hover:text-[#E07D19] font-semibold hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* 4. Recommended Courses Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[20px] font-bold tracking-tight text-[#0F172A] dark:text-white">
              {isFiltered ? 'Matching Courses' : 'Recommended Courses'}
            </h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort courses"
              className="h-9 pl-3.5 pr-8 rounded-lg text-[13px] font-medium bg-white dark:bg-[#22252C] text-[#0F172A] dark:text-zinc-100 border border-[#E2E8F0] dark:border-white/[0.08] focus:border-[#F3912E] focus:outline-none cursor-pointer"
            >
              <option value="popular">Popular</option>
              <option value="latest">Latest</option>
              <option value="duration">Longest</option>
              <option value="lessons">Most Lessons</option>
            </select>
          </div>

          {recommendedDisplay.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {recommendedDisplay.map((course) => {
                const { pct, completedCount } = getProgressNumbers(course);
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progressPct={pct}
                    completedCount={completedCount}
                    onClick={() => openCourse(course)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C] px-6 py-12 text-center space-y-3">
              <div className="text-[15px] font-semibold">No courses match your search</div>
              <p className="text-[13px] text-[#64748B] dark:text-zinc-400">
                Try clearing your search terms or switching back to All Courses.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white transition-colors"
              >
                Reset filters
              </button>
            </div>
          )}
        </section>

        {/* 5. Latest Courses & Following Strip (shown in default unfiltered browse mode) */}
        {!isFiltered && (
          <>
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[20px] font-bold tracking-tight text-[#0F172A] dark:text-white">
                  Latest Courses
                </h2>
                <span className="text-[12.5px] text-[#64748B] dark:text-zinc-400">
                  Notes · Quizzes · IDE Labs · Exams
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {latestCourses.map((course) => {
                  const { pct, completedCount } = getProgressNumbers(course);
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      progressPct={pct}
                      completedCount={completedCount}
                      onClick={() => openCourse(course)}
                    />
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[20px] font-bold tracking-tight text-[#0F172A] dark:text-white">
                Courses From People You Follow
              </h2>
              <div className="relative">
                <div
                  ref={followingStripRef}
                  className="flex gap-5 overflow-x-auto no-scrollbar pb-2 scroll-smooth"
                >
                  {followingCourses.map((course) => {
                    const { pct, completedCount } = getProgressNumbers(course);
                    return (
                      <div key={course.id} className="w-[290px] sm:w-[300px] shrink-0">
                        <CourseCard
                          course={course}
                          progressPct={pct}
                          completedCount={completedCount}
                          onClick={() => openCourse(course)}
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    followingStripRef.current?.scrollBy({ left: 360, behavior: 'smooth' })
                  }
                  aria-label="Scroll followed instructors courses right"
                  className="hidden md:flex absolute right-1 top-[42%] -translate-y-1/2 w-9 h-9 rounded-full bg-white text-slate-900 shadow-lg items-center justify-center hover:scale-105 transition-transform z-10"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Guide Me Goal Modal */}
      {guideOpen && (
        <div
          onClick={() => setGuideOpen(false)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-testid="guide-me-modal"
            className="w-full max-w-[540px] rounded-2xl bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.1] shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
                  Learning Path Assistant
                </span>
                <h2 className="text-[20px] font-bold mt-0.5 text-[#0F172A] dark:text-white">
                  What is your primary goal?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Close Guide Me dialog"
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#64748B] hover:bg-slate-100 dark:hover:bg-white/[0.08]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GUIDE_GOALS.map((g) => {
                const target = COURSES.find((c) => c.id === g.courseId) ?? COURSES[0];
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setGuideOpen(false);
                      if (target) openCourse(target);
                    }}
                    className="p-4 rounded-xl text-left bg-[#F1F5F9] dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.08] hover:border-[#F3912E] transition-colors space-y-1.5"
                  >
                    <div className="text-[14px] font-semibold text-[#0F172A] dark:text-white">
                      {g.goal}
                    </div>
                    <div className="text-[12px] text-[#64748B] dark:text-zinc-400">
                      {g.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <SandboxDrawer
        open={sandboxOpen}
        isDarkMode={isDarkMode}
        onClose={() => setSandboxOpen(false)}
      />
    </div>
  );
};
