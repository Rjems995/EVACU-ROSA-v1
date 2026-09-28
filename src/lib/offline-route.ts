import type { RankedShelter, Snapshot } from './types';
import type { TransportMode } from './transport';
import { instruction, maneuvers } from './navigation-guidance';
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function offlineRouteHTML(
  selected: RankedShelter,
  snapshot: Snapshot,
  mode: TransportMode,
  fil: boolean,
  savedAt: string,
) {
  const route = selected.route;
  const xs = route.coordinates.map((p) => p[0]),
    ys = route.coordinates.map((p) => p[1]);
  const west = Math.min(...xs),
    south = Math.min(...ys),
    width = Math.max(...xs) - west || 0.001,
    height = Math.max(...ys) - south || 0.001;
  const points = route.coordinates
    .map((p) => `${20 + ((p[0] - west) / width) * 560},${380 - ((p[1] - south) / height) * 360}`)
    .join(' ');
  const streets = route.roadIds
    .map((id) => snapshot.roads.find((r) => r.id === id)?.name || id)
    .filter((n, i, a) => i === 0 || n !== a[i - 1]);
  const title = fil ? 'Offline na gabay sa silungan' : 'Offline shelter directions';
  return `<!doctype html><html lang="${fil ? 'fil' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${title}</title><style>body{font:18px/1.6 Arial,sans-serif;max-width:800px;margin:auto;padding:20px;color:#331b1b}h1{color:#8b0000}svg{width:100%;border:1px solid #ddd}aside{background:#fff0d0;padding:12px}li{margin:10px 0}</style><h1>${title}</h1><h2>${escape(selected.shelter.name)}</h2><p>${escape(selected.shelter.barangay)} · ${escape(mode)} · ${(route.distance / 1000).toFixed(1)} km</p><p>${fil ? 'Na-download' : 'Downloaded'}: ${escape(savedAt)}<br>${fil ? 'Huling datos' : 'Data timestamp'}: ${escape(snapshot.syncedAt)}</p><aside>${fil ? 'Naka-save na ruta lamang. Maaaring magbago ang panganib at kapasidad. Walang live na GPS, bagong ulat o awtomatikong pagpalit ng ruta sa file na ito. Sundin ang CDRRMO at mga karatula.' : 'Saved route only. Hazards and shelter capacity may change. This file has no live GPS, new reports or automatic rerouting. Follow CDRRMO and posted signs.'}</aside><svg viewBox="0 0 600 400" role="img" aria-label="Route outline"><polyline points="${points}" fill="none" stroke="#1265dd" stroke-width="5"/></svg><p>${fil ? 'Balangkas ng ruta, hindi mapa ng mga kalsada.' : 'Route outline, not a street map.'} © OpenStreetMap contributors</p><h3>${fil ? 'Mga kalsada' : 'Streets'}</h3><ol>${streets.map((n) => `<li>${escape(n)}</li>`).join('')}</ol><h3>${fil ? 'Mga direksyon' : 'Directions'}</h3><ol>${maneuvers(
    route,
  )
    .map((m) => `<li>${Math.round(m.along)} m: ${escape(instruction(m, fil))}</li>`)
    .join(
      '',
    )}</ol><p>${fil ? 'Lokasyon ng silungan' : 'Shelter coordinates'}: ${escape(selected.shelter.geometry.coordinates.slice().reverse().join(', '))}</p><p>${fil ? 'Tiyakin ang pasukan pagdating.' : 'Check the entrance on arrival.'}</p></html>`;
}
