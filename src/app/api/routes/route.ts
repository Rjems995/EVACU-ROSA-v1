import { getSnapshot } from '@/lib/data';
import { rankShelters } from '@/lib/routing';
import { routeInput } from '@/lib/validation';
export async function POST(request: Request) {
  let body;
  try {
    body = routeInput.safeParse(await request.json());
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!body.success)
    return Response.json(
      { error: 'A valid longitude and latitude are required.' },
      { status: 400 },
    );
  try {
    const s = await getSnapshot();
    return Response.json({
      routes: rankShelters(s, body.data.origin, body.data.accessibleOnly),
      demo: s.demo,
      syncedAt: s.syncedAt,
    });
  } catch {
    return Response.json(
      { error: 'Unable to compute routes from the latest data.' },
      { status: 503 },
    );
  }
}
