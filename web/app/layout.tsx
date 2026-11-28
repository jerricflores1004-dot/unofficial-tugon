import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: 'TUGON | MDRRMO Mabini',
  description: 'Disaster incident reporting and response management for Mabini, Batangas.',
  applicationName: 'TUGON',
  appleWebApp: { capable: true, title: 'TUGON', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = { themeColor: '#2563eb' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}<PwaRegister /></body></html>;
}
