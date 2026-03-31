import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';

import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

import './globals.css';

export const metadata: Metadata = {
  title: 'a11y-ai — AI-Powered Accessibility Auditor',
  description:
    'Combines axe-core static analysis with AI semantic analysis. Catch accessibility issues that static tools miss.',
  openGraph: {
    title: 'a11y-ai — AI-Powered Accessibility Auditor',
    description: 'Accessibility auditing that understands your page.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
