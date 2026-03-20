'use client';

import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MiniMapProps {
  center: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  points: Array<{
    id: string;
    latitude: number;
    longitude: number;
  }>;
}

export function MiniMap({ center, points }: MiniMapProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Community Coverage</CardTitle>
        <CardDescription>Current household distribution across the mapped service area.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border">
          <MapContainer
            center={[center.latitude, center.longitude]}
            zoom={Math.max(center.zoom - 1, 9)}
            scrollWheelZoom={false}
            dragging={false}
            doubleClickZoom={false}
            touchZoom={false}
            zoomControl={false}
            className="h-64 w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((point) => (
              <CircleMarker
                key={point.id}
                center={[point.latitude, point.longitude]}
                radius={5}
                pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.7 }}
              />
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
