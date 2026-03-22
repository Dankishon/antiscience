import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteShell } from '../components/site-shell';
import { getDictionary } from '../lib/i18n';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: getDictionary().meta.title,
  description: getDictionary().meta.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Providers>
          <SiteShell>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
