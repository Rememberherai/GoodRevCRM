'use client';

import { CircleMarker, LayerGroup, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { clusterMapPoints, type HouseholdMapPoint } from '@/lib/community/map';
import { MarkerPopup } from './marker-popup';

interface HouseholdLayerProps {
  slug: string;
  items: HouseholdMapPoint[];
  visible: boolean;
  zoom: number;
}

function getClusterIcon(count: number) {
  return L.divIcon({
    className: 'community-map-cluster',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:9999px;background:#2563eb;color:white;font-weight:700;border:2px solid white;">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export function HouseholdLayer({ slug, items, visible, zoom }: HouseholdLayerProps) {
  if (!visible) return null;

  const clusters = clusterMapPoints(items, zoom);

  return (
    <LayerGroup>
      {clusters.map((cluster) => {
        const item = cluster.items[0];
        if (!item) {
          return null;
        }

        if (cluster.isCluster) {
          return (
            <Marker
              key={`household-cluster-${cluster.id}`}
              position={[cluster.latitude, cluster.longitude]}
              icon={getClusterIcon(cluster.items.length)}
            >
              <Popup>
                <div className="min-w-48 space-y-2">
                  <div className="text-sm font-semibold">{cluster.items.length} households</div>
                  <div className="text-xs text-muted-foreground">
                    {cluster.items.slice(0, 3).map((item) => item.name).join(', ')}
                    {cluster.items.length > 3 ? '…' : ''}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        }

        return (
          <CircleMarker
            key={item.id}
            center={[item.latitude, item.longitude]}
            radius={7}
            pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.85 }}
          >
            <Popup>
              <MarkerPopup slug={slug} point={item} />
            </Popup>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
}
