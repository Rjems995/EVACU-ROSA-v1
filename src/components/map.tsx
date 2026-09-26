'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HazardType, Position, Route, Snapshot } from '@/lib/types';
import { segmentRisk, shelterStatus } from '@/lib/routing';
import { useLanguage } from './language-provider';
type Props = {
  snapshot: Snapshot;
  origin: Position | null;
  route: Route | null;
  visible: HazardType[];
  boundaries: boolean;
  picking: boolean;
  navigating?: boolean;
  overview?: number;
  onPick: (p: Position) => void;
  onShelter: (id: string) => void;
};
const shelterHouse =
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/></svg>';
const icon = (content: string, style: string) =>
  L.divIcon({
    className: '',
    html: `<span class="map-pin ${style}">${content}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
export default function EvacuationMap(props: Props) {
  const { t } = useLanguage();
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null);
  const latest = useRef(props);
  const streetRenderer = useRef<L.Canvas | null>(null);
  latest.current = props;
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { zoomControl: false, maxBoundsViscosity: 1 }).setView(
      [14.297, 121.109],
      14,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      noWrap: true,
    }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(instance);
    instance.on('click', (e) => {
      if (latest.current.picking) latest.current.onPick([e.latlng.lng, e.latlng.lat]);
    });
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => {
      instance.invalidateSize();
      const current = latest.current;
      if (current.navigating && current.route?.coordinates.length) {
        instance.fitBounds(
          L.latLngBounds(current.route.coordinates.map(([lng, lat]) => L.latLng(lat, lng))),
          {
            paddingTopLeft: [35, 35],
            paddingBottomRight: [45, 120],
            maxZoom: 17,
            animate: false,
          },
        );
      }
    });
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      streetRenderer.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !props.snapshot.roads.length) return;
    const coverage = L.latLngBounds(
      props.snapshot.roads.flatMap((road) =>
        road.geometry.coordinates.map(([lng, lat]) => L.latLng(lat, lng)),
      ),
    );
    const bounds = coverage.pad(0.08);
    instance.setMaxBounds(bounds);
    const update = () => {
      instance.invalidateSize();
      instance.setMinZoom(instance.getBoundsZoom(bounds));
    };
    update();
    instance.fitBounds(coverage, { padding: [20, 20], animate: false });
    instance.on('resize', update);
    return () => {
      instance.off('resize', update);
    };
  }, [props.snapshot.roads]);
  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    const { snapshot, origin, route, visible, boundaries } = props;
    if (props.navigating) {
      const renderer = (streetRenderer.current ??= L.canvas({ padding: 0.2 }));
      snapshot.roads.forEach((road) =>
        L.polyline(
          road.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
          { color: '#8999ac', weight: 2, opacity: 0.5, interactive: false, renderer },
        ).addTo(group),
      );
    }
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
        !reports.some((h) => props.navigating || visible.includes(h.hazard_type))
      )
        return;
      const blocked = segmentRisk(road, snapshot.hazards).blocked;
      const color = blocked ? '#b8322b' : '#a16207';
      const label = document.createElement('span');
      label.textContent = `${road.name} — ${t(blocked ? 'Blocked' : 'Affected')}${reports.length ? ' · ' + reports.map((h) => t(h.hazard_type)).join(', ') : ''}`;
      const popup = document.createElement('section');
      const title = document.createElement('strong');
      title.textContent = label.textContent;
      popup.append(title);
      for (const report of reports) {
        const detail = document.createElement('p');
        detail.textContent = `${t(report.hazard_type)} · ${Math.round(report.severity * 100)}%. ${report.notes}`;
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
          ['Full', 'Closed', 'Not accepting'].includes(status) ? 'pin-full' : 'pin-shelter',
        ),
        title: `${s.name}, ${t(status)}`,
        keyboard: true,
      });
      marker.on('click', () => latest.current.onShelter(s.id));
      marker.addTo(group);
    });
    if (route && route.coordinates.length > 1) {
      const latLngs = route.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
      L.polyline(latLngs, { color: '#fff', weight: 9 }).addTo(group);
      L.polyline(latLngs, {
        color: props.navigating ? '#1265dd' : '#17744d',
        weight: props.navigating ? 7 : 5,
        className: 'evacuation-route',
      }).addTo(group);
      map.current?.fitBounds(L.latLngBounds(latLngs), {
        padding: [65, 65],
        maxZoom: 15,
        animate: false,
      });
    }
    if (origin)
      L.marker([origin[1], origin[0]], {
        icon: icon('<span></span>', 'pin-location'),
        title: t('Your selected starting point'),
      }).addTo(group);
  }, [
    props.snapshot,
    props.origin,
    props.route,
    props.visible,
    props.boundaries,
    props.navigating,
    props.overview,
    t,
  ]);
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
