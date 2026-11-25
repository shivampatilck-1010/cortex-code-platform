import Link from 'next/link';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0c0d11] text-zinc-200 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <Link href="/" className="flex items-center gap-3 text-white font-semibold">
            <CortexLogo size="sm" variant="icon" />
            <span>Cortex Platform</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/ide" className="px-3 py-1.5 rounded bg-[#ff9100] text-black font-semibold hover:bg-[#ff9e1f] transition-colors">Open IDE</Link>
          </div>
        </div>

        <header className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-[#ff9100]">Legal &amp; Governance</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-zinc-400">Last updated: November 2026</p>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">1. Account &amp; Authentication Data</h2>
          <p>
            When you sign in via email/password or Google OAuth, Cortex stores your name, email address,
            assigned platform role, Cortex ID, and optional profile avatar URL in Cloudflare D1 to authenticate
            your sessions and synchronize your workspaces, classroom enrollments, and learning progress.
          </p>

          <h2 className="text-lg font-semibold text-white">2. Workspace Code &amp; Execution Telemetry</h2>
          <p>
            Source code files saved inside cloud workspaces are stored strictly for your editing, execution,
            version history, and authorized classroom grading workflows. Runtime compilation and sandbox output
            logs are processed solely to return results to your IDE or evaluation session.
          </p>

          <h2 className="text-lg font-semibold text-white">3. Proctored Classroom Examinations</h2>
          <p>
            Exam lockdown mode records integrity signals only during active proctored exam sessions launched by
            an instructor. Exam submissions, proctoring audit logs, and grading records remain scoped to the
            administering institution and classroom instructor.
          </p>

          <h2 className="text-lg font-semibold text-white">4. Cookies &amp; Session Security</h2>
          <p>
            Cortex uses HttpOnly, SameSite session cookies to maintain authentication state and Cloudflare Turnstile
            verification tokens to protect sign-in endpoints from automated abuse. Third-party API keys such as
            user-provided Gemini keys remain stored locally in your browser unless explicitly sent during an AI request.
          </p>
        </section>
      </div>
    </div>
  );
}
