'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, LogOut, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { configured, supabase } from '@/lib/supabase';
import { demoSnapshot } from '@/lib/demo';
type RecordData = Record<string, unknown>;
type Resource =
  'evacuation_centers' | 'hazard_zones' | 'roads' | 'admin_accounts' | 'incident_logs';
const labels: Record<Resource, string> = {
  evacuation_centers: 'Shelters',
  hazard_zones: 'Hazards',
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
  hazard_zones: {
    name: '',
    barangay: '',
    hazard_type: 'flood',
    severity: 0.5,
    active: true,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [121.108, 14.296],
          [121.11, 14.296],
          [121.11, 14.298],
          [121.108, 14.298],
          [121.108, 14.296],
        ],
      ],
    },
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
  const [resource, setResource] = useState<Resource>('evacuation_centers'),
    [records, setRecords] = useState<RecordData[]>([]);
  const [draft, setDraft] = useState<RecordData | null>(null),
    [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(Boolean(db));
  const [deleteId, setDeleteId] = useState<string | null>(null);
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
      const s = demoSnapshot();
      setRecords(
        (resource === 'evacuation_centers'
          ? s.shelters
          : resource === 'hazard_zones'
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
    void load();
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
  function edit(record?: RecordData) {
    if (resource === 'incident_logs') return;
    const initial: RecordData = {
      ...defaults[resource],
      ...(record || {}),
      ...(role === 'barangay' ? { barangay } : {}),
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
            <h1 className="mt-3">Administrator sign-in</h1>
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
                <h1>Manage evacuation information</h1>
                <p>
                  {db
                    ? role === 'citywide'
                      ? 'Citywide / CDRRMO access'
                      : `Barangay access · ${barangay}`
                    : 'Preview the administration workspace'}
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
              <aside className="demo-banner">
                <ShieldCheck size={20} />
                <p>
                  <strong>Read-only demonstration.</strong> Add Supabase credentials and apply the
                  migrations to sign in and manage records.
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
              {token && resource !== 'incident_logs' && (
                <button className="secondary-button flex items-center gap-2" onClick={() => edit()}>
                  <Plus size={17} />
                  Add record
                </button>
              )}
            </div>
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
                  {editId ? 'Edit' : 'Add'}{' '}
                  {resource === 'admin_accounts' ? 'administrator' : 'record'}
                </h2>
                {resource === 'admin_accounts' && (
                  <p className="inline-warning">
                    Create the person’s Auth user in the Supabase dashboard first, then assign their
                    UUID and access role here.
                  </p>
                )}
                <div className="admin-form-grid">
                  {Object.entries(draft).map(([key, value]) => (
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
                            key !== 'amenities'
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
                  <button className="primary-button" disabled={busy}>
                    Save changes
                    <Check size={17} />
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {busy && !records.length ? (
              <p className="py-8">Loading records…</p>
            ) : (
              <section
                className="admin-grid mt-5 lg:gap-5 xl:gap-6"
                aria-label={`${labels[resource]} records`}
              >
                {records.map((r, i) => (
                  <article className="admin-record" key={String(r.id || r.user_id || i)}>
                    <h3>{String(r.name || r.user_id || `${r.action} · ${r.resource}`)}</h3>
                    <p>
                      {String(r.barangay || 'Citywide')}
                      {r.role ? ` · ${r.role}` : ''}
                    </p>
                    {resource === 'evacuation_centers' && (
                      <p>
                        {String(r.occupancy)} / {String(r.capacity)} occupied · {String(r.status)}
                      </p>
                    )}
                    {resource === 'hazard_zones' && (
                      <p>
                        {String(r.hazard_type)} · {Math.round(Number(r.severity) * 100)}% severity ·{' '}
                        {r.active ? 'Active' : 'Resolved'}
                      </p>
                    )}
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
                      token && (
                        <footer>
                          <button className="secondary-button" onClick={() => edit(r)}>
                            Edit record
                          </button>
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
            {!busy && !records.length && (
              <p className="empty-state">No records available for this account.</p>
            )}
          </>
        )}
      </main>
    </>
  );
}
