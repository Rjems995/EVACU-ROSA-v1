'use client';
import { useEffect, useState } from 'react';
import type { RankedShelter, Snapshot } from '@/lib/types';
import type { TransportMode } from '@/lib/transport';
import { offlineRouteHTML } from '@/lib/offline-route';
import { readRouteDownload, saveRouteDownload } from '@/lib/offline';
export default function OfflineDownload({
  selected,
  snapshot,
  mode,
  language,
}: {
  selected?: RankedShelter;
  snapshot: Snapshot | null;
  mode: TransportMode;
  language: string;
}) {
  const [saved, setSaved] = useState<{ html: string; savedAt: string }>(),
    [message, setMessage] = useState('');
  const fil = language === 'fil';
  useEffect(() => {
    void readRouteDownload()
      .then(setSaved)
      .catch(() => {});
  }, []);
  function download(html: string) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evacu-rosa-offline-route.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function save() {
    if (!selected || !snapshot) return;
    const savedAt = new Date().toISOString(),
      html = offlineRouteHTML(selected, snapshot, mode, fil, savedAt);
    download(html);
    try {
      await saveRouteDownload(html, savedAt);
      setSaved({ html, savedAt });
      setMessage(
        fil
          ? 'Na-download at na-save sa device ang gabay.'
          : 'Route downloaded and saved on this device.',
      );
    } catch {
      setMessage(
        fil
          ? 'Na-download ang file ngunit hindi na-save sa browser.'
          : 'File downloaded, but browser storage was unavailable.',
      );
    }
  }
  if (!selected && !saved) return null;
  return (
    <section className="offline-download">
      {selected && (
        <button className="secondary-button" onClick={() => void save()}>
          {fil ? 'I-download ang offline na ruta' : 'Download offline route'}
        </button>
      )}
      {saved && (
        <button className="text-button" onClick={() => download(saved.html)}>
          {fil ? 'I-download muli ang na-save na ruta' : 'Download saved route again'}
        </button>
      )}
      <small>
        {fil
          ? 'Kasama ang direksyon at balangkas ng ruta; walang offline na street tiles. Buksan ang HTML file kahit walang internet.'
          : 'Includes directions and a route outline, not offline street tiles. Open the HTML file without internet.'}
        {saved && ` ${new Date(saved.savedAt).toLocaleString()}`}
      </small>
      <p role="status">{message}</p>
    </section>
  );
}
