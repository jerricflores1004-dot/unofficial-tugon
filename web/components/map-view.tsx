'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, MapPin, Search, X } from 'lucide-react';
import { buildQuery } from '@/lib/api-client';
import { useApi, usePagedApi } from '@/lib/use-api';
import { mapIncident, settingNumber } from '@/lib/mappers';
import type { Incident, SystemSetting } from '@/lib/types';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PanelHeader, PriorityBadge, StatusBadge } from './ui';

const PRIORITY_FILL: Record<Incident['priority'], string> = { critical: '#B91C1C', high: '#EA580C', medium: '#D97706', low: '#16A34A' };
const PRIORITY_DOT: Record<Incident['priority'], string> = { critical: 'bg-critical', high: 'bg-high', medium: 'bg-medium', low: 'bg-low' };

export function MapView() {
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const googleRef = useRef<any>(null);

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const incidents = usePagedApi<Record<string, any>>(buildQuery('/api/incidents', { limit: 100, geolocated: 'true' }), []);
  const settings = useApi<Record<string, any>[]>('/api/settings');
  const settingsMap = useMemo(() => (settings.data ?? []).reduce<Record<string, SystemSetting>>((accumulator, row) => {
    accumulator[row.key] = { key: row.key, value: row.value, description: row.description ?? null };
    return accumulator;
  }, {}), [settings.data]);

  const rows = useMemo(() => incidents.rows.map(mapIncident), [incidents.rows]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((incident) => `${incident.ticket_id} ${incident.type} ${incident.barangay} ${incident.location}`.toLowerCase().includes(needle));
  }, [rows, query]);
  const selected = visible.find((incident) => incident.id === active) ?? null;

  const defaultCenter = useMemo(() => ({
    lat: settingNumber(settingsMap, 'map_default_latitude', 0),
    lng: settingNumber(settingsMap, 'map_default_longitude', 0),
    zoom: settingNumber(settingsMap, 'map_default_zoom', 12),
  }), [settingsMap]);
  const hasDefaultCenter = defaultCenter.lat !== 0 || defaultCenter.lng !== 0;

  useEffect(() => {
    if (!mapsKey || !mapRef.current) return;
    let cancelled = false;
    import('@googlemaps/js-api-loader')
      .then(({ Loader }) => new Loader({ apiKey: mapsKey, version: 'weekly' }).load())
      .then((googleMaps: any) => {
        if (cancelled || !mapRef.current) return;
        googleRef.current = googleMaps;
        mapInstance.current = new googleMaps.maps.Map(mapRef.current, {
          center: hasDefaultCenter ? { lat: defaultCenter.lat, lng: defaultCenter.lng } : { lat: 0, lng: 0 },
          zoom: defaultCenter.zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        setMapLoaded(true);
      })
      .catch(() => { if (!cancelled) setMapError('The map provider could not be reached.'); });
    return () => { cancelled = true; };
  }, [mapsKey, hasDefaultCenter, defaultCenter.lat, defaultCenter.lng, defaultCenter.zoom]);

  // Markers are drawn strictly from stored coordinates.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded) return;
    const googleMaps = googleRef.current;
    if (!googleMaps) return;
    const points = visible.filter((incident) => incident.latitude !== null && incident.longitude !== null);
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = points.map((incident) => new googleMaps.maps.Marker({
      map,
      position: { lat: incident.latitude as number, lng: incident.longitude as number },
      title: `${incident.type} · ${incident.ticket_id}`,
      icon: {
        path: googleMaps.maps.SymbolPath.CIRCLE,
        scale: incident.priority === 'critical' ? 9 : 7,
        fillColor: PRIORITY_FILL[incident.priority],
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3,
      },
    }));
    if (points.length > 0) {
      const bounds = new googleMaps.maps.LatLngBounds();
      points.forEach((incident) => bounds.extend({ lat: incident.latitude as number, lng: incident.longitude as number }));
      map.fitBounds(bounds, 64);
      if (points.length === 1) map.setZoom(Math.min(defaultCenter.zoom + 2, 16));
    }
  }, [visible, mapLoaded, defaultCenter.zoom]);

  if (incidents.error) return <ErrorState detail={incidents.error} onRetry={incidents.reload} />;

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="surface relative min-h-[640px] overflow-hidden bg-[#d6e2eb] p-0 dark:bg-[#1a2b3a]">
      {mapsKey
        ? <>
          <div ref={mapRef} className="absolute inset-0 z-0" />
          {!mapLoaded && !mapError && <div className="absolute inset-0 grid place-items-center"><LoadingSkeleton className="h-24 w-24 rounded-full" /></div>}
          {mapError && <div className="absolute inset-0 grid place-items-center p-8 text-center text-xs text-slate-600 dark:text-slate-300">{mapError}</div>}
        </>
        : <div className="absolute inset-0 grid place-items-center p-8">
          <EmptyState
            title="Map provider is not configured"
            detail="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to plot stored coordinates. The incident list on the right is always read from the database."
          />
        </div>}

      <div className="absolute inset-x-8 top-8 z-10 flex items-center gap-2">
        <div className="inset-control flex min-w-0 flex-1 items-center gap-2 bg-white/90 px-3 dark:bg-slate-800/90">
          <Search size={16} className="text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none dark:text-white" placeholder="Search barangay or ticket" aria-label="Search map" />
        </div>
        <button onClick={incidents.reload} className="grid h-10 w-10 place-items-center rounded-xl border border-white/80 bg-white/90 text-slate-500 shadow-md hover:text-blue dark:border-slate-600 dark:bg-slate-800/90" aria-label="Reload incidents"><Filter size={17} /></button>
      </div>

      <div className="absolute bottom-5 left-5 z-10 rounded-xl border border-white/70 bg-white/90 p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800/90">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Incident priority</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-critical" />Critical</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-high" />High</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-medium" />Medium</span>
          <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-low" />Low</span>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">{incidents.count} geolocated incidents in the database</p>
      </div>

      {selected && <div className="absolute right-5 top-20 z-20 w-64 rounded-xl border border-white/70 bg-white/95 p-4 shadow-xl dark:border-slate-600 dark:bg-slate-800/95">
        <button onClick={() => setActive(null)} className="absolute right-3 top-3 text-slate-400" aria-label="Close map detail"><X size={16} /></button>
        <p className="text-[10px] font-bold text-blue">{selected.ticket_id}</p>
        <h4 className="mt-1 pr-4 text-sm font-bold text-navy dark:text-white">{selected.type}</h4>
        <p className="mt-1 flex items-start gap-1 text-xs text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0" />{selected.location}</p>
        <p className="mt-1 text-[10px] text-slate-400">{selected.latitude?.toFixed(5)}, {selected.longitude?.toFixed(5)}</p>
        <div className="mt-3 flex items-center gap-2"><PriorityBadge priority={selected.priority} /><StatusBadge status={selected.status} /></div>
        <Link href={`/incidents/${selected.id}`} className="mt-4 inline-flex text-xs font-bold text-blue hover:underline">Open incident →</Link>
      </div>}
    </div>

    <div className="surface p-5">
      <PanelHeader title="Geolocated incidents" detail={incidents.loading ? 'Querying the database…' : `${visible.length} shown · updated from stored coordinates`} action={<Button variant="ghost" size="sm" onClick={incidents.reload}>Refresh</Button>} />
      {incidents.loading && rows.length === 0
        ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((row) => <LoadingSkeleton key={row} className="h-12 w-full" />)}</div>
        : visible.length === 0
          ? <EmptyState title="No geolocated incidents" detail="Incidents submitted with a latitude and longitude appear on the map." />
          : <div className="space-y-1">
            {visible.map((incident) => <button key={incident.id} onClick={() => setActive(incident.id)} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/60 dark:hover:bg-slate-800 ${active === incident.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_DOT[incident.priority]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-slate-700 dark:text-slate-200">{incident.type}</span>
                <span className="block truncate text-[10px] text-slate-500">{incident.barangay} · {incident.ticket_id}</span>
              </span>
              <StatusBadge status={incident.status} />
            </button>)}
          </div>}
    </div>
  </div>;
}
