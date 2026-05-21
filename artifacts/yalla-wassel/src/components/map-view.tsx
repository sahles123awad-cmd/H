import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon paths for Leaflet in Vite
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const emojiIcon = (emoji: string) =>
  L.divIcon({
    html: `<div style="font-size:32px;line-height:1;text-align:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">${emoji}</div>`,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

const AMMAN = { lat: 31.9539, lng: 35.9106 };

export function MapView({ fromLabel, toLabel, driverLabel }: {
  fromLabel: string; toLabel: string; driverLabel?: string | null;
}) {
  // Use slight offsets to simulate different positions within Amman
  const from = { lat: AMMAN.lat + 0.015, lng: AMMAN.lng - 0.010 };
  const to = { lat: AMMAN.lat - 0.012, lng: AMMAN.lng + 0.018 };
  const driver = driverLabel ? { lat: AMMAN.lat + 0.002, lng: AMMAN.lng + 0.005 } : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-border relative" style={{ height: 280, isolation: "isolate", zIndex: 0 }}>
      <MapContainer center={[AMMAN.lat, AMMAN.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='© OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[from.lat, from.lng]} icon={emojiIcon("📦")}>
          <Popup>{fromLabel}</Popup>
        </Marker>
        <Marker position={[to.lat, to.lng]} icon={emojiIcon("🏠")}>
          <Popup>{toLabel}</Popup>
        </Marker>
        {driver && (
          <Marker position={[driver.lat, driver.lng]} icon={emojiIcon("🏍️")}>
            <Popup>{driverLabel}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
