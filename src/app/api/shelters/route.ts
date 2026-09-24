import { getSnapshot } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const s = await getSnapshot();
    return Response.json({ shelters: s.shelters, demo: s.demo, syncedAt: s.syncedAt });
  } catch {
    return Response.json({ error: 'Shelters are unavailable.' }, { status: 503 });
  }
}
