import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Bug Reports' };

export default function BugReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
