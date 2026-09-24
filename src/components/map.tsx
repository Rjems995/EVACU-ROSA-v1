'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HazardType, Position, Route, Snapshot } from '@/lib/types';
import { shelterStatus } from '@/lib/routing';
type Props = {
  snapshot: Snapshot;
  origin: Position | null;
  route: Route | null;
  visible: HazardType[];
  boundaries: boolean;
  picking: boolean;
  onPick: (p: Position) => void;
  onShelter: (id: string) => void;
};
const icon = (content: string, style: string) =>
  L.divIcon({
    className: '',
    html: `<span class="map-pin ${style}">${content}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
export default function EvacuationMap(props: Props) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { zoomControl: false }).setView([14.297, 121.109], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(instance);
    instance.on('click', (e) => {
      if (latest.current.picking) latest.current.onPick([e.latlng.lng, e.latlng.lat]);
    });
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    const { snapshot, origin, route, visible, boundaries } = props;
    if (boundaries)
      snapshot.boundaries.forEach((b) =>
        L.geoJSON(b.geometry, {
          style: {
            color: '#697c79',
            weight: b.kind === 'city' ? 2 : 1,
            dashArray: '6 6',
            fillOpacity: 0,
          },
        })
          .bindTooltip(b.name)
          .addTo(group),
      );
    if (snapshot.demo)
      snapshot.roads.forEach((r) =>
        L.geoJSON(r.geometry, {
          style: { color: '#718c83', weight: 2, opacity: 0.32, dashArray: '3 5' },
        }).addTo(group),
      );
    snapshot.hazards
      .filter((h) => h.active && visible.includes(h.hazard_type))
      .forEach((h) => {
        const color = h.severity >= 0.85 ? '#c24132' : '#a16207';
        const label = document.createElement('span');
        label.textContent = `${h.name} · ${h.hazard_type} · ${Math.round(h.severity * 100)}% severity`;
        L.geoJSON(h.geometry, {
          style: {
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.2,
            dashArray: h.hazard_type === 'earthquake' ? '5 5' : undefined,
          },
        })
          .bindPopup(label)
          .addTo(group);
      });
    snapshot.shelters.forEach((s, i) => {
      const status = shelterStatus(s),
        [lng, lat] = s.geometry.coordinates;
      const marker = L.marker([lat, lng], {
        icon: icon(
          String(i + 1),
          status === 'Full' || status === 'Closed' ? 'pin-full' : 'pin-shelter',
        ),
        title: `${s.name}, ${status}`,
        keyboard: true,
      });
      marker.on('click', () => latest.current.onShelter(s.id));
      marker.addTo(group);
    });
    if (route && route.coordinates.length > 1) {
      const latLngs = route.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
      L.polyline(latLngs, { color: '#fff', weight: 9 }).addTo(group);
      L.polyline(latLngs, { color: '#17744d', weight: 5 }).addTo(group);
      map.current?.fitBounds(L.latLngBounds(latLngs), {
        padding: [65, 65],
        maxZoom: 15,
        animate: false,
      });
    }
    if (origin)
      L.marker([origin[1], origin[0]], {
        icon: icon('<span></span>', 'pin-location'),
        title: 'Your selected starting point',
      }).addTo(group);
  }, [props.snapshot, props.origin, props.route, props.visible, props.boundaries]);
  return (
    <div
      ref={element}
      className={`map-canvas ${props.picking ? 'is-picking' : ''}`}
      role="region"
      aria-label="Evacuation map. Use the shelter list for equivalent keyboard-accessible route information."
    />
  );
}
