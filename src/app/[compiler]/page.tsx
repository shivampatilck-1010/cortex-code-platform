import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLanguageConfig, SUPPORTED_LANGUAGES } from '@/config/languages';
import { LANGUAGE_SEO_MAP } from '@/config/seo';
import { CompilerClientView } from './CompilerClientView';

interface CompilerPageProps {
  params: {
    compiler: string;
  };
}

// Generate static routes for all 16 supported languages at build time (SSG)
export function generateStaticParams() {
  return Object.values(LANGUAGE_SEO_MAP).map((cfg) => ({
    compiler: cfg.slug,
  }));
}

// Helper to resolve language key from URL slug
function resolveLangFromSlug(slug: string): string {
  const clean = slug
    .replace('-online-compiler', '')
    .replace('-compiler', '')
    .replace('-online-editor', '')
    .replace('-online-ide', '');

  if (clean === 'c++') return 'cpp';
  if (clean === 'golang') return 'go';
  if (clean === 'csharp' || clean === 'c-sharp') return 'csharp';
  if (clean === 'js' || clean === 'node') return 'javascript';
  if (clean === 'ts') return 'typescript';
  if (clean === 'py') return 'python';

  return clean;
}

// Dynamic SEO Metadata for Google #1 Ranking
export async function generateMetadata({ params }: CompilerPageProps): Promise<Metadata> {
  const langKey = resolveLangFromSlug(params.compiler);
  const seoData = LANGUAGE_SEO_MAP[langKey] || LANGUAGE_SEO_MAP['python'];
  const langConfig = getLanguageConfig(langKey);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cortexcode.io';

  return {
    title: seoData.title,
    description: seoData.description,
    keywords: [
      ...seoData.keywords,
      `${langConfig.name.toLowerCase()} online compiler`,
      `online ${langConfig.name.toLowerCase()} compiler`,
      `free ${langConfig.name.toLowerCase()} compiler`,
      `run ${langConfig.name.toLowerCase()} online`,
      `execute ${langConfig.name.toLowerCase()} online`,
      'online compiler',
      'online code compiler',
      'cloud IDE',
      'online code runner',
      'AI code fixer',
      'online code debugger',
    ],
    alternates: {
      canonical: `/${params.compiler}`,
    },
    openGraph: {
      title: seoData.title,
      description: seoData.description,
      url: `${baseUrl}/${params.compiler}`,
      siteName: 'Cortex — Code Beyond Limits',
      type: 'website',
      images: [
        {
          url: '/brand/cortex-logo.jpg',
          width: 1200,
          height: 630,
          alt: `Cortex Online ${langConfig.name} Compiler`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seoData.title,
      description: seoData.description,
      images: ['/brand/cortex-logo.jpg'],
      creator: '@cortexcode',
    },
  };
}

export default function SEOCompilerPage({ params }: CompilerPageProps) {
  const langKey = resolveLangFromSlug(params.compiler);
  const langConfig = getLanguageConfig(langKey);
  const seoData = LANGUAGE_SEO_MAP[langKey] || LANGUAGE_SEO_MAP['python'];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cortexcode.io';

  // Structured Data Schema for Google Rich Snippets
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${baseUrl}/${params.compiler}#webapp`,
        name: `Cortex Online ${langConfig.name} Compiler`,
        url: `${baseUrl}/${params.compiler}`,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'All',
        browserRequirements: 'Requires modern web browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        description: seoData.description,
        featureList: seoData.features,
      },
      {
        '@type': 'FAQPage',
        mainEntity: seoData.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CompilerClientView langConfig={langConfig} seoData={seoData} />
    </>
  );
}
