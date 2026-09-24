'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, LogOut, Plus, ShieldCheck, Trash2, Waves, Flame, Mountain } from 'lucide-react';
import { configured, supabase } from '@/lib/supabase';
import RoadPicker from '@/components/road-picker';
import type { Road, Snapshot } from '@/lib/types';
type RecordData = Record<string, unknown>;
type Resource =
  'evacuation_centers' | 'road_hazards' | 'roads' | 'admin_accounts' | 'incident_logs';
const labels: Record<Resource, string> = {
  evacuation_centers: 'Shelters',
  road_hazards: 'Street hazards',
  roads: 'Road conditions',
  admin_accounts: 'Administrators',
  incident_logs: 'Change history',
};
const defaults: Record<Exclude<Resource, 'incident_logs'>, RecordData> = {
  evacuation_centers: {
    name: '',
    barangay: '',
    capacity: 200,
    occupancy: 0,
    status: 'open',
    accessible: false,
    amenities: ['Drinking water', 'Toilets'],
    geometry: { type: 'Point', coordinates: [121.109, 14.297] },
  },
  road_hazards: {
    road_id: '',
    hazard_type: 'flood',
    severity: 0.5,
    blocked: true,
    active: true,
    notes: '',
  },
  roads: {
    name: '',
    barangay: '',
    source: '',
    target: '',
    base_cost: 0,
    condition: 0,
    blocked: false,
    oneway: false,
    geometry: {
      type: 'LineString',
      coordinates: [
        [121.109, 14.297],
        [121.11, 14.297],
      ],
    },
  },
  admin_accounts: { user_id: '', role: 'barangay', barangay: '' },
};
const fieldLabels: Record<string, string> = {
  name: 'Name',
  barangay: 'Barangay',
  capacity: 'Maximum capacity',
  occupancy: 'Current occupancy',
  status: 'Shelter status',
  accessible: 'Step-free entrance',
  amenities: 'Facilities (comma separated)',
  hazard_type: 'Hazard type',
  severity: 'Severity (0–1)',
  active: 'Active hazard',
  source: 'Start node ID',
  target: 'End node ID',
  base_cost: 'Base cost (metres, 0 uses measured length)',
  condition: 'Road degradation (0–1)',
  blocked: 'Road blocked',
  oneway: 'One-way road',
  user_id: 'Existing Supabase Auth user UUID',
  role: 'Access role',
  geometry: 'GeoJSON geometry (longitude, latitude)',
  notes: 'CDRRMO report details (optional)',
};
const choices: Record<string, string[]> = {
  status: ['open', 'closed'],
  hazard_type: ['flood', 'fire', 'earthquake'],
  role: ['barangay', 'citywide'],
};
export default function AdminPage() {
  const db = useMemo(() => (configured() ? supabase() : null), []);
  const [token, setToken] = useState(''),
    [role, setRole] = useState(''),
    [barangay, setBarangay] = useState('');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [resource, setResource] = useState<Resource>('road_hazards'),
    [records, setRecords] = useState<RecordData[]>([]);
  const [draft, setDraft] = useState<RecordData | null>(null),
    [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(Boolean(db));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [roads, setRoads] = useState<Road[]>([]);
  const [reportFilter, setReportFilter] = useState('active');
  const [reportSearch, setReportSearch] = useState('');
  useEffect(() => {
    if (!db) return;
    const apply = async (accessToken: string, userId: string) => {
      const { data, error } = await db
        .from('admin_accounts')
        .select('role,barangay')
        .eq('user_id', userId)
        .single();
      if (error || !data) {
        setToken('');
        setRole('');
        setMessage('This account has no administrator access. Contact a city administrator.');
      } else {
        setToken(accessToken);
        setRole(data.role);
        setBarangay(data.barangay || '');
        setMessage('');
      }
      setChecking(false);
    };
    void db.auth.getSession().then(({ data: { session } }) => {
      if (session) void apply(session.access_token, session.user.id);
      else setChecking(false);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) => {
      if (session) setTimeout(() => void apply(session.access_token, session.user.id), 0);
      else {
        setToken('');
        setRole('');
        setChecking(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [db]);
  const load = useCallback(async () => {
    if (!db) {
      const response = await fetch('/api/snapshot');
      if (!response.ok) { setMessage('Street data could not be loaded.'); return; }
      const s: Snapshot = await response.json();
      setRoads(s.roads);
      setRecords(
        (resource === 'evacuation_centers'
          ? s.shelters
          : resource === 'road_hazards'
            ? s.hazards
            : resource === 'roads'
              ? s.roads
              : []) as unknown as RecordData[],
      );
      return;
    }
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/${resource}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRecords(json);
      if (resource === 'road_hazards') {
        const response = await fetch('/api/snapshot', { cache: 'no-store' });
        if (!response.ok) throw new Error('Street list unavailable. Refresh before reporting.');
        const snapshot: Snapshot = await response.json();
        setRoads(snapshot.roads);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to load records.');
    } finally {
      setBusy(false);
    }
  }, [db, token, resource]);
  useEffect(() => {
    setDraft(null);
    setDeleteId(null);
    setRecords([]);
    void load().catch(() => setMessage('Street data could not be loaded. Please retry.'));
  }, [load]);
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) setMessage('Sign-in failed. Check your email and password.');
      setPassword('');
    } catch {
      setMessage('Unable to reach the sign-in service. Try again.');
    } finally {
      setBusy(false);
    }
  }
  function edit(record?: RecordData, changes: RecordData = {}) {
    if (resource === 'incident_logs') return;
    const initial: RecordData = {
      ...defaults[resource],
      ...(record || {}),
      ...(role === 'barangay' ? { barangay } : {}),
      ...changes,
    };
    const clean: RecordData = {};
    for (const key of Object.keys(defaults[resource]))
      clean[key] =
        key === 'geometry'
          ? JSON.stringify(record?.geom || initial.geometry, null, 2)
          : key === 'amenities'
            ? (initial[key] as string[]).join(', ')
            : (initial[key] ?? '');
    setDraft(clean);
    setEditId(record ? String(record[resource === 'admin_accounts' ? 'user_id' : 'id']) : null);
    setMessage('');
    setTimeout(
      () =>
        document
          .getElementById('record-editor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !token) return;
    setBusy(true);
    setMessage('');
    try {
      const payload = { ...draft };
      if (resource === 'road_hazards' && !payload.road_id) throw new Error('Select the affected street segment first.');
      if ('geometry' in payload) payload.geometry = JSON.parse(String(payload.geometry));
      if ('amenities' in payload)
        payload.amenities = String(payload.amenities)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      if (resource === 'admin_accounts' && payload.role === 'citywide' && !payload.barangay)
        payload.barangay = null;
      const res = await fetch(
        `/api/admin/${resource}${editId ? `?id=${encodeURIComponent(editId)}` : ''}`,
        {
          method: editId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDraft(null);
      setMessage('Record saved. Public data will refresh within one minute.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleteId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/${resource}?id=${encodeURIComponent(deleteId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDeleteId(null);
      setMessage('Record deleted.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to delete.');
    } finally {
      setBusy(false);
    }
  }
  const tabs = (Object.keys(labels) as Resource[]).filter(
    (r) => r !== 'admin_accounts' || role === 'citywide',
  );
  const displayed = resource === 'road_hazards' ? records.filter((record) =>
    (reportFilter === 'all' || Boolean(record.active) === (reportFilter === 'active')) &&
    `${roads.find(road => road.id === record.road_id)?.name || record.name || ''} ${record.hazard_type} ${record.notes || ''}`.toLowerCase().includes(reportSearch.toLowerCase())
  ) : records;
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <ShieldCheck size={26} />
          </span>
          <span>
            EVACU<span className="brand-accent">-ROSA</span>
            <small>OPERATIONS CENTER</small>
          </span>
        </Link>
        <Link className="ml-auto inline-flex min-h-11 items-center gap-2 text-sm" href="/">
          <ArrowLeft size={16} />
          Public map
        </Link>
      </header>
      <main id="main" className="admin-main">
        {checking ? (
          <p>Checking administrator access…</p>
        ) : db && !token ? (
          <form onSubmit={signIn} className="admin-login">
            <ShieldCheck size={32} />
            <h1 className="mt-3">CDRRMO sign-in</h1>
            <p>Manage local shelter capacity, hazard reports, and road conditions.</p>
            <label className="field">
              Email
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              Password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {message && (
              <p role="alert" className="inline-warning">
                {message}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in securely'}
              <ShieldCheck size={18} />
            </button>
            <p className="text-sm">
              Accounts are provisioned by a city administrator. Public registration is disabled in
              this interface.
            </p>
          </form>
        ) : (
          <>
            <section className="admin-header">
              <div>
                <p className="eyebrow">LOCAL RESPONSE OPERATIONS</p>
                <h1>CDRRMO operations panel</h1>
                <p>
                  {db
                    ? role === 'citywide'
                      ? 'Citywide / CDRRMO access'
                      : `Barangay access · ${barangay}`
                    : 'Santa Rosa street reporting'}
                </p>
              </div>
              {token && (
                <button
                  className="secondary-button flex items-center gap-2"
                  onClick={() => void db?.auth.signOut()}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              )}
            </section>
            {!db && (
              <aside className="offline-banner">
                <ShieldCheck size={20} />
                <p>
                  <strong>Database connection required.</strong> You can select a street and prepare a report here. Publishing and administrator sign-in become available after Supabase is connected. Unsaved reports are not stored.
                </p>
              </aside>
            )}
            <nav className="admin-tabs" aria-label="Data management">
              {tabs.map((r) => (
                <button
                  className="secondary-button"
                  key={r}
                  aria-current={resource === r ? 'page' : undefined}
                  onClick={() => setResource(r)}
                >
                  {labels[r]}
                </button>
              ))}
            </nav>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold">
                {labels[resource]}{' '}
                <span className="text-sm font-normal">
                  ({records.length}
                  {records.length === 1000 ? ' — first 1,000 records' : ''})
                </span>
              </h2>
              {token && resource !== 'incident_logs' && (resource !== 'road_hazards' || role === 'citywide') && (
                <button className="secondary-button flex items-center gap-2" onClick={() => edit()}>
                  <Plus size={17} />
                  {resource === 'road_hazards' ? 'Report street hazard' : 'Add record'}
                </button>
              )}
              {!db && resource === 'road_hazards' && <button className="secondary-button" onClick={() => edit()}>Prepare street report</button>}
            </div>
            {resource === 'road_hazards' && <>
              <div className="cdrrmo-report-actions" aria-label="Report a street hazard">
                {([{type: 'flood', label: 'Report flooding', Icon: Waves}, {type: 'fire', label: 'Report fire', Icon: Flame}, {type: 'earthquake', label: 'Report earthquake damage', Icon: Mountain}] as const).map(({type, label, Icon}) =>
                  <button key={type} className="secondary-button" disabled={busy || Boolean(db && role !== 'citywide')} onClick={() => edit(undefined, {hazard_type: type})}><Icon size={24} /><strong>{label}</strong><span>Select the affected street</span></button>
                )}
              </div>
              <div className="admin-form-grid">
                <label className="field">Search reports<input type="search" placeholder="Street, hazard, or report details" value={reportSearch} onChange={event => setReportSearch(event.target.value)} /></label>
                <label className="field">Report status<select value={reportFilter} onChange={event => setReportFilter(event.target.value)}><option value="active">Active reports</option><option value="cleared">Cleared reports</option><option value="all">All reports</option></select></label>
              </div>
            </>}
            {resource === 'road_hazards' && <p className="my-3">CDRRMO selects the affected street segment and marks it blocked or affected. Clearing a report removes that hazard from routing; other active reports still apply.</p>}
            {message && (
              <p role="status" className="inline-warning">
                {message}
              </p>
            )}
            {deleteId && (
              <section role="alert" className="admin-editor">
                <h2>Delete this record?</h2>
                <p className="my-3">
                  This removes it from current public data. Recorded history is retained.
                </p>
                <div className="admin-actions">
                  <button
                    className="secondary-button danger-button"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    Delete record
                  </button>
                  <button className="secondary-button" onClick={() => setDeleteId(null)}>
                    Cancel
                  </button>
                </div>
              </section>
            )}
            {draft && (
              <form id="record-editor" onSubmit={save} className="admin-editor">
                <h2 className="text-xl font-bold">
                  {resource === 'road_hazards' ? `${editId ? 'Update' : 'New'} ${draft.hazard_type} report` : `${editId ? 'Edit' : 'Add'} ${resource === 'admin_accounts' ? 'administrator' : 'record'}`}
                </h2>
                {resource === 'admin_accounts' && (
                  <p className="inline-warning">
                    Create the person’s Auth user in the Supabase dashboard first, then assign their
                    UUID and access role here.
                  </p>
                )}
                {resource === 'road_hazards' && <>
                  <RoadPicker roads={roads} selectedId={String(draft.road_id)} onSelect={id => setDraft({ ...draft, road_id: id })} />
                  <h3 className="mt-5 text-lg font-bold">2. Describe the street condition</h3>
                  <p className="my-2">A blocked segment is excluded from routes. Severity of 85% or higher also excludes it, even if “Road blocked” is set to No.</p>
                </>}
                <div className="admin-form-grid">
                  {Object.entries(draft).filter(([key]) => key !== 'road_id').map(([key, value]) => (
                    <label className={`field ${key === 'geometry' ? 'wide' : ''}`} key={key}>
                      {fieldLabels[key] || key}
                      {key === 'geometry' ? (
                        <textarea
                          required
                          rows={7}
                          value={String(value)}
                          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        />
                      ) : typeof value === 'boolean' ? (
                        <select
                          value={String(value)}
                          onChange={(e) => setDraft({ ...draft, [key]: e.target.value === 'true' })}
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : choices[key] ? (
                        <select
                          value={String(value)}
                          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        >
                          {choices[key].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          required={
                            !(key === 'barangay' && draft.role === 'citywide') &&
                            key !== 'amenities' && key !== 'notes'
                          }
                          type={typeof value === 'number' ? 'number' : 'text'}
                          step={['severity', 'condition'].includes(key) ? 0.01 : 'any'}
                          min={typeof value === 'number' ? 0 : undefined}
                          max={['severity', 'condition'].includes(key) ? 1 : undefined}
                          readOnly={
                            (key === 'barangay' && role === 'barangay') ||
                            (key === 'user_id' && Boolean(editId))
                          }
                          value={String(value)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [key]:
                                typeof value === 'number' ? Number(e.target.value) : e.target.value,
                            })
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
                <div className="admin-actions">
                  <button className="primary-button" disabled={busy || !token}>
                    {resource === 'road_hazards' ? draft.active ? editId ? 'Update report' : 'Publish report' : 'Save cleared report' : 'Save changes'}
                    <Check size={17} />
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                </div>
                {!token && <p className="inline-warning">Connect the database and sign in with CDRRMO / citywide access to publish this report for all users.</p>}
              </form>
            )}
            {busy && !records.length ? (
              <p className="py-8">Loading records…</p>
            ) : (
              <section
                className="admin-grid mt-5 lg:gap-5 xl:gap-6"
                aria-label={`${labels[resource]} records`}
              >
                {displayed.slice(0, 100).map((r, i) => (
                  <article className="admin-record" key={String(r.id || r.user_id || i)}>
                    <h3>{String(r.name || (resource === 'road_hazards' ? roads.find(road => road.id === r.road_id)?.name || 'Street segment' : r.user_id || `${r.action} · ${r.resource}`))}</h3>
                    <p>
                      {String(r.barangay || 'Citywide')}
                      {r.role ? ` · ${r.role}` : ''}
                    </p>
                    {resource === 'evacuation_centers' && (
                      <p>
                        {String(r.occupancy)} / {String(r.capacity)} occupied · {String(r.status)}
                      </p>
                    )}
                    {resource === 'road_hazards' && (
                      <p>
                        {String(r.hazard_type)} · {Math.round(Number(r.severity) * 100)}% severity ·{' '}
                        {r.active ? r.blocked || Number(r.severity) >= .85 ? 'Blocked' : 'Affected' : 'Cleared'}
                      </p>
                    )}
                    {resource === 'road_hazards' && <p>{String(r.notes || '')}</p>}
                    {resource === 'roads' && (
                      <p>
                        {r.blocked ? 'Blocked' : 'Passable'} ·{' '}
                        {Math.round(Number(r.condition) * 100)}% degradation · {String(r.source)} →{' '}
                        {String(r.target)}
                      </p>
                    )}
                    {resource === 'incident_logs' ? (
                      <details>
                        <summary className="min-h-11 cursor-pointer">
                          View change · {new Date(String(r.created_at)).toLocaleString()}
                        </summary>
                        <pre>
                          {JSON.stringify(
                            { before: r.before_record, after: r.after_record },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ) : (
                      token && (resource !== 'road_hazards' || role === 'citywide') && (
                        <footer>
                          <button className="secondary-button" onClick={() => edit(r)}>
                            Edit record
                          </button>
                          {resource === 'road_hazards' && Boolean(r.active) && <button className="secondary-button" onClick={() => edit(r, {active: false})}>Mark as cleared</button>}
                          <button
                            className="secondary-button danger-button flex items-center gap-2"
                            onClick={() =>
                              setDeleteId(
                                String(r[resource === 'admin_accounts' ? 'user_id' : 'id']),
                              )
                            }
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </footer>
                      )
                    )}
                  </article>
                ))}
              </section>
            )}
            {displayed.length > 100 && <p>Showing the first 100 matches. Refine your search to find a report.</p>}
            {!busy && !displayed.length && (
              <p className="empty-state">{resource === 'road_hazards' ? 'No matching reports. Select a hazard above to report an affected street.' : 'No records available for this account.'}</p>
            )}
          </>
        )}
      </main>
    </>
  );
}
