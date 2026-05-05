import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'claude-kloud — practice for the CCA-F exam',
  description:
    'A hands-on lab platform for senior architects preparing for the Claude Certified Architect — Foundations exam. Real Claude API sandboxes. Scenario-based labs. Mock exams that mirror the real format.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
