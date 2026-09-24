import { getSnapshot } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const s = await getSnapshot();
    return Response.json({ hazards: s.hazards, demo: s.demo, syncedAt: s.syncedAt });
  } catch {
    return Response.json({ error: 'Hazards are unavailable.' }, { status: 503 });
  }
}
