import type { Metadata } from 'next';
import './globals.css';
import { 
  PRIMARY_KEYWORDS, 
  AI_KEYWORDS, 
  DEBUGGING_TESTING_KEYWORDS, 
  CLOUD_IDE_KEYWORDS, 
  PRACTICE_KEYWORDS, 
  FULLSTACK_KEYWORDS 
} from '@/config/seo';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cortexcode.io';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Cortex — Free Online Compiler, Cloud IDE & AI Code Debugger (16+ Languages)',
    template: '%s | Cortex',
  },
  description:
    'Free online compiler, cloud IDE, and code runner across 16+ programming languages. Instant execution for Python, C++, Java, JavaScript, TypeScript, Rust, Go, SQL with AI error fixing, interactive terminal, and visual debugger.',
  keywords: [
    ...PRIMARY_KEYWORDS,
    ...AI_KEYWORDS,
    ...DEBUGGING_TESTING_KEYWORDS,
    ...CLOUD_IDE_KEYWORDS,
    ...PRACTICE_KEYWORDS,
    ...FULLSTACK_KEYWORDS,
    'python online compiler',
    'online python compiler',
    'c++ online compiler',
    'online c++ compiler',
    'c online compiler',
    'java online compiler',
    'javascript online compiler',
    'typescript online compiler',
    'rust online compiler',
    'go online compiler',
    'sql online editor',
  ],
  authors: [{ name: 'Cortex Team', url: APP_URL }],
  creator: 'Cortex',
  publisher: 'Cortex',
  applicationName: 'Cortex Cloud IDE',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Cortex — Free Online Compiler, Cloud IDE & AI Code Debugger',
    description:
      'Compile, run, and debug Python, C++, Java, JavaScript, Rust, Go, and 16+ languages online. Features instant AI error repair and interactive terminal.',
    url: APP_URL,
    siteName: 'Cortex — Code Beyond Limits',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/brand/cortex-logo.jpg',
        width: 1200,
        height: 630,
        alt: 'Cortex — Online Compiler & Cloud IDE',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cortex — Free Online Compiler, Cloud IDE & AI Code Debugger',
    description:
      'Run code online across 16+ runtimes with autonomous AI error fixing and visual debugging.',
    images: ['/brand/cortex-logo.jpg'],
    creator: '@cortexcode',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${APP_URL}/#webapp`,
        name: 'Cortex Cloud IDE & Online Compiler',
        url: APP_URL,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'All (Windows, macOS, Linux, ChromeOS, iOS, Android)',
        browserRequirements: 'Requires modern web browser with JavaScript support',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          'Online compiler for Python, C++, C, Java, JavaScript, TypeScript, Rust, Go, C#, PHP, Ruby, Kotlin, Swift, Dart, R, SQL',
          'Autonomous AI error detection and instant compiler error fixing',
          'Interactive terminal with bash compatibility and standard I/O (stdin/stdout)',
          'Visual interactive step-debugger with variable inspection and callstack frames',
          'Automated unit testing with custom test cases and micro-benchmarks',
          'Live responsive Web Preview with console log bridging',
        ],
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          ratingCount: '1840',
          bestRating: '5',
          worstRating: '1',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${APP_URL}/#organization`,
        name: 'Cortex',
        url: APP_URL,
        logo: `${APP_URL}/brand/cortex-emblem.png`,
        sameAs: ['https://github.com/cortexcode'],
      },
      {
        '@type': 'WebSite',
        '@id': `${APP_URL}/#website`,
        url: APP_URL,
        name: 'Cortex — Code Beyond Limits',
        publisher: {
          '@id': `${APP_URL}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${APP_URL}/?search={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is Cortex Online Compiler?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Cortex is a free online code compiler, cloud IDE, and programming platform that allows you to write, compile, and execute code online in 16+ programming languages (Python, C++, Java, JavaScript, TypeScript, Rust, Go, and more) directly in your web browser with zero installation.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is Cortex completely free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, Cortex is 100% free to use. You can compile code, run test cases, use the interactive terminal, and debug programs with no credit card or account required.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does the AI code error fixer work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Cortex includes an autonomous AI error fixer that analyzes your compiler errors, tracebacks, and syntax issues. With one click, it explains the error in plain English and generates verified, corrected code that you can preview and accept instantly.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does Cortex support interactive input (stdin) and terminal commands?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! Cortex features an authentic interactive terminal and a dedicated stdin tab so you can provide inputs to scanf, input(), cin, and Scanner, as well as run real commands like python, node, g++, touch, and ls.',
            },
          },
        ],
      },
    ],
  };

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Cortex Favicon */}
        <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
        <link rel="icon" type="image/png" href="/brand/cortex-emblem.png" />
        <link rel="apple-touch-icon" href="/brand/cortex-emblem.png" />

        {/* Structured Data JSON-LD for Google Rich Results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-[#0b0c0e] text-[#e6edf3] font-sans antialiased overflow-hidden selection:bg-[#ff9100]/30 selection:text-[#ff9100]">
        {children}
      </body>
    </html>
  );
}
