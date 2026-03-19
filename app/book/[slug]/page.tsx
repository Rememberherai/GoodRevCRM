'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { PublicCalendarProfile, PublicEventType } from '@/types/calendar';
import { LOCATION_TYPE_LABELS } from '@/types/calendar';
import type { LocationType } from '@/types/calendar';

export default function PublicProfilePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [profile, setProfile] = useState<PublicCalendarProfile | null>(null);
  const [eventTypes, setEventTypes] = useState<PublicEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/book/profile/${slug}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setProfile(data.profile);
        setEventTypes(data.event_types || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">This booking page doesn&apos;t exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        {profile.avatar_url && (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-20 h-20 rounded-full mx-auto"
            width={80}
            height={80}
          />
        )}
        <h1 className="text-2xl font-bold">{profile.display_name}</h1>
        {profile.bio && <p className="text-muted-foreground max-w-md mx-auto">{profile.bio}</p>}
        {profile.welcome_message && (
          <p className="text-sm text-muted-foreground">{profile.welcome_message}</p>
        )}
      </div>

      {eventTypes.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No event types available for booking.</p>
      ) : (
        <div className="grid gap-4">
          {eventTypes.map((et) => (
            <Link
              key={et.id}
              href={`/book/${slug}/${et.slug}`}
              className="block rounded-lg border bg-white dark:bg-gray-900 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-2 h-12 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: et.color }}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold">{et.title}</h2>
                  {et.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{et.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span>{et.duration_minutes} min</span>
                    <span>&middot;</span>
                    <span>{LOCATION_TYPE_LABELS[et.location_type as LocationType]}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
