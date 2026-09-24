'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  Footprints,
  House,
  Info,
  Layers,
  LocateFixed,
  MapPin,
  Moon,
  Mountain,
  Navigation,
  Phone,
  RefreshCw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Users,
  Waves,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { DEMO_ORIGIN } from '@/lib/constants';
import { rankShelters, segmentRisk, shelterStatus } from '@/lib/routing';
import { useSnapshot } from '@/lib/use-snapshot';
import type { HazardType, Position, RankedShelter, Shelter } from '@/lib/types';
const Map = dynamic(() => import('./map'), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Navigation size={30} />
      <p>Loading your local map…</p>
    </div>
  ),
});
const hazardIcons = { flood: Waves, fire: Flame, earthquake: Mountain };
export default function PublicApp() {
  const { snapshot, offline, cached, loading, error, storageError, sync } = useSnapshot();
  const [origin, setOrigin] = useState<Position | null>(null),
    [locationName, setLocationName] = useState('Choose your starting point');
  const [picking, setPicking] = useState(false),
    [locating, setLocating] = useState(false),
    [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null),
    [requested, setRequested] = useState(false);
  const [visible, setVisible] = useState<HazardType[]>(['flood', 'fire', 'earthquake']),
    [boundaries, setBoundaries] = useState(false);
  const [dark, setDark] = useState(false),
    [accessible, setAccessible] = useState(false),
    [query, setQuery] = useState('');
  const [tab, setTab] = useState<'shelters' | 'alerts'>('shelters'),
    [help, setHelp] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const locationRequest = useRef(0);
  useEffect(() => {
    try {
      setDark(localStorage.getItem('evacu-theme') === 'dark');
    } catch {}
    const t = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('evacu-theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  const ranked = useMemo(
    () => (snapshot && origin ? rankShelters(snapshot, origin, accessible) : []),
    [snapshot, origin, accessible],
  );
  const activeRoute = requested
    ? ranked.find((r) => r.shelter.id === selected) || ranked[0]
    : undefined;
  const shelterList = useMemo(() => {
    if (!snapshot) return [];
    const list = origin
      ? ranked.map((r) => r.shelter)
      : snapshot.shelters.filter((s) => !accessible || s.accessible);
    return list.filter((s) =>
      `${s.name} ${s.barangay}`.toLowerCase().includes(query.toLowerCase()),
    );
  }, [snapshot, origin, ranked, accessible, query]);
  const activeHazards = snapshot?.hazards.filter((h) => h.active) || [];
  const freeSpaces =
    snapshot?.shelters
      .filter((s) => s.status === 'open')
      .reduce((n, s) => n + Math.max(0, s.capacity - s.occupancy), 0) || 0;
  const age = snapshot
    ? Math.max(0, Math.floor((clock - new Date(snapshot.syncedAt).getTime()) / 60000))
    : 0;
  const choose = useCallback((p: Position, name = 'Selected map location') => {
    locationRequest.current++;
    setLocating(false);
    setOrigin(p);
    setLocationName(name);
    setPicking(false);
    setNotice('');
    setRequested(false);
    setSelected(null);
  }, []);
  const locate = useCallback(() => {
    const request = ++locationRequest.current;
    if (!window.isSecureContext) {
      setNotice(
        'Automatic location needs HTTPS or localhost. You can still choose your starting point manually.',
      );
      return;
    }
    if (!navigator.geolocation) {
      setNotice('Location is unavailable. Choose a point on the map instead.');
      return;
    }
    setLocating(true);
    setNotice('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (request !== locationRequest.current) return;
        choose([p.coords.longitude, p.coords.latitude], 'Your current location');
        setLocating(false);
      },
      () => {
        if (request !== locationRequest.current) return;
        setNotice(
          'Location permission was denied or a position could not be found. Choose a point on the map.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, [choose]);
  useEffect(() => {
    locate();
    return () => {
      locationRequest.current++;
    };
  }, [locate]);
  function findShelter() {
    if (!origin) {
      setPicking(true);
      setNotice('Select your starting point on the map, or use your current location.');
      return;
    }
    setRequested(true);
    setSelected(ranked[0]?.shelter.id || null);
    if (!ranked.length)
      setNotice(
        'No reachable shelter was found in this road network. Try another starting point or contact local responders.',
      );
    else setNotice('');
  }
  function selectShelter(id: string) {
    setTab('shelters');
    if (!origin) {
      setNotice('Choose your starting point to calculate a route to this shelter.');
      setSelected(id);
      return;
    }
    if (!ranked.some((r) => r.shelter.id === id)) {
      setNotice(
        'This shelter is full, closed, exposed to a severe hazard, or has no reachable route.',
      );
      return;
    }
    setSelected(id);
    setRequested(true);
    setNotice('');
  }
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="EVACU-ROSA home">
          <span className="brand-symbol">
            <ShieldCheck size={27} />
          </span>
          <span>
            EVACU<span className="brand-accent">-ROSA</span>
            <small>SANTA ROSA CITY · LAGUNA</small>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          <a href="#main" className="nav-active">
            <Navigation size={17} />
            Evacuation map
          </a>
          <button
            onClick={() => {
              setTab('shelters');
              document
                .getElementById('shelter-list')
                ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
          >
            <House size={17} />
            Shelters
          </button>
          <button onClick={() => setHelp(true)}>
            <Info size={17} />
            How it works
          </button>
        </nav>
        <div className="header-actions">
          <span className="city-chip">
            <MapPin size={14} /> Santa Rosa, PH
          </span>
          <button
            className="icon-button"
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <Link href="/admin" className="admin-link">
            Admin <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <div className="system-bar">
        <span>
          <span className="status-dot" />
          {snapshot?.demo ? 'DEMONSTRATION MODE' : 'EVACUATION SUPPORT'}
          <span className="system-divider">/</span>
          <span className="system-message">Prepared together. Safer together.</span>
        </span>
        <span>
          {offline ? <WifiOff size={14} /> : <Wifi size={14} />}{' '}
          {offline
            ? 'Offline'
            : cached
              ? 'Saved data'
              : snapshot?.demo
                ? 'Sample data'
                : 'Connected'}
        </span>
      </div>
      <main id="main" className="app-main">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">YOUR WAY TO SAFETY</p>
            <h1 id="page-title">
              A safer route starts here<span>.</span>
            </h1>
            <p>Find an available shelter and a route that considers the hazards around you.</p>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <Phone size={17} /> Emergency help <ChevronRight size={16} />
          </button>
        </section>
        {snapshot?.demo && (
          <aside className="demo-banner">
            <Info size={18} />
            <p>
              <strong>Demonstration only.</strong> Streets follow OpenStreetMap. Shelter sites and
              incident reports are fictional. Do not use sample routes for evacuation.
            </p>
            <span className="demo-label">SAMPLE DATA</span>
          </aside>
        )}
        {(offline || cached || (!snapshot?.demo && age > 15)) && (
          <aside className="offline-banner" role="status">
            <WifiOff size={20} />
            <span>
              <strong>
                {offline
                  ? 'You’re offline.'
                  : cached
                    ? 'Live updates unavailable.'
                    : 'Data may be out of date.'}
              </strong>{' '}
              {snapshot
                ? `Showing last updated data — ${age.toLocaleString()} minutes ago.`
                : 'No saved data is available yet.'}{' '}
              Map tiles may be unavailable.
            </span>
            <button onClick={() => void sync()} className="text-button">
              <RefreshCw size={16} />
              Retry
            </button>
          </aside>
        )}
        {storageError && (
          <p className="inline-warning" role="status">
            Offline storage is unavailable in this browser. Keep this page open to retain the
            current view.
          </p>
        )}
        <section className="workspace" aria-label="Shelter finder">
          <aside className="finder-panel">
            <section className="start-section">
              <div className="section-kicker">
                <span className="step-dot">1</span> YOUR STARTING POINT
              </div>
              <h2>Where are you now?</h2>
              <button className="location-field" onClick={() => setPicking(!picking)}>
                <MapPin size={20} />
                <span>
                  {locating ? 'Finding your current location…' : locationName}
                  <small>
                    {origin
                      ? `${origin[1].toFixed(4)}° N, ${origin[0].toFixed(4)}° E`
                      : 'Select a location on the map'}
                  </small>
                </span>
                <ChevronDown size={17} />
              </button>
              <div className="location-actions">
                <button className="text-button" onClick={locate} disabled={locating}>
                  <LocateFixed size={16} />
                  {locating ? 'Finding location…' : 'Use my location'}
                </button>
                {snapshot?.demo && (
                  <button
                    className="text-button muted"
                    onClick={() => choose(DEMO_ORIGIN, 'Sample starting point')}
                  >
                    Try sample location
                  </button>
                )}
              </div>
              <button
                className="primary-button desktop-primary"
                onClick={findShelter}
                disabled={loading || !snapshot}
              >
                <Navigation size={20} />
                Find Shelter Now
                <ArrowRight size={19} />
              </button>
              <p className="routing-note">
                <ShieldCheck size={14} /> Routes consider all active hazards
              </p>
              <CoordinateEntry onChoose={choose} />
            </section>
            <section className="results-section" id="shelter-list">
              <div
                className="result-tabs"
                role="tablist"
                aria-label="Local information"
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 'shelters'
                      : event.key === 'End'
                        ? 'alerts'
                        : tab === 'shelters'
                          ? 'alerts'
                          : 'shelters';
                  setTab(next);
                  document.getElementById(`${next}-tab`)?.focus();
                }}
              >
                <button
                  role="tab"
                  tabIndex={tab === 'shelters' ? 0 : -1}
                  aria-selected={tab === 'shelters'}
                  onClick={() => setTab('shelters')}
                  id="shelters-tab"
                  aria-controls="shelters-panel"
                >
                  <House size={16} />
                  Shelters <span>{shelterList.length}</span>
                </button>
                <button
                  role="tab"
                  tabIndex={tab === 'alerts' ? 0 : -1}
                  aria-selected={tab === 'alerts'}
                  onClick={() => setTab('alerts')}
                  id="alerts-tab"
                  aria-controls="alerts-panel"
                >
                  <TriangleAlert size={16} />
                  Hazards <span>{activeHazards.length}</span>
                </button>
              </div>
              {tab === 'shelters' ? (
                <div role="tabpanel" id="shelters-panel" aria-labelledby="shelters-tab">
                  <div className="results-heading">
                    <h3>{origin ? 'Recommended shelters' : 'Nearby shelters'}</h3>
                    <span>{origin ? 'Risk + distance' : 'Select a start to rank'}</span>
                  </div>
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="Search shelters or barangays"
                      placeholder="Search shelter or barangay"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className="accessibility-filter">
                    <input
                      type="checkbox"
                      checked={accessible}
                      onChange={(e) => setAccessible(e.target.checked)}
                    />
                    Step-free shelter access only
                  </label>
                  <div className="shelter-cards">
                    {loading ? (
                      <p className="empty-state">Loading shelter information…</p>
                    ) : shelterList.length ? (
                      shelterList.map((s) => (
                        <ShelterCard
                          key={s.id}
                          shelter={s}
                          rank={ranked.find((r) => r.shelter.id === s.id)}
                          index={snapshot!.shelters.findIndex((item) => item.id === s.id)}
                          selected={s.id === (activeRoute?.shelter.id || selected)}
                          recommended={Boolean(origin && ranked[0]?.shelter.id === s.id)}
                          onSelect={() => selectShelter(s.id)}
                        />
                      ))
                    ) : (
                      <p className="empty-state">
                        {error && !snapshot
                          ? 'Unable to load shelters. Reconnect and try again.'
                          : origin
                            ? 'No matching reachable shelters. Change the starting point or filters.'
                            : 'No shelters match your search.'}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  role="tabpanel"
                  id="alerts-panel"
                  aria-labelledby="alerts-tab"
                  className="hazard-list"
                >
                  <h3>Reported street hazards</h3>
                  <p>Hidden map layers still affect routing.</p>
                  {activeHazards.map((h) => {
                    const Icon = hazardIcons[h.hazard_type];
                    const road = snapshot?.roads.find((r) => r.id === h.road_id);
                    const blocked = road ? segmentRisk(road, snapshot!.hazards).blocked : h.blocked;
                    return (
                      <article key={h.id} className="hazard-card">
                        <Icon size={22} />
                        <div>
                          <span className="hazard-kind">{h.hazard_type}</span>
                          <h4>{h.name}</h4>
                          <p>
                            {h.barangay} · {Math.round(h.severity * 100)}% severity
                          </p>
                          <p>{h.notes}</p>
                          <small>
                            {snapshot?.demo
                              ? 'Illustrative report'
                              : new Date(h.updated_at).toLocaleString()}
                          </small>
                        </div>
                        <span className={`badge ${blocked ? 'badge-danger' : 'badge-amber'}`}>
                          <TriangleAlert size={12} />
                          {blocked ? 'Blocked street' : 'Affected street'}
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            <footer className="panel-footer">
              <ShieldCheck size={15} />
              <span>Risk-aware guidance. Stay aware of your surroundings.</span>
            </footer>
          </aside>
          <section className="map-panel" aria-label="Map and route information">
            <div className="map-toolbar">
              <div>
                <span className="live-dot" />
                <strong>Santa Rosa City</strong>
                <span className="map-toolbar-sub">Laguna, Philippines</span>
              </div>
              <button
                className={`layer-button ${boundaries ? 'is-active' : ''}`}
                disabled={!snapshot?.boundaries.length}
                title={
                  snapshot?.boundaries.length
                    ? 'Show official boundaries'
                    : 'No verified boundary dataset is loaded'
                }
                aria-pressed={boundaries}
                onClick={() => setBoundaries(!boundaries)}
              >
                <Layers size={16} />
                <span>Boundaries</span>
              </button>
            </div>
            <div className="map-stage">
              {snapshot ? (
                <Map
                  snapshot={snapshot}
                  origin={origin}
                  route={activeRoute?.route || null}
                  visible={visible}
                  boundaries={boundaries}
                  picking={picking}
                  onPick={(p) => choose(p)}
                  onShelter={selectShelter}
                />
              ) : (
                <div className="map-loading">
                  <Navigation size={32} />
                  <p>{loading ? 'Preparing your map…' : 'Map data unavailable'}</p>
                  {!loading && (
                    <button className="secondary-button" onClick={() => void sync()}>
                      Try again
                    </button>
                  )}
                </div>
              )}
              <div className="map-hazard-controls" aria-label="Hazard map layers">
                {(['flood', 'fire', 'earthquake'] as HazardType[]).map((type) => {
                  const Icon = hazardIcons[type];
                  return (
                    <button
                      key={type}
                      aria-pressed={visible.includes(type)}
                      onClick={() =>
                        setVisible((v) =>
                          v.includes(type) ? v.filter((x) => x !== type) : [...v, type],
                        )
                      }
                    >
                      <Icon size={16} />
                      <span>{type}</span>
                      {visible.includes(type) && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
              {picking && (
                <div className="map-pick-banner" role="status">
                  <MapPin size={18} />
                  Tap the map to set your starting point
                  <button
                    className="icon-button"
                    aria-label="Cancel location selection"
                    onClick={() => setPicking(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {!origin && !picking && (
                <div className="map-intro">
                  <span className="intro-symbol">
                    <Navigation size={22} />
                  </span>
                  <div>
                    <strong>Your safety. A clear direction.</strong>
                    <p>Choose your location to see routes to available shelters.</p>
                  </div>
                </div>
              )}
              <div className="map-legend">
                <span>
                  <House size={14} className="legend-shelter" aria-hidden="true" />
                  Shelter
                </span>
                <span>
                  <i className="legend-route" />
                  Lower-risk route
                </span>
                <span>
                  <i className="legend-hazard" />
                  Blocked street
                </span>
                <span>
                  <i className="legend-affected" />
                  Affected street
                </span>
              </div>
            </div>
            {activeRoute && (
              <section className="route-summary" aria-label="Selected route">
                <div className="route-summary-title">
                  <span className="route-symbol">
                    <RouteIcon size={22} />
                  </span>
                  <div>
                    <p>{snapshot?.demo ? 'SAMPLE ROUTE' : 'SUGGESTED ROUTE'}</p>
                    <h3>{activeRoute.shelter.name}</h3>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Clear route"
                    onClick={() => setRequested(false)}
                  >
                    <X size={19} />
                  </button>
                </div>
                <div className="route-metrics">
                  <span>
                    <Footprints size={19} />
                    <strong>{activeRoute.route.minutes} min</strong>
                    <small>Est. walking time</small>
                  </span>
                  <span>
                    <RouteIcon size={19} />
                    <strong>{(activeRoute.route.distance / 1000).toFixed(1)} km</strong>
                    <small>Network distance</small>
                  </span>
                  <span>
                    <ShieldCheck size={19} />
                    <strong>{activeRoute.route.risk < 35 ? 'Low' : 'Elevated'} risk</strong>
                    <small>From recorded hazards</small>
                  </span>
                </div>
                <details>
                  <summary>Route details and limitations</summary>
                  <p>
                    Starts {Math.round(activeRoute.route.snapDistance)} m from your selected point
                    at the nearest road-network node. The approach to the road and shelter entrance
                    are not assessed. ETA assumes walking at 65 m/min, adjusted for recorded risk.
                  </p>
                  <p>
                    {activeRoute.route.roadIds.length} road segments.{' '}
                    {activeRoute.shelter.capacity - activeRoute.shelter.occupancy} reported spaces
                    available. Follow local responder directions; conditions can change.
                  </p>
                  <ol>
                    {activeRoute.route.roadIds.map((id, i) => (
                      <li key={id}>
                        {i === 0 ? 'Start on' : 'Continue along'}{' '}
                        {snapshot?.roads.find((r) => r.id === id)?.name || 'road segment'}.
                      </li>
                    ))}
                  </ol>
                </details>
              </section>
            )}
            <footer className="map-footer">
              <span>
                <Info size={14} />
                {snapshot?.demo
                  ? 'OSM streets · sample incidents · not for navigation'
                  : 'Routes use the latest available road and hazard reports'}
              </span>
              <button className="text-button" onClick={() => void sync()}>
                <RefreshCw size={14} />
                Refresh data
              </button>
            </footer>
          </section>
        </section>
        <section className="overview-grid" aria-label="Area overview">
          <article>
            <span className="overview-icon green">
              <House size={21} />
            </span>
            <div>
              <p>Available shelters</p>
              <strong>
                {snapshot?.shelters.filter((s) => ['Open', 'Near full'].includes(shelterStatus(s)))
                  .length || 0}
                <small> accepting evacuees</small>
              </strong>
            </div>
            <ChevronRight size={18} />
          </article>
          <article>
            <span className="overview-icon blue">
              <Users size={21} />
            </span>
            <div>
              <p>Reported capacity</p>
              <strong>
                {freeSpaces.toLocaleString()}
                <small> spaces available</small>
              </strong>
            </div>
          </article>
          <article>
            <span className="overview-icon amber">
              <TriangleAlert size={21} />
            </span>
            <div>
              <p>Street hazard reports</p>
              <strong>
                {activeHazards.length}
                <small> included in route checks</small>
              </strong>
            </div>
          </article>
        </section>
        <footer className="site-footer">
          <span>
            <ShieldCheck size={16} />
            <strong>EVACU-ROSA</strong> <span>Helping Santa Rosa move toward safety.</span>
          </span>
          <span>
            {snapshot?.demo ? 'Prototype · illustrative data' : 'Community evacuation support'}
            <span className="footer-dot">·</span>
            <button className="text-button" onClick={() => setHelp(true)}>
              About this system <ArrowRight size={13} />
            </button>
          </span>
        </footer>
      </main>
      {notice && (
        <div className="notice" role="status">
          <Info size={20} />
          <p>{notice}</p>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice('')}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className="mobile-action">
        <button className="primary-button" onClick={findShelter} disabled={loading || !snapshot}>
          <Navigation size={20} />
          Find Shelter Now
          <ArrowRight size={19} />
        </button>
      </div>
      {help && <HelpDialog onClose={() => setHelp(false)} />}
    </>
  );
}
function ShelterCard({
  shelter: s,
  rank,
  index,
  selected,
  recommended,
  onSelect,
}: {
  shelter: Shelter;
  rank?: RankedShelter;
  index: number;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const status = shelterStatus(s),
    percent = Math.round((s.occupancy / s.capacity) * 100);
  return (
    <article className={`shelter-card ${selected ? 'selected' : ''}`}>
      {recommended && (
        <p className="recommended">
          <ShieldCheck size={13} /> RECOMMENDED FOR YOU
        </p>
      )}
      <div className="shelter-card-top">
        <span className="shelter-number">{index + 1}</span>
        <span
          className={`badge ${status === 'Open' ? 'badge-green' : status === 'Near full' ? 'badge-amber' : 'badge-danger'}`}
        >
          {status === 'Open' ? <CheckCircle2 size={12} /> : <TriangleAlert size={12} />} {status}
        </span>
        {s.accessible && (
          <span className="accessible-label" title="Step-free shelter entrance">
            Step-free
          </span>
        )}
      </div>
      <button className="shelter-title" onClick={onSelect}>
        {s.name}
        <ChevronRight size={17} />
      </button>
      <p className="shelter-address">
        <MapPin size={12} />
        Brgy. {s.barangay}, Santa Rosa
      </p>
      {rank && (
        <div className="shelter-distance">
          <span>
            <Footprints size={14} />
            {rank.route.minutes} min
          </span>
          <span>{(rank.route.distance / 1000).toFixed(1)} km</span>
          <span className={rank.route.risk < 35 ? 'low-risk' : 'elevated-risk'}>
            <ShieldCheck size={13} />
            {rank.route.risk < 35 ? 'Low risk' : 'Elevated risk'}
          </span>
        </div>
      )}
      <div className="capacity-label">
        <span>
          <Users size={13} />
          {Math.max(0, s.capacity - s.occupancy)} spaces available
        </span>
        <span>
          {s.occupancy}/{s.capacity}
        </span>
      </div>
      <meter
        className={percent >= 80 ? 'capacity-meter near-full' : 'capacity-meter'}
        min={0}
        max={s.capacity}
        value={s.occupancy}
        aria-label={`${s.name} occupancy`}
      />
      <details className="shelter-details">
        <summary>Facilities and access</summary>
        <p>{s.amenities.join(' · ')}</p>
        <p>
          {s.accessible
            ? 'Step-free entrance reported. Route accessibility has not been assessed.'
            : 'Step-free access has not been confirmed.'}
        </p>
      </details>
    </article>
  );
}
function CoordinateEntry({ onChoose }: { onChoose: (point: Position, name: string) => void }) {
  return (
    <details className="coordinate-entry">
      <summary>Enter a location by coordinates</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const lng = Number(values.get('longitude')),
            lat = Number(values.get('latitude'));
          if (
            Number.isFinite(lng) &&
            Number.isFinite(lat) &&
            Math.abs(lng) <= 180 &&
            Math.abs(lat) <= 90
          ) {
            onChoose([lng, lat], 'Entered location');
          }
        }}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <label className="field">
            Latitude
            <input
              required
              name="latitude"
              type="number"
              step="any"
              min={-90}
              max={90}
              placeholder="14.297"
            />
          </label>
          <label className="field">
            Longitude
            <input
              required
              name="longitude"
              type="number"
              step="any"
              min={-180}
              max={180}
              placeholder="121.109"
            />
          </label>
        </div>
        <button className="secondary-button w-full" type="submit">
          Use this starting point
        </button>
      </form>
    </details>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const el = document.getElementById('help-dialog') as HTMLDialogElement;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      id="help-dialog"
      aria-labelledby="help-title"
      className="help-dialog"
      onCancel={onClose}
    >
      <div className="dialog-heading">
        <ShieldCheck size={25} />
        <h2 id="help-title">Find your way to safety</h2>
        <button autoFocus className="icon-button" aria-label="Close help" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <ol>
        <li>
          <strong>Choose your starting point.</strong> Use your location or select a point on the
          map.
        </li>
        <li>
          <strong>Find a shelter.</strong> Routes consider flood, fire, earthquake exposure, road
          conditions, and available capacity.
        </li>
        <li>
          <strong>Check conditions as you go.</strong> Recorded data can be incomplete. Follow
          official evacuation instructions.
        </li>
      </ol>
      <section>
        <h3>Need immediate assistance?</h3>
        <p>
          Contact local emergency responders or the nearest barangay office. This app does not
          dispatch assistance.
        </p>
      </section>
      <p className="inline-warning">
        Sample incidents and shelter locations are for evaluation only. Your browser asks permission
        before sharing your location with this page; your position is not saved or uploaded
        automatically.
      </p>
      <button className="primary-button" onClick={onClose}>
        Got it <Check size={18} />
      </button>
    </dialog>
  );
}
