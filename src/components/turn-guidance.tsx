'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '@/lib/types';
import type { LiveFix } from './live-navigation';
import { instruction, maneuvers, routeProgress, oppositeHeading } from '@/lib/navigation-guidance';
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  RotateCcw,
  Volume2,
  VolumeX,
  TriangleAlert,
} from 'lucide-react';
export default function TurnGuidance({
  route,
  fix,
  language,
  alert,
}: {
  route: Route;
  fix: LiveFix | null;
  language: string;
  alert: string;
}) {
  const [enabled, setEnabled] = useState(false),
    [supported, setSupported] = useState(false),
    [error, setError] = useState('');
  const spoken = useRef(new Set<string>()),
    previousAlert = useRef(alert);
  const fil = language === 'fil';
  const turns = useMemo(() => maneuvers(route), [route]);
  const routeKey = useMemo(() => JSON.stringify(route.coordinates), [route]);
  const match = useRef<{ key: string; along: number; timestamp: number; opposite: number } | null>(
    null,
  );
  const [wrongWay, setWrongWay] = useState(false);
  const progress = useMemo(
    () =>
      fix
        ? routeProgress(
            route,
            fix.position,
            match.current?.key === routeKey ? match.current.along : undefined,
          )
        : null,
    [fix, route, routeKey],
  );
  const next = progress ? turns.find((m) => m.along >= progress.along - 10) : undefined;
  const remaining = next && progress ? Math.max(0, Math.round(next.along - progress.along)) : 0;
  const reliable = !!fix && fix.accuracy <= 25 && !!progress && progress.away <= 25;
  useEffect(() => {
    if (!fix || !progress || !reliable) {
      setWrongWay(false);
      return;
    }
    const previous = match.current?.key === routeKey ? match.current : null;
    const timestamp = fix.timestamp ?? Date.now();
    if (previous?.timestamp === timestamp) return;
    const backwards = oppositeHeading(fix.heading, fix.speed, progress.bearing);
    const count = backwards ? (previous?.opposite || 0) + 1 : 0;
    setWrongWay(count >= 2);
    match.current = { key: routeKey, along: progress.along, timestamp, opposite: count };
  }, [fix, progress, reliable, routeKey]);
  const TurnIcon =
    next?.turn === 'arrive'
      ? Flag
      : next?.turn === 'uturn'
        ? RotateCcw
        : next?.turn.includes('left')
          ? CornerUpLeft
          : next?.turn.includes('right')
            ? CornerUpRight
            : ArrowUp;
  const leadDistance = Math.max(60, Math.min(180, (fix?.speed || 0) * 12));
  useEffect(() => {
    setSupported('speechSynthesis' in window);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    spoken.current.clear();
  }, [language]);
  useEffect(() => {
    window.speechSynthesis?.cancel();
  }, [routeKey, language, reliable, wrongWay]);
  useEffect(() => {
    if (!enabled || !supported) return;
    const changed = !!alert && alert !== previousAlert.current;
    previousAlert.current = alert;
    if (!changed && (!reliable || (!wrongWay && (!next || remaining > leadDistance)))) return;
    const key = wrongWay
      ? `wrong:${routeKey}`
      : changed
        ? `alert:${alert}`
        : `${next!.point.join(',')}:${next!.turn}:${remaining <= 20 ? 'near' : 'ahead'}`;
    if (!changed && spoken.current.has(key)) return;
    spoken.current.add(key);
    const text = wrongWay
      ? fil
        ? 'Maaaring kabaligtaran ang iyong direksyon. Huminto sa ligtas na lugar at suriin ang mapa.'
        : 'You may be heading the wrong way. Stop somewhere safe and check the map.'
      : changed
        ? alert
        : `${remaining > 20 ? (fil ? `Sa ${Math.round(remaining / 10) * 10} metro, ` : `In ${Math.round(remaining / 10) * 10} metres, `) : ''}${instruction(next!, fil)}`;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = fil ? 'fil-PH' : 'en-PH';
    speech.rate = 0.9;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => (fil ? /^(fil|tl)(-|$)/i.test(v.lang) : /^en(-|$)/i.test(v.lang)));
    if (voice) speech.voice = voice;
    speech.onerror = () =>
      setError(
        fil
          ? 'Hindi gumana ang boses. Sundin ang nakasulat na gabay.'
          : 'Voice failed. Follow the written guidance.',
      );
    window.speechSynthesis.speak(speech);
  }, [enabled, supported, reliable, next, remaining, alert, fil, wrongWay, routeKey, leadDistance]);
  return (
    <section className="voice-directions turn-guidance">
      <div className={`next-turn ${wrongWay ? 'next-turn-warning' : ''}`}>
        {wrongWay ? (
          <TriangleAlert size={36} aria-hidden="true" />
        ) : (
          <TurnIcon size={40} aria-hidden="true" />
        )}
        <div>
          <small>{fil ? 'SUSUNOD NA GABAY' : 'NEXT INSTRUCTION'}</small>
          <strong>
            {wrongWay
              ? fil
                ? 'Suriin ang direksyon'
                : 'Check your direction'
              : reliable && next
                ? `${remaining} m`
                : fil
                  ? 'Sinusuri ang GPS'
                  : 'Checking GPS'}
          </strong>
          <span>
            {wrongWay
              ? fil
                ? 'Huminto sa ligtas na lugar at suriin ang mapa.'
                : 'Stop somewhere safe and check the map.'
              : reliable && next
                ? instruction(next, fil)
                : fil
                  ? 'Hinihintay ang tumpak na lokasyon.'
                  : 'Waiting for an accurate location.'}
          </span>
        </div>
      </div>
      <button
        className="secondary-button"
        disabled={!supported}
        aria-pressed={enabled}
        onClick={() => {
          window.speechSynthesis.cancel();
          setError('');
          setEnabled(!enabled);
          spoken.current.clear();
        }}
      >
        {enabled ? (
          <VolumeX size={18} aria-hidden="true" />
        ) : (
          <Volume2 size={18} aria-hidden="true" />
        )}
        {enabled
          ? fil
            ? 'Patayin ang gabay sa boses'
            : 'Turn voice off'
          : fil
            ? 'Buksan ang gabay sa boses'
            : 'Enable turn-by-turn voice'}
      </button>
      <p role="status">
        {error ||
          (wrongWay
            ? fil
              ? 'Maaaring kabaligtaran ang iyong direksyon.'
              : 'You may be heading the wrong way.'
            : !reliable
              ? fil
                ? 'Naghihintay ng tumpak na GPS sa ruta.'
                : 'Waiting for accurate GPS on the route.'
              : next
                ? `${remaining} m · ${instruction(next, fil)}`
                : fil
                  ? 'Suriin ang pasukan ng silungan.'
                  : 'Check the shelter entrance.')}
      </p>
      <small>
        {fil
          ? 'Batay sa hugis ng ruta ang mga liko. Sundin ang karatula. Depende sa device ang Filipino at offline na boses.'
          : 'Turns follow route geometry. Follow posted signs. Filipino and offline voices depend on your device.'}
      </small>
    </section>
  );
}
