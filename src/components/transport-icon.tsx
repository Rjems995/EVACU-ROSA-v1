import { Bike, CarFront, Footprints } from 'lucide-react';
import type { TransportMode } from '@/lib/transport';

export default function TransportIcon({ mode }: { mode: TransportMode }) {
  if (mode === 'motorcycle')
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
        <path d="m19 17-4-11h-3M16 9h3M3 11h6l4 3-3 3H5l4-6M13 14l3-4" />
      </svg>
    );
  const Icon = { walking: Footprints, cycling: Bike, car: CarFront }[mode];
  return <Icon size={22} aria-hidden="true" />;
}
