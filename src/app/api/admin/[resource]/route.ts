import { configured, supabase } from '@/lib/supabase';
import { schemas } from '@/lib/validation';
import { z } from 'zod';
type Context = { params: Promise<{ resource: string }> };
async function authenticate(request: Request, context: Context) {
  const { resource } = await context.params;
  if (!Object.hasOwn(schemas, resource) && resource !== 'incident_logs')
    return { response: Response.json({ error: 'Unknown resource.' }, { status: 404 }) };
  if (!configured())
    return {
      response: Response.json(
        { error: 'Connect Supabase to manage live records.' },
        { status: 503 },
      ),
    };
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token)
    return { response: Response.json({ error: 'Sign in to continue.' }, { status: 401 }) };
  const db = supabase(token);
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user)
    return {
      response: Response.json(
        { error: 'Your session has expired. Sign in again.' },
        { status: 401 },
      ),
    };
  const { data: account } = await db
    .from('admin_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (!account || (resource === 'admin_accounts' && account.role !== 'citywide'))
    return {
      response: Response.json({ error: 'This account does not have permission.' }, { status: 403 }),
    };
  return { db, resource, account };
}
export async function GET(request: Request, context: Context) {
  const auth = await authenticate(request, context);
  if (auth.response) return auth.response;
  let query = auth.db!.from(auth.resource!).select('*').limit(1000);
  if (auth.account!.role === 'barangay') query = query.eq('barangay', auth.account!.barangay);
  if (auth.resource === 'incident_logs') query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  return error
    ? Response.json({ error: 'Records could not be loaded.' }, { status: 500 })
    : Response.json(data);
}
async function mutate(request: Request, context: Context, method: 'POST' | 'PATCH' | 'DELETE') {
  const auth = await authenticate(request, context);
  if (auth.response) return auth.response;
  const { db, resource, account } = auth;
  if (resource === 'road_hazards' && account!.role !== 'citywide')
    return Response.json({ error: 'Only CDRRMO / citywide administrators can publish street hazard reports.' }, { status: 403 });
  if (resource === 'incident_logs')
    return Response.json({ error: 'History is append-only.' }, { status: 405 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const id = new URL(request.url).searchParams.get('id');
  if (method !== 'POST' && !z.uuid().safeParse(id).success)
    return Response.json({ error: 'A valid record ID is required.' }, { status: 400 });
  const key = resource === 'admin_accounts' ? 'user_id' : 'id';
  if (resource === 'admin_accounts' && id === account!.user_id)
    return Response.json(
      { error: 'Ask another city administrator to change your own access.' },
      { status: 403 },
    );
  let query;
  if (method === 'DELETE') query = db!.from(resource!).delete().eq(key, id!).select();
  else {
    const parsed = schemas[resource as keyof typeof schemas].safeParse(body);
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join(' ') },
        { status: 400 },
      );
    if (
      resource === 'admin_accounts' &&
      (parsed.data as { user_id: string }).user_id === account!.user_id
    )
      return Response.json(
        { error: 'You cannot modify your own administrator access.' },
        { status: 403 },
      );
    if (
      account!.role === 'barangay' &&
      (parsed.data as { barangay: string }).barangay !== account!.barangay
    )
      return Response.json(
        { error: 'You can only manage records in your assigned barangay.' },
        { status: 403 },
      );
    const payload: Record<string, unknown> =
      'geometry' in parsed.data
        ? ({ ...parsed.data, geom: parsed.data.geometry } as Record<string, unknown>)
        : { ...parsed.data };
    delete (payload as Record<string, unknown>).geometry;
    if (resource === 'road_hazards') {
      const { data: road, error: roadError } = await db!.from('roads').select('id').eq('id', payload.road_id).single();
      if (roadError || !road) return Response.json({ error: 'Select an existing street segment.' }, { status: 400 });
    }
    query =
      method === 'POST'
        ? db!.from(resource!).insert(payload).select()
        : db!.from(resource!).update(payload).eq(key, id!).select();
  }
  const { data, error } = await query;
  if (error?.code === '23505' && resource === 'road_hazards') return Response.json({ error: 'An active report for this hazard already exists on this segment. Edit or clear that report first.' }, { status: 409 });
  if (error)
    return Response.json(
      { error: 'Change rejected. Check permissions, geometry, and field values.' },
      { status: 400 },
    );
  if (!data?.length)
    return Response.json(
      { error: 'Record not found or outside your permitted barangay.' },
      { status: 404 },
    );
  return Response.json(data, { status: method === 'POST' ? 201 : 200 });
}
export const POST = (r: Request, c: Context) => mutate(r, c, 'POST');
export const PATCH = (r: Request, c: Context) => mutate(r, c, 'PATCH');
export const DELETE = (r: Request, c: Context) => mutate(r, c, 'DELETE');
