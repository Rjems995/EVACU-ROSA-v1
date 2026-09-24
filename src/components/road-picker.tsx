'use client';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { Road } from '@/lib/types';
const StreetMap = dynamic(() => import('./road-picker-map'), {
  ssr: false,
  loading: () => <p className="p-4">Loading street selection map…</p>,
});
export default function RoadPicker({
  roads,
  selectedId,
  onSelect,
  disabled = false,
}: {
  roads: Road[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const matches = useMemo(
    () =>
      roads.filter((r) =>
        `${r.name} ${r.barangay} ${r.id}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [roads, search],
  );
  const selected = roads.find((r) => r.id === selectedId);
  return (
    <section className="street-picker" aria-label="Select the affected street segment">
      <h3 className="text-lg font-bold">1. Select the affected street segment</h3>
      <p className="my-2">
        Tap a street on the map or search below. Only the highlighted segment will be reported.
      </p>
      <StreetMap roads={roads} selectedId={selectedId} onSelect={onSelect} disabled={disabled} />
      <label className="field">
        Search street name
        <input
          type="search"
          placeholder="For example, Tatlong Hari Street"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <fieldset disabled={disabled} className="street-picker-options">
        <legend className="sr-only">Matching street segments</legend>
        {matches.slice(0, 40).map((road) => (
          <label key={road.id} className="street-option">
            <input
              type="radio"
              name="affected-street"
              value={road.id}
              checked={selectedId === road.id}
              onChange={() => onSelect(road.id)}
            />
            <span>
              <strong>{road.name}</strong>
              <small>
                {road.source} → {road.target} · {road.barangay}
              </small>
            </span>
          </label>
        ))}
        {!matches.length && <p>No streets match this search.</p>}
      </fieldset>
      {matches.length > 40 && (
        <p className="text-sm my-2">
          Showing the first 40 of {matches.length} segments. Refine your search or select directly
          on the map.
        </p>
      )}
      <p className="selected-street" role="status">
        {selected
          ? `Selected: ${selected.name} · segment ${selected.source} → ${selected.target}`
          : 'No street selected yet.'}
      </p>
    </section>
  );
}
