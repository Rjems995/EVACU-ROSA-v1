'use client';
import { useEffect, useState } from 'react';
import type { Position, Route } from '@/lib/types';
import { distance } from '@/lib/routing';

export type LiveFix = { position: Position; accuracy: number };
export default function LiveNavigation({
  route,
  destination,
  language,
  onFix,
  onArrive,
}: {
  route: Route;
  destination: Position;
  language: string;
  onFix: (fix: LiveFix | null) => void;
  onArrive: () => void;
}) {
  const [fix, setFix] = useState<LiveFix | null>(null);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fil = language === 'fil';
  useEffect(() => {
    if (!navigator.geolocation) {
      setError(true);
      return;
    }
    let active = true;
    let expiry: ReturnType<typeof setTimeout>;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!active) return;
        clearTimeout(expiry);
        const next = {
          position: [p.coords.longitude, p.coords.latitude] as Position,
          accuracy: p.coords.accuracy,
        };
        setFix(next);
        onFix(next);
        setError(false);
        expiry = setTimeout(() => {
          setFix(null);
          onFix(null);
          setError(true);
        }, 20000);
      },
      () => {
        if (active) {
          setFix(null);
          onFix(null);
          setError(true);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    return () => {
      active = false;
      clearTimeout(expiry);
      navigator.geolocation.clearWatch(id);
      onFix(null);
    };
  }, [onFix]);
  // Distance to line segments, rather than vertices, avoids false off-route warnings on long roads.
  const offRoute =
    fix &&
    route.coordinates.length > 1 &&
    route.coordinates.slice(1).every((b, i) => {
      const a = route.coordinates[i],
        p = fix.position;
      const cos = Math.cos((p[1] * Math.PI) / 180);
      const dx = (b[0] - a[0]) * cos,
        dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * cos * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)),
      );
      return (
        distance(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]) >
        Math.max(50, fix.accuracy)
      );
    });
  return (
    <section className="live-navigation">
      <p role="status">
        {error
          ? fil
            ? 'Hindi makuha ang GPS. Suriin ang pahintulot sa lokasyon.'
            : 'GPS unavailable. Check location permission.'
          : !fix
            ? fil
              ? 'Hinahanap ang lokasyon…'
              : 'Finding your live location…'
            : `${fil ? 'Live na GPS' : 'Live GPS'} · ±${Math.round(fix.accuracy)} m · ${Math.round(distance(fix.position, destination))} m ${fil ? 'mula sa silungan (tuwid na distansya)' : 'from shelter (straight-line distance)'}`}
      </p>
      {fix && fix.accuracy > 50 && (
        <p role="status">{fil ? 'Mahina ang katumpakan ng GPS.' : 'GPS accuracy is low.'}</p>
      )}
      {offRoute && (
        <p role="status">
          {fil
            ? 'Maaaring wala ka sa ruta. Awtomatikong susuriin ang ruta kapag sapat ang katumpakan ng GPS.'
            : 'You may be off-route. The route is rechecked automatically when GPS accuracy is sufficient.'}
        </p>
      )}
      {!confirm ? (
        <button className="secondary-button" onClick={() => setConfirm(true)}>
          {fil ? 'Nakarating na ako' : 'I’ve arrived'}
        </button>
      ) : (
        <div>
          <p>
            {fil
              ? 'Nakarating ka na ba sa silungan? Hihinto ang gabay. Hindi ito abiso sa CDRRMO o pag-update ng bilang sa silungan.'
              : 'Have you reached the shelter? This ends guidance. It does not notify CDRRMO or update shelter occupancy.'}
          </p>
          <button className="secondary-button" onClick={onArrive}>
            {fil ? 'Kumpirmahin ang pagdating' : 'Confirm arrival'}
          </button>{' '}
          <button className="secondary-button" onClick={() => setConfirm(false)}>
            {fil ? 'Magpatuloy' : 'Keep navigating'}
          </button>
        </div>
      )}
    </section>
  );
}
