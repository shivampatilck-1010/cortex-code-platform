import { MetadataRoute } from 'next';
import { LANGUAGE_SEO_MAP } from '@/config/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cortexcode.io';
  const now = new Date();

  // 1. Root & Core Hub Pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/challenges`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/learn`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // 2. All 16 Dedicated Language Compiler Landing Pages
  const compilerRoutes: MetadataRoute.Sitemap = Object.values(LANGUAGE_SEO_MAP).map((lang) => ({
    url: `${baseUrl}/${lang.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.95,
  }));

  return [...staticRoutes, ...compilerRoutes];
}
