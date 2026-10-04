import { useEffect, useMemo } from 'react';
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import type { Field, Ring, Zone } from '../lib/types';
import { ZONE_STYLE } from './zoneStyle';
import { ringAreaM2, ringCentroid } from '../lib/geo';

const TN_CENTER: [number, number] = [10.8, 78.7];
const toLatLngs = (ring: Ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]);

function FitTo({ field }: { field?: Field }) {
  const map = useMap();
  useEffect(() => {
    if (!field) return;
    const b = L.latLngBounds(toLatLngs(field.polygon.coordinates[0]));
    map.fitBounds(b, { padding: [28, 28], maxZoom: 18, animate: true });
  }, [field, map]);
  return null;
}

function FlyTo({ target }: { target?: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 1 });
  }, [target, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Label marker at the centre of a zone's largest part: glyph in a coloured circle. */
function zoneIcon(zone: Zone, n: number, selected: boolean) {
  const s = ZONE_STYLE[zone.label];
  const size = selected ? 40 : 34;
  return L.divIcon({
    className: 'zone-icon',
    iconSize: [size, size],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:#fff;border:3px solid ${s.color};display:flex;align-items:center;justify-content:center;font-weight:800;color:${s.text};font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3)">${s.glyph}${n}</div>`,
  });
}

function largestPartCentroid(zone: Zone): [number, number] {
  const largest = zone.polygon.coordinates.reduce((a, b) =>
    ringAreaM2(b[0]) > ringAreaM2(a[0]) ? b : a,
  );
  const c = ringCentroid(largest[0]);
  return [c.lat, c.lng];
}

interface Props {
  field?: Field;
  showZones?: boolean;
  selectedZoneId?: string | null;
  onSelectZone?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  draft?: [number, number][];
  flyTarget?: { lat: number; lng: number; zoom: number } | null;
  className?: string;
  zoneName?: (zone: Zone, index: number) => string;
}

export default function FieldMap({
  field,
  showZones,
  selectedZoneId,
  onSelectZone,
  onMapClick,
  draft,
  flyTarget,
  className = 'h-[360px]',
  zoneName,
}: Props) {
  const { t } = useTranslation();
  const fieldPositions = useMemo(
    () => (field ? toLatLngs(field.polygon.coordinates[0]) : null),
    [field],
  );

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} role="region" aria-label={t('field.mapLabel')}>
      <MapContainer
        center={field ? [field.centroid.lat, field.centroid.lng] : TN_CENTER}
        zoom={field ? 17 : 7}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name={t('field.satellite')}>
            <TileLayer
              attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name={t('field.streets')}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <FitTo field={field} />
        <FlyTo target={flyTarget} />
        <ClickHandler onClick={onMapClick} />

        {fieldPositions && (
          <Polygon
            positions={fieldPositions}
            pathOptions={{
              color: '#FACC15',
              weight: 3,
              fillOpacity: showZones ? 0 : 0.15,
              fillColor: '#22C55E',
            }}
          />
        )}

        {showZones &&
          field?.zones.map((z, i) => {
            const s = ZONE_STYLE[z.label];
            const selected = z.zone_id === selectedZoneId;
            const name = zoneName ? zoneName(z, i) : z.zone_id;
            return (
              <div key={z.zone_id}>
                {z.polygon.coordinates.map((poly, j) => (
                  <Polygon
                    key={j}
                    positions={toLatLngs(poly[0])}
                    eventHandlers={{ click: () => onSelectZone?.(z.zone_id) }}
                    pathOptions={{
                      className: `zone-${z.label}`,
                      color: selected ? '#0F172A' : s.color,
                      weight: selected ? 3 : 1.5,
                      fillOpacity: 1,
                    }}
                  >
                    <Tooltip sticky>
                      {name} • {t(`zones.${z.label}`)}
                    </Tooltip>
                  </Polygon>
                ))}
                <Marker
                  position={largestPartCentroid(z)}
                  icon={zoneIcon(z, i + 1, selected)}
                  eventHandlers={{ click: () => onSelectZone?.(z.zone_id) }}
                  keyboard
                  title={`${name}: ${t(`zones.${z.label}`)}`}
                  alt={`${name}: ${t(`zones.${z.label}`)}`}
                />
              </div>
            );
          })}

        {draft && draft.length > 0 && (
          <>
            <Polyline positions={draft} pathOptions={{ color: '#FACC15', weight: 3, dashArray: '6 6' }} />
            {draft.map((p, i) => (
              <CircleMarker
                key={i}
                center={p}
                radius={6}
                pathOptions={{ color: '#14532D', fillColor: '#FACC15', fillOpacity: 1 }}
              />
            ))}
          </>
        )}
      </MapContainer>
    </div>
  );
}
