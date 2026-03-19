'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { LOCATION_TYPE_LABELS } from '@/types/calendar';
import type { EventType, LocationType } from '@/types/calendar';
import { useCalendarContext } from '../calendar-context';

export default function EventTypesPage() {
  const router = useRouter();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { selectedProjectId, profileSlug } = useCalendarContext();

  // Clean up the copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadEventTypes() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedProjectId) params.set('project_id', selectedProjectId);
        const res = await fetch(`/api/calendar/event-types?${params}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEventTypes(data.event_types || []);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadEventTypes();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  const copyBookingLink = async (slug: string) => {
    if (!profileSlug) {
      router.push('/calendar/settings');
      return;
    }
    const url = `${window.location.origin}/book/${profileSlug}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      // Fallback or just ignore
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading event types...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Event Types</h1>
        <Link href="/calendar/event-types/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Event Type
          </Button>
        </Link>
      </div>

      {eventTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No event types yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first event type to start accepting bookings.
            </p>
            <Link href="/calendar/event-types/new">
              <Button>Create Event Type</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {eventTypes.map((et) => (
            <Card key={et.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: et.color ?? '#3b82f6' }}
                    />
                    <div>
                      <Link
                        href={`/calendar/event-types/${et.id}`}
                        className="font-semibold hover:underline"
                      >
                        {et.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {et.duration_minutes} min &middot;{' '}
                        {LOCATION_TYPE_LABELS[et.location_type as LocationType] || et.location_type}
                      </p>
                    </div>
                  </div>
                  <Badge variant={et.is_active ? 'default' : 'secondary'}>
                    {et.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {et.description && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {et.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyBookingLink(et.slug)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copiedSlug === et.slug ? 'Copied!' : 'Copy Link'}
                  </Button>
                  <Link href={`/calendar/event-types/${et.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
