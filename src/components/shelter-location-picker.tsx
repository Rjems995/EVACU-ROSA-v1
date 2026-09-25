'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function ShelterLocationPicker({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  let coordinates: number[] | null = null;
  try {
    const point = JSON.parse(value);
    if (point.type === 'Point' && point.coordinates?.length === 2 && point.coordinates.every(Number.isFinite)) coordinates = point.coordinates;
  } catch {}
  const lng = coordinates?.[0], lat = coordinates?.[1];
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current).setView([14.297, 121.109], 14);
    map.current = instance;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19, noWrap: true,
    }).addTo(instance);
    instance.on('click', (event: L.LeafletMouseEvent) => {
      latest.current(JSON.stringify({ type: 'Point', coordinates: [event.latlng.lng, event.latlng.lat] }));
    });
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (lng === undefined || lat === undefined) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      marker.current = L.marker([lat, lng], {
        draggable: true, title: 'Selected shelter location. Drag to adjust.',
        icon: L.divIcon({className: '', iconSize: [44,44], iconAnchor: [22,22], html: '<span class="map-pin pin-shelter"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/></svg></span>'}),
      }).addTo(instance);
      marker.current.on('dragend', () => {
        const point = marker.current!.getLatLng();
        latest.current(JSON.stringify({type:'Point', coordinates:[point.lng, point.lat]}));
      });
      instance.setView([lat,lng], 16);
    } else marker.current.setLatLng([lat,lng]);
  }, [lng, lat]);
  return <section className="street-picker" aria-label="Shelter location">
    <h3 className="text-lg font-bold">Pin the shelter on the map</h3>
    <p className="my-2">Click or tap the shelter entrance. Drag the house marker or tap again to adjust it.</p>
    <div ref={container} className="street-picker-map" role="region" aria-label="Shelter location map. Use arrow keys to pan and the button below to select the map center." />
    <button type="button" className="secondary-button mt-3" onClick={() => {
      const point = map.current?.getCenter();
      if (point) onChange(JSON.stringify({type:'Point',coordinates:[point.lng,point.lat]}));
    }}>Use map center as shelter location</button>
    <p role="status" className="selected-street">{lat !== undefined && lng !== undefined ? `Shelter location selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'Select a shelter location before saving.'}</p>
  </section>;
}
