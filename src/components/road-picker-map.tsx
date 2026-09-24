'use client';
import { useEffect, useRef } from 'react';
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
  const latest = useRef({ onSelect, disabled });
  latest.current = { onSelect, disabled };
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { preferCanvas: true }).setView([14.309, 121.11], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instance);
    map.current = instance;
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
      L.geoJSON(road.geometry, { style: { color: '#286e8a', weight: 8, opacity: 0.55 } })
        .bindTooltip(tooltip)
        .on('click', () => {
          if (!latest.current.disabled) latest.current.onSelect(road.id);
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
    <div
      ref={container}
      className="street-picker-map"
      role="region"
      aria-label="Street selection map. The search and radio buttons below offer the same selection."
    />
  );
}
