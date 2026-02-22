// RUTA: src/app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://inakat.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://inakat.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://inakat.com/companies', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://inakat.com/talents', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://inakat.com/contact', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://inakat.com/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://inakat.com/privacy', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];
}
