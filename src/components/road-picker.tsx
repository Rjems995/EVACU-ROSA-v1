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
  selectedIds,
  onSelectionChange,
}: {
  roads: Road[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
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
  const multiple = Boolean(onSelectionChange);
  const ids = selectedIds || [];
  function select(id: string) {
    if (!multiple) { onSelect(id); return; }
    if (!id) return;
    onSelectionChange!(ids.includes(id) ? ids.filter(value => value !== id) : ids.length < 100 ? [...ids,id] : ids);
  }
  return (
    <section className="street-picker" aria-label="Select the affected street segment">
      <h3 className="text-lg font-bold">1. Select the affected street{multiple ? ' segments' : ' segment'}</h3>
      <p className="my-2">
        {multiple ? 'Tap each affected street to add it. Tap again to remove it. All highlighted segments receive the same hazard type, severity, and details in one save (up to 100 streets).' : 'Tap the incident location to select the nearest street, or tap a street directly. Check the highlighted segment before publishing. Only that segment will be reported.'}
      </p>
      <StreetMap roads={roads} selectedId={selectedId} selectedIds={multiple ? ids : undefined} onSelect={select} disabled={disabled} />
      {multiple && <div className="my-3"><strong role="status">{ids.length} / 100 streets selected</strong>{' '}<button type="button" className="secondary-button" disabled={disabled || !ids.length} onClick={() => onSelectionChange!([])}>Clear selection</button></div>}
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
              type={multiple ? 'checkbox' : 'radio'}
              name="affected-street"
              value={road.id}
              checked={multiple ? ids.includes(road.id) : selectedId === road.id}
              disabled={multiple && ids.length >= 100 && !ids.includes(road.id)}
              onChange={() => select(road.id)}
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
        {multiple ? `${ids.length} street segments selected. Review the list below before publishing.` : selected
          ? `Selected: ${selected.name} · segment ${selected.source} → ${selected.target}`
          : 'No street selected yet.'}
      </p>
      {multiple && <ul className="street-picker-options" aria-label="Selected streets">{ids.map(id => <li key={id} className="street-option"><span>{roads.find(road => road.id === id)?.name || 'Street segment'} <small>{id.slice(0,8)}</small></span><button type="button" className="secondary-button" disabled={disabled} onClick={() => select(id)} aria-label={`Remove ${roads.find(road => road.id === id)?.name || 'street'} ${id.slice(0,8)}`}>Remove</button></li>)}</ul>}
    </section>
  );
}
