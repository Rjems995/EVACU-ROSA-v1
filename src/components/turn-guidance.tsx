'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '@/lib/types';
import type { LiveFix } from './live-navigation';
import { instruction, maneuvers, routeProgress } from '@/lib/navigation-guidance';
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
  const progress = fix ? routeProgress(route, fix.position) : null;
  const next = progress ? turns.find((m) => m.along >= progress.along - 10) : undefined;
  const remaining = next && progress ? Math.max(0, Math.round(next.along - progress.along)) : 0;
  const reliable = !!fix && fix.accuracy <= 30 && !!progress && progress.away <= 30;
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
  }, [route, language, reliable]);
  useEffect(() => {
    if (!enabled || !supported) return;
    const changed = !!alert && alert !== previousAlert.current;
    previousAlert.current = alert;
    if (!changed && (!reliable || !next || remaining > 100)) return;
    const key = changed
      ? `alert:${alert}`
      : `${next!.point.join(',')}:${next!.turn}:${remaining <= 20 ? 'near' : 'ahead'}`;
    if (!changed && spoken.current.has(key)) return;
    spoken.current.add(key);
    const text = changed
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
  }, [enabled, supported, reliable, next, remaining, alert, fil]);
  return (
    <section className="voice-directions">
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
          (!reliable
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
