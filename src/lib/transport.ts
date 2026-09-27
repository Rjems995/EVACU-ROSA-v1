export const transportModes = ['walking', 'cycling', 'motorcycle', 'car'] as const;
export type TransportMode = (typeof transportModes)[number];

// Planning estimates, not live traffic speeds. All modes retain reported closures.
export const transportProfiles = {
  walking: { label: 'Walking', metersPerMinute: 65 },
  cycling: { label: 'Cycling', metersPerMinute: 200 },
  motorcycle: { label: 'Motorcycle', metersPerMinute: 400 },
  car: { label: 'Car', metersPerMinute: 300 },
} satisfies Record<TransportMode, { label: string; metersPerMinute: number }>;
