import { MapPin } from 'lucide-react';

export function PublicMapHeatmap({ title, granularity }: { title: string; granularity: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-muted p-12 text-center">
      <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">
        Aggregate geographic coverage at the {granularity} level.
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">Geographic visualization coming soon.</p>
    </div>
  );
}
