import type { MetadataRoute } from 'next';

// Served at /manifest.webmanifest: makes the web workspace installable as an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TUGON | MDRRMO Mabini',
    short_name: 'TUGON',
    description: 'Disaster incident reporting and response management for Mabini, Batangas.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
