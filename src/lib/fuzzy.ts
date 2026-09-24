export type RiskInputs = { flood: number; fire: number; condition: number; exposure: number };
export type RiskResult = { score: number; label: 'Low risk' | 'Elevated risk' | 'High risk' };
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 1));
// Shoulder / triangle sets on [0, 1]. Inputs use 1 = worst.
export const membership = (value: number) => {
  const x = clamp(value);
  return {
    low: Math.max(0, 1 - x * 2),
    medium: Math.max(0, 1 - Math.abs(x - 0.5) * 2),
    high: Math.max(0, x * 2 - 1),
  };
};
export function fuzzyRisk(inputs: RiskInputs): RiskResult {
  const f = membership(inputs.flood),
    b = membership(inputs.fire);
  const r = membership(inputs.condition),
    e = membership(inputs.exposure);
  // Mamdani: AND=min, OR=max, implication=min, aggregation=max.
  const low = Math.min(f.low, b.low, r.low, e.low);
  const medium = Math.max(f.medium, b.medium, r.medium, e.medium);
  const high = Math.max(
    f.high,
    b.high,
    r.high,
    e.high,
    Math.min(f.medium, r.medium),
    Math.min(b.medium, e.medium),
  );
  let area = 0,
    moment = 0;
  for (let x = 0; x <= 100; x++) {
    const outputLow = Math.max(0, 1 - x / 35);
    const outputMedium = Math.max(0, 1 - Math.abs(x - 50) / 30);
    const outputHigh = Math.max(0, Math.min(1, (x - 60) / 40));
    const y = Math.max(
      Math.min(low, outputLow),
      Math.min(medium, outputMedium),
      Math.min(high, outputHigh),
    );
    area += y;
    moment += x * y;
  }
  const score = area ? moment / area : 100;
  return { score, label: score < 35 ? 'Low risk' : score < 70 ? 'Elevated risk' : 'High risk' };
}
