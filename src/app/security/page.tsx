import Link from 'next/link';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function SecurityOverviewPage() {
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
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/lockdown/download" className="hover:text-white transition-colors">Lockdown Downloads</Link>
          </div>
        </div>

        <header className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-[#ff9100]">Architecture &amp; Trust</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Platform Security</h1>
          <p className="text-sm text-zinc-400">Edge authentication, isolated code execution, and proctored assessment hardening.</p>
        </header>

        <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
          <h2 className="text-lg font-semibold text-white">1. Edge Session &amp; OAuth Protections</h2>
          <p>
            Authentication endpoints combine timing-safe credential hashing, cryptographic CSRF state validation
            for Google and GitHub OAuth, rate limiting, and Cloudflare Turnstile bot protection on sign-in requests.
          </p>

          <h2 className="text-lg font-semibold text-white">2. Sandboxed Execution &amp; SQL Safety</h2>
          <p>
            Code execution requests are constrained by CPU time, wall-clock duration, memory limits, and output caps.
            SQL sandboxes neutralize dangerous PRAGMA directives, database attaches, and extension loads before query execution.
          </p>

          <h2 className="text-lg font-semibold text-white">3. Proctored Exam Integrity</h2>
          <p>
            Cortex Lockdown verifies signed launch grants, device trust tokens, policy digests, and tamper-evident
            submission receipts, backed by server-enforced session state on Cloudflare Durable Objects and D1.
          </p>
        </section>
      </div>
    </div>
  );
}
