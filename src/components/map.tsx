'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HazardType, Position, Route, Snapshot } from '@/lib/types';
import { segmentRisk, shelterStatus } from '@/lib/routing';
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
const shelterHouse = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/></svg>';
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
    // Draw the same road IDs that routing evaluates. No hazard-area polygons.
    snapshot.roads.forEach((road) => {
      const reports = snapshot.hazards.filter((h) => h.active && h.road_id === road.id);
      if (
        !road.blocked &&
        road.condition < 0.95 &&
        !reports.some((h) => visible.includes(h.hazard_type))
      )
        return;
      const blocked = segmentRisk(road, snapshot.hazards).blocked;
      const color = blocked ? '#b8322b' : '#a16207';
      const label = document.createElement('span');
      label.textContent = `${road.name} — ${blocked ? 'Blocked' : 'Affected'}${reports.length ? ' · ' + reports.map((h) => h.hazard_type).join(', ') : ''}`;
      const popup = document.createElement('section');
      const title = document.createElement('strong');
      title.textContent = label.textContent;
      popup.append(title);
      for (const report of reports) {
        const detail = document.createElement('p');
        detail.textContent = `${report.hazard_type} · ${Math.round(report.severity * 100)}% severity. ${report.notes}`;
        popup.append(detail);
      }
      const segment = L.geoJSON(road.geometry, {
        style: {
          color,
          weight: 8,
          opacity: 0.95,
          lineCap: 'round',
          dashArray: blocked ? undefined : '8 6',
          className: `hazard-street ${blocked ? 'blocked-street' : 'affected-street'}`,
        },
      })
        .bindTooltip(label, { permanent: true, direction: 'top', className: 'street-label' })
        .bindPopup(popup)
        .addTo(group);
      segment.eachLayer((item) => {
        const element = (item as L.Path).getElement();
        if (!element) return;
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', label.textContent || road.name);
        element.addEventListener('keydown', (event) => {
          const key = (event as KeyboardEvent).key;
          if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            item.openPopup();
          }
        });
      });
    });
    snapshot.shelters.forEach((s) => {
      const status = shelterStatus(s),
        [lng, lat] = s.geometry.coordinates;
      const marker = L.marker([lat, lng], {
        icon: icon(
          shelterHouse,
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
  useEffect(() => {
    if (props.origin && !props.route)
      map.current?.setView([props.origin[1], props.origin[0]], 15, { animate: false });
  }, [props.origin]);
  return (
    <div
      ref={element}
      className={`map-canvas ${props.picking ? 'is-picking' : ''}`}
      role="region"
      aria-label="Evacuation map. Use the shelter list for equivalent keyboard-accessible route information."
    />
  );
}
