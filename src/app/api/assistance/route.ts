import { assistanceInput } from '@/lib/validation';
import { configured, supabase } from '@/lib/supabase';
export async function POST(request: Request) {
  if (!configured()) return Response.json({error:'CDRRMO reporting is not connected.'}, {status:503});
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({error:'Request is too large.'}, {status:413});
    body = JSON.parse(raw);
  } catch { return Response.json({error:'Invalid request.'}, {status:400}); }
  const parsed = assistanceInput.safeParse(body);
  if (!parsed.success) return Response.json({error:'Confirm location sharing and check the request details.'}, {status:400});
  const {id, origin, source, details, contact} = parsed.data;
  try {
    const {data, error} = await supabase().rpc('submit_assistance_request', {
      request_id:id, lng:origin[0], lat:origin[1], source, message:details, contact_info:contact,
    });
    if (error || data !== id) throw new Error('Submission failed');
    return Response.json({id, received:true}, {headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({error:'Delivery could not be confirmed. Retry or contact local responders directly.'}, {status:503});
  }
}
