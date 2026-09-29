const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const ESRI_CANVAS_ATTRIBUTION = "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community";

export interface BaseLayer {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  /** The deepest zoom the server has tiles for; closer in, Leaflet enlarges those. */
  maxNativeZoom?: number;
  subdomains?: string;
}

/** The map backgrounds the route can be drawn over. The first is the default. */
export const BASE_LAYERS = [
  {
    id: "standard",
    label: "Standard",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  {
    id: "topo",
    label: "Topographic",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: `${OSM_ATTRIBUTION}, SRTM | Style &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a> (CC-BY-SA)`,
    maxZoom: 17,
    subdomains: "abc",
  },
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
  {
    id: "light",
    label: "Light",
    // CARTO's light map now needs an API key (it draws a watermark without one); Esri's doesn't.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: ESRI_CANVAS_ATTRIBUTION,
    maxZoom: 19,
    maxNativeZoom: 16,
  },
] as const satisfies readonly BaseLayer[];

export type BaseLayerId = (typeof BASE_LAYERS)[number]["id"];

export const DEFAULT_BASE_LAYER: BaseLayerId = "standard";

export const getBaseLayer = (id: BaseLayerId): BaseLayer =>
  BASE_LAYERS.find((layer) => layer.id === id) ?? BASE_LAYERS[0];

export const isBaseLayerId = (value: unknown): value is BaseLayerId =>
  BASE_LAYERS.some((layer) => layer.id === value);

/** Quick picks for the route line; any other colour can still be chosen by hand. */
export const ROUTE_COLORS = [
  { label: "Road paint", value: "#f4c430" },
  { label: "Orange", value: "#fc4c02" },
  { label: "Red", value: "#d62828" },
  { label: "Magenta", value: "#c2185b" },
  { label: "Blue", value: "#2e6da4" },
  { label: "Green", value: "#2a9d4b" },
  { label: "Black", value: "#1b2125" },
  { label: "White", value: "#ffffff" },
] as const;

export const DEFAULT_ROUTE_COLOR = ROUTE_COLORS[0].value;

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export interface OverlayLayer {
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
}

/** See-through layers drawn over the map background; they show cycling infrastructure only. */
export const BIKE_OVERLAYS = {
  lanes: {
    label: "Bike paths & lanes",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png",
    attribution: `<a href="https://www.cyclosm.org" target="_blank" rel="noopener noreferrer">CyclOSM</a>`,
    maxZoom: 20,
    subdomains: "abc",
  },
  routes: {
    label: "Signed cycle routes",
    url: "https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png",
    attribution: `<a href="https://cycling.waymarkedtrails.org" target="_blank" rel="noopener noreferrer">Waymarked Trails</a>`,
    maxZoom: 18,
  },
} as const satisfies Record<string, OverlayLayer>;

export type BikeOverlayId = keyof typeof BIKE_OVERLAYS;

export const isBikeOverlayId = (value: unknown): value is BikeOverlayId =>
  typeof value === "string" && Object.hasOwn(BIKE_OVERLAYS, value);
