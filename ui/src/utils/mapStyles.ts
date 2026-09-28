const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>`;

export interface BaseLayer {
  id: string;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
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
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    subdomains: "abcd",
  },
  {
    id: "dark",
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    subdomains: "abcd",
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
