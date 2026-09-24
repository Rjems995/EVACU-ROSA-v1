import { getSnapshot } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await getSnapshot(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { error: 'City data is unavailable. Previously saved data may still be available offline.' },
      { status: 503 },
    );
  }
}
