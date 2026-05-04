import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth-context';
import { CookieBanner } from '@/components/legal/cookie-banner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DataClaus - Data Marketplace',
  description: 'DataClaus data marketplace and advertising platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <CookieBanner />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
