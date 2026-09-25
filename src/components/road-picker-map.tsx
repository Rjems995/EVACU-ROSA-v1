'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Road } from '@/lib/types';
export default function RoadPickerMap({
  roads,
  selectedId,
  onSelect,
  disabled,
}: {
  roads: Road[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null);
  const selection = useRef<L.LayerGroup | null>(null);
  const [message, setMessage] = useState('');
  const latest = useRef({ onSelect, disabled, roads });
  latest.current = { onSelect, disabled, roads };
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { preferCanvas: true }).setView([14.309, 121.11], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instance);
    map.current = instance;
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (latest.current.disabled) return;
      const point = instance.project(event.latlng, 18);
      let nearest: { id: string; metres: number } | undefined;
      for (const road of latest.current.roads) {
        const coords = road.geometry.coordinates;
        for (let i = 1; i < coords.length; i++) {
          const a = instance.project(L.latLng(coords[i - 1][1], coords[i - 1][0]), 18);
          const b = instance.project(L.latLng(coords[i][1], coords[i][0]), 18);
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = dx || dy ? Math.max(0, Math.min(1, ((point.x-a.x)*dx + (point.y-a.y)*dy)/(dx*dx+dy*dy))) : 0;
          const snapped = instance.unproject(L.point(a.x+t*dx, a.y+t*dy), 18);
          const metres = event.latlng.distanceTo(snapped);
          if (!nearest || metres < nearest.metres) nearest = {id:road.id, metres};
        }
      }
      if (nearest && nearest.metres <= 75) {
        latest.current.onSelect(nearest.id);
        setMessage('Nearest street selected. Check the highlighted segment before publishing.');
      } else {
        latest.current.onSelect('');
        setMessage('No mapped street within 75 metres. Tap closer to the affected street or use street search.');
      }
    });
    selection.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const group = L.layerGroup().addTo(map.current);
    roads.forEach((road) => {
      const tooltip = document.createElement('span');
      tooltip.textContent = road.name;
      L.geoJSON(road.geometry, { bubblingMouseEvents: false, style: { color: '#286e8a', weight: 8, opacity: 0.55 } })
        .bindTooltip(tooltip)
        .on('click', () => {
          if (!latest.current.disabled) { latest.current.onSelect(road.id); setMessage('Street selected. Check the highlighted segment before publishing.'); }
        })
        .addTo(group);
    });
    return () => {
      group.remove();
    };
  }, [roads]);
  useEffect(() => {
    selection.current?.clearLayers();
    const road = roads.find((r) => r.id === selectedId);
    if (!road || !selection.current) return;
    const highlight = L.geoJSON(road.geometry, {
      style: { color: '#b8322b', weight: 10, opacity: 1 },
      interactive: false,
    }).addTo(selection.current);
    highlight.bringToFront();
    map.current?.fitBounds(highlight.getBounds(), {
      padding: [45, 45],
      maxZoom: 17,
      animate: false,
    });
  }, [roads, selectedId]);
  return (
    <><div
      ref={container}
      className="street-picker-map"
      role="region"
      aria-label="Street selection map. The search and radio buttons below offer the same selection."
    />{message && <p className="my-2" role="status">{message}</p>}</>
  );
}
