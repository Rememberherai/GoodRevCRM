'use client';

import { CircleMarker, LayerGroup, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { clusterMapPoints, type CommunityAssetMapPoint } from '@/lib/community/map';
import { MarkerPopup } from './marker-popup';

interface AssetLayerProps {
  slug: string;
  items: CommunityAssetMapPoint[];
  visible: boolean;
  zoom: number;
}

function getClusterIcon(count: number) {
  return L.divIcon({
    className: 'community-map-cluster',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:9999px;background:#64748b;color:white;font-weight:700;border:2px solid white;">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export function AssetLayer({ slug, items, visible, zoom }: AssetLayerProps) {
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
              key={`asset-cluster-${cluster.id}`}
              position={[cluster.latitude, cluster.longitude]}
              icon={getClusterIcon(cluster.items.length)}
            >
              <Popup>
                <div className="min-w-48 space-y-2">
                  <div className="text-sm font-semibold">{cluster.items.length} assets</div>
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
            pathOptions={{ color: '#64748b', fillColor: '#64748b', fillOpacity: 0.85 }}
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
