'use client';
import { useCallback, useEffect, useState } from 'react';
type RequestRecord = {id:string; longitude:number; latitude:number; location_source:string; details:string; contact:string; status:'new'|'acknowledged'|'resolved'; created_at:string};
export default function AssistanceInbox({token}: {token:string}) {
  const [records, setRecords] = useState<RequestRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/admin/assistance_requests', {headers:{Authorization:`Bearer ${token}`}, cache:'no-store', signal});
      if (!response.ok) throw new Error('Assistance alerts could not be refreshed. Check the connection and database migration 003.');
      const data = await response.json();
      if (!signal?.aborted) { setRecords(data); setError(''); setUpdated(new Date().toLocaleTimeString()); }
    } catch(error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : 'Unable to load alerts.'); }
  }, [token]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 15000);
    return () => {controller.abort(); clearInterval(timer);};
  }, [load]);
  async function update(id:string, status:RequestRecord['status']) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/assistance_requests?id=${id}`, {method:'PATCH', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:JSON.stringify({status})});
      if (!response.ok) throw new Error('Status was not saved. Please retry.');
      await load();
    } catch(error) { setError(error instanceof Error ? error.message : 'Unable to save status.'); }
    finally {setBusy(false);}
  }
  const pending = records.filter(record => record.status !== 'resolved');
  return <section className="admin-editor" aria-label="Assistance alerts">
    <h2 className="text-xl font-bold">People requesting assistance</h2>
    <p role="status">{records.filter(record => record.status === 'new').length} new alerts · {pending.length} unresolved requests</p>
    <p className="text-sm">Checks every 15 seconds while this panel is open. These are user requests, not verified entrapment reports. {updated && `Last checked ${updated}.`}</p>
    <button className="secondary-button my-2" onClick={() => void load()}>Refresh assistance alerts</button>
    {error && <p role="alert" className="inline-warning">{error}</p>}
    <div className="admin-grid">{pending.map(record => <article key={record.id} className="admin-record">
      <h3>{record.status === 'new' ? 'New assistance request' : 'Acknowledged request'}</h3>
      <p>{new Date(record.created_at).toLocaleString()}</p>
      <p>{record.location_source === 'gps' ? 'Device location' : 'Manually selected location'}: {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}</p>
      <a className="text-button" href={`https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=18/${record.latitude}/${record.longitude}`} target="_blank" rel="noopener noreferrer">View location on map</a>
      <p>{record.contact || 'No contact information supplied'}</p><p>{record.details || 'No additional details supplied'}</p>
      <footer>{record.status === 'new' && <button className="secondary-button" disabled={busy} onClick={() => void update(record.id,'acknowledged')}>Acknowledge</button>}
      {record.status === 'acknowledged' && <button className="secondary-button" disabled={busy} onClick={() => void update(record.id,'resolved')}>Mark resolved</button>}</footer>
    </article>)}</div>
    {!pending.length && !error && updated && <p>No unresolved assistance requests.</p>}
  </section>;
}
