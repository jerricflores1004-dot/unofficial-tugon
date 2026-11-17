import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TUGON | MDRRMO Mabini',
  description: 'Disaster incident reporting and response management for Mabini, Batangas.',
  // The TUGON mark is picked up automatically from app/icon.png and
  // app/apple-icon.png (same artwork as the mobile launcher icon).
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
