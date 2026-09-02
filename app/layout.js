import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: {
    default: 'Quran Minds',
    template: '%s · Quran Minds',
  },
  description:
    'Hifdh management for students, teachers, parents and Islamic schools: Sabaq, Sabqi and Manzil in one place.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Quran Minds', statusBarStyle: 'default' },
};

export const viewport = {
  themeColor: '#134e3a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
