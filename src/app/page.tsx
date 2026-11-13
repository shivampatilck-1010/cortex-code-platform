'use client';

import React, { useState } from 'react';
import { ThemeProvider } from '@/components/landing/ThemeContext';
import { LandingHeaderNav } from '@/components/landing/LandingHeaderNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { InteractiveVideoShowcase } from '@/components/landing/InteractiveVideoShowcase';
import { LandingStickyNav } from '@/components/landing/LandingStickyNav';
import { IdeProductShowcase } from '@/components/landing/IdeProductShowcase';
import { ClassroomProductShowcase } from '@/components/landing/ClassroomProductShowcase';
import { LockdownProductShowcase } from '@/components/landing/LockdownProductShowcase';
import { TechnicalArchitectureGrid } from '@/components/landing/TechnicalArchitectureGrid';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function LandingRootPage() {
  const [activeSection, setActiveSection] = useState<string>('cortex-ide');

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[#FFFFFF] text-zinc-950 dark:bg-[#08090A] dark:text-[#E6EDF3] selection:bg-[#FF9100]/30 selection:text-[#FF9100] antialiased transition-colors duration-300">
        {/* 1. Frosted Sticky Top Navigation with Dual Theme Toggle */}
        <LandingHeaderNav />

        {/* Main Scrollytelling Showcase */}
        <main className="relative">
          {/* 2. Flagship Hero Section with Interactive Waves Background */}
          <LandingHero />

          {/* 3. Antigravity Interactive Scrollytelling Video Theater */}
          <InteractiveVideoShowcase />

          {/* 4. Sticky Progress Navigation Pill */}
          <LandingStickyNav 
            activeSection={activeSection} 
            onSelectSection={(id) => setActiveSection(id)} 
          />

          {/* 5. Product 01: Cortex IDE Showcase */}
          <IdeProductShowcase />

          {/* 6. Product 02: Cortex Classroom Showcase */}
          <ClassroomProductShowcase />

          {/* 7. Product 03: Cortex Browser Showcase (In Development) */}
          <LockdownProductShowcase />

          {/* 8. Enterprise Distributed Architecture Grid */}
          <TechnicalArchitectureGrid />
        </main>

        {/* 9. Enterprise Landing Footer */}
        <LandingFooter />
      </div>
    </ThemeProvider>
  );
}
