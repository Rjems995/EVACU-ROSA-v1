'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
export function useRouteAlert() {
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const toggle = useCallback(() => {
    setEnabled((previous) => !previous);
    if (!audio.current && 'AudioContext' in window) audio.current = new AudioContext();
    void audio.current?.resume().catch(() => {});
  }, []);
  const notify = useCallback(() => {
    if (!enabled) return;
    navigator.vibrate?.([150, 80, 150]);
    const context = audio.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }, [enabled]);
  return { enabled, toggle, notify };
}
