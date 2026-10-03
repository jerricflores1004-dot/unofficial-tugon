import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TUGON | MDRRMO Mabini',
  description: 'Disaster incident reporting and response management for Mabini, Batangas.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
