import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'flower-survey',
  description: 'Monorepo scaffold with Next.js, NestJS and PostgreSQL.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
