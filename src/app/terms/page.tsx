import Link from 'next/link';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#0c0d11] text-zinc-200 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <Link href="/" className="flex items-center gap-3 text-white font-semibold">
            <CortexLogo size="sm" variant="icon" />
            <span>Cortex Platform</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/ide" className="px-3 py-1.5 rounded bg-[#ff9100] text-black font-semibold hover:bg-[#ff9e1f] transition-colors">Open IDE</Link>
          </div>
        </div>

        <header className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-[#ff9100]">Legal &amp; Governance</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Terms of Service</h1>
          <p className="text-sm text-zinc-400">Last updated: November 2026</p>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">1. Acceptable Platform Usage</h2>
          <p>
            Cortex provides cloud IDE workspaces, algorithmic benchmarks, learning tracks, and live virtual classrooms
            for educational, research, and software development use. Users may not execute denial-of-service workloads,
            network scanners, cryptominers, or attempt sandbox escapes against execution nodes.
          </p>

          <h2 className="text-lg font-semibold text-white">2. Academic Integrity &amp; Lockdown Assessments</h2>
          <p>
            When participating in proctored classroom assessments or Cortex Lockdown exams, you agree to abide by
            your institution&apos;s academic honesty rules and not tamper with proctoring telemetry or client software.
          </p>

          <h2 className="text-lg font-semibold text-white">3. Intellectual Property</h2>
          <p>
            You retain ownership of all source code you author in personal workspaces. Course curricula, benchmark
            test harnesses, and platform UI components remain protected software assets.
          </p>

          <h2 className="text-lg font-semibold text-white">4. Service Availability</h2>
          <p>
            Rate limits and execution quotas apply across sandboxed code runners and AI assistance endpoints to maintain
            fair multi-tenant availability across all active workspaces and classrooms.
          </p>
        </section>
      </div>
    </div>
  );
}
