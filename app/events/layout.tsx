import type { Metadata } from 'next';
import { EventsShell } from './events-shell';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Browse and register for upcoming events',
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <EventsShell>{children}</EventsShell>;
}
