"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./FloodMap.css";

type RiskLevel = "Low" | "Moderate" | "High" | "Very High" | "Critical";

type MapProperties = Record<string, unknown>;

type MapFeature = {
  type: "Feature";
  geometry: any;
  properties?: MapProperties;
};

type GeoJSONData = {
  type: "FeatureCollection";
  features: MapFeature[];
};

type SelectedLocation = {
  name: string;
  risk: RiskLevel;
  score: number;
};

type FeatureRecord = {
  name: string;
  layer: any;
  risk: RiskLevel;
  score: number;
};

type RiskCounts = Record<RiskLevel, number>;

const COLORS: Record<RiskLevel, string> = {
  Low: "#22b573",
  Moderate: "#f2b900",
  High: "#f47b13",
  "Very High": "#ef4444",
  Critical: "#b91c3c",
};

const DESCRIPTIONS: Record<RiskLevel, string> = {
  Low: "Minimal flood risk",
  Moderate: "Possible flooding",
  High: "Likely flooding",
  "Very High": "Severe flooding",
  Critical: "Extreme flood risk",
};

const EMPTY_COUNTS = (): RiskCounts => ({
  Low: 0,
  Moderate: 0,
  High: 0,
  "Very High": 0,
  Critical: 0,
});

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return text(value).replace(/\s+/g, " ").toLowerCase();
}

function property(
  props: MapProperties,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function municipalityName(feature: MapFeature): string {
  const props = feature.properties || {};

  const municipalityKeys = [
    "ADM3_EN",
    "ADM3_NAME",
    "ADM3_ENGLISH",
    "NAME_3",
    "NAME3",
    "NAM_3",
    "D3_NAME",
    "d3_name",
    "MUNICIPALITY",
    "municipality",
    "MUNICIPALITY_NAME",
    "municipality_name",
    "MUNICIPALITYNAME",
    "municipalityname",
    "MUN_NAME",
    "mun_name",
    "MUNNAME",
    "munname",
    "MUNICITY",
    "municity",
    "MUNICITY_NAME",
    "municity_name",
    "CITY",
    "city",
    "CITY_NAME",
    "city_name",
    "CITYNAME",
    "cityname",
    "ADMIN3",
    "admin3",
    "ADMIN3_NAME",
    "admin3_name",
    "LOCALITY",
    "locality",
  ];

  const municipality = property(props, municipalityKeys);
  if (municipality && normalize(municipality) !== "aklan") {
    return municipality;
  }

  const generic = property(props, [
    "name",
    "NAME",
    "Name",
    "NAMELONG",
    "name_long",
  ]);

  if (generic && normalize(generic) !== "aklan") return generic;

  for (const [key, value] of Object.entries(props)) {
    if (!text(value)) continue;
    const k = key.toLowerCase();
    if (
      k.includes("municip") ||
      k.includes("municity") ||
      k.includes("adm3") ||
      k.includes("name_3") ||
      k === "city" ||
      k.includes("city_name")
    ) {
      return text(value);
    }
  }

  return "Unknown Municipality";
}

function staticRisk(name: string): { risk: RiskLevel; score: number } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }

  const value = Math.abs(hash) % 100;

  if (value < 35) return { risk: "Low", score: 10 + (value % 10) };
  if (value < 65) return { risk: "Moderate", score: 21 + (value % 20) };
  if (value < 86) return { risk: "High", score: 41 + (value % 20) };
  if (value < 96) return { risk: "Very High", score: 61 + (value % 20) };
  return { risk: "Critical", score: 81 + (value % 19) };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function baseStyle(risk: RiskLevel) {
  return {
    color: "#d9e4ef",
    weight: 0.65,
    opacity: 0.95,
    fillColor: COLORS[risk],
    fillOpacity: 0.82,
  };
}

export default function FloodMapClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const recordsRef = useRef<FeatureRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [counts, setCounts] = useState<RiskCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);

  const totalRisked = useMemo(
    () => counts.Moderate + counts.High + counts["Very High"] + counts.Critical,
    [counts],
  );

  useEffect(() => {
    let disposed = false;
    let localMap: any = null;

    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<string>).detail;
      const map = mapRef.current;
      if (!map) return;

      if (command === "home") {
        map.setView([12.25, 122.0], 5.25, { animate: true });
      } else if (command === "zoom-in") {
        map.zoomIn();
      } else if (command === "zoom-out") {
        map.zoomOut();
      }
    };

    window.addEventListener("floodguard-map-command", onCommand);

    async function initialize() {
      try {
        setLoading(true);
        setError(null);

        const L = await import("leaflet");

        if (disposed || !containerRef.current) return;

        // React Strict Mode / Fast Refresh protection.
        if (mapRef.current) {
          try {
            mapRef.current.remove();
          } catch {}
          mapRef.current = null;
        }

        const element = containerRef.current as HTMLDivElement & {
          _leaflet_id?: number;
        };

        if (element._leaflet_id) {
          try {
            delete element._leaflet_id;
          } catch {}
        }

        localMap = L.map(element, {
          zoomControl: false,
          attributionControl: true,
          minZoom: 4,
          maxZoom: 12,
          preferCanvas: true,
          worldCopyJump: false,
        });

        mapRef.current = localMap;

        /*
         * CARTO dark tiles keep the dashboard dark while retaining
         * geographic labels. The map starts closer to the reference
         * screenshot instead of fitting the entire country tightly.
         */
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            subdomains: "abcd",
            maxZoom: 20,
          },
        ).addTo(localMap);

        localMap.setView([12.25, 122.0], 5.25);

        const group = L.featureGroup().addTo(localMap);

        const files = [
          "/geojson/philippines-municipalities.geojson",
          "/geojson/philippines-component-cities.geojson",
          "/geojson/philippines-huc.geojson",
          "/geojson/philippines-icc.geojson",
        ];

        const datasets = (await Promise.all(
          files.map(async (file) => {
            const response = await fetch(file, { cache: "no-store" });
            if (!response.ok) {
              throw new Error(
                `Unable to load ${file}. HTTP ${response.status}`,
              );
            }
            return (await response.json()) as GeoJSONData;
          }),
        )) as GeoJSONData[];

        if (disposed) return;

        const unique = new Map<string, MapFeature>();

        for (const dataset of datasets) {
          for (const feature of Array.isArray(dataset.features)
            ? dataset.features
            : []) {
            if (!feature?.geometry) continue;

            const name = municipalityName(feature);
            const key = `${normalize(name)}|${JSON.stringify(feature.geometry)}`;

            if (!unique.has(key)) unique.set(key, feature);
          }
        }

        const nextCounts = EMPTY_COUNTS();
        const records: FeatureRecord[] = [];

        for (const feature of unique.values()) {
          if (disposed) return;

          const name = municipalityName(feature);
          const { risk, score } = staticRisk(name);
          nextCounts[risk] += 1;

          const layer = L.geoJSON(feature as any, {
            style: baseStyle(risk),
          });

          layer.addTo(group);

          layer.eachLayer((shape: any) => {
            if (!shape || typeof shape.on !== "function") return;

            shape.bindTooltip(
              `<div class="fg-municipality-tooltip"><strong>${name}</strong><span>${risk} Risk · Score ${score}</span></div>`,
              {
                direction: "top",
                sticky: true,
                opacity: 1,
                className: "floodguard-tooltip",
              },
            );

            shape.on("mouseover", () => {
              try {
                shape.setStyle({
                  color: "#ffffff",
                  weight: 2,
                  opacity: 1,
                  fillColor: COLORS[risk],
                  fillOpacity: 0.96,
                });
                shape.bringToFront?.();
              } catch {}
            });

            shape.on("mouseout", () => {
              try {
                shape.setStyle(baseStyle(risk));
              } catch {}
            });

            shape.on("click", () => {
              if (disposed) return;

              setSelected({ name, risk, score });

              try {
                const bounds = layer.getBounds();
                if (bounds.isValid()) {
                  localMap.fitBounds(bounds, {
                    padding: [120, 120],
                    maxZoom: 9,
                    animate: true,
                  });
                }
              } catch {}
            });
          });

          records.push({ name, layer, risk, score });
        }

        if (disposed) return;

        recordsRef.current = records;
        setCounts(nextCounts);
        setTotal(records.length);

        setTimeout(() => {
          if (!disposed && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 250);

        setLoading(false);
      } catch (caught) {
        console.error("FLOODGUARD MAP ERROR:", caught);
        if (!disposed) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load the Philippine municipality map.",
          );
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      disposed = true;
      window.removeEventListener("floodguard-map-command", onCommand);
      recordsRef.current = [];

      if (localMap) {
        try {
          localMap.remove();
        } catch {}
        localMap = null;
      }

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }

      if (containerRef.current) {
        const element = containerRef.current as HTMLDivElement & {
          _leaflet_id?: number;
        };
        if (element._leaflet_id) {
          try {
            delete element._leaflet_id;
          } catch {}
        }
      }
    };
  }, []);

  const command = (value: "home" | "zoom-in" | "zoom-out") => {
    window.dispatchEvent(
      new CustomEvent("floodguard-map-command", { detail: value }),
    );
  };

  const affectedNames = selected
    ? [selected.name]
    : ["Manila", "Zambales", "Bataan", "Metro Manila", "Luzon"];

  return (
    <div className="flood-map-wrapper">
      <div ref={containerRef} className="flood-map" />

      {/* LEFT — FLOOD RISK INDICATOR */}
      <aside className="fg-map-card fg-risk-card">
        <div className="fg-card-title">FLOOD RISK INDICATOR</div>

        {(["Low", "Moderate", "High", "Very High"] as RiskLevel[]).map(
          (risk) => (
            <div className="fg-risk-row" key={risk}>
              <span
                className="fg-risk-dot"
                style={{ background: COLORS[risk] }}
              />
              <div>
                <strong>{risk}</strong>
                <small>{DESCRIPTIONS[risk]}</small>
              </div>
            </div>
          ),
        )}
      </aside>

      {/* LEFT — SUMMARY */}
      <aside className="fg-map-card fg-summary-card">
        <div className="fg-card-title">SUMMARY</div>

        <div className="fg-summary-row">
          <span className="fg-summary-icon blue">⌂</span>
          <div>
            <strong>{formatNumber(total)}</strong>
            <small>Total Municipalities</small>
          </div>
        </div>

        <div className="fg-summary-row">
          <span className="fg-summary-icon green">✓</span>
          <div>
            <strong>{formatNumber(counts.Low)}</strong>
            <small>Low Risk</small>
          </div>
        </div>

        <div className="fg-summary-row">
          <span className="fg-summary-icon yellow">!</span>
          <div>
            <strong>{formatNumber(counts.Moderate)}</strong>
            <small>Moderate Risk</small>
          </div>
        </div>

        <div className="fg-summary-row">
          <span className="fg-summary-icon orange">!</span>
          <div>
            <strong>{formatNumber(counts.High)}</strong>
            <small>High Risk</small>
          </div>
        </div>

        <div className="fg-summary-row">
          <span className="fg-summary-icon red">!</span>
          <div>
            <strong>{formatNumber(counts["Very High"])}</strong>
            <small>Very High Risk</small>
          </div>
        </div>

        <div className="fg-summary-divider" />

        <div className="fg-summary-source">
          Source: PAGASA, PHIVOLCS, NDRRMC, LGUs
          <br />
          OpenStreetMap contributors
        </div>

        <div className="fg-summary-updated">
          Last updated: 11:24 AM
        </div>
      </aside>

      {/* RIGHT — AI INSIGHTS */}
      <aside className="fg-ai-card">
        <div className="fg-ai-header">
          <div>
            <strong>AI INSIGHTS</strong>
            <span className="fg-help">?</span>
          </div>

          <div className="fg-ai-actions">
            <span className="fg-live-pill">
              <i />
              LIVE
            </span>
            <button
              type="button"
              aria-label="Close selected municipality"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>
        </div>

        <div className="fg-ai-body">
          <div className="fg-ai-kicker">
            <i />
            PHILIPPINE AI ANALYSIS
          </div>

          <h2>
            {selected
              ? `${selected.name} flood-risk assessment`
              : "Floods hit Manila; Orange rainfall alert in Zambales, Bataan"}
          </h2>

          <p>
            Parts of Manila experienced gutter to ankle-deep floods due to
            nonstop monsoon rains. Zambales and Bataan are under an orange
            rainfall alert, while Metro Manila remains under a yellow rainfall
            warning due to the southwest monsoon.
          </p>

          <div className="fg-ai-section">
            <div className="fg-ai-risk-line">
              <strong>AI ASSESSED RISK</strong>
              <span>
                {(selected?.risk ?? "Moderate").toUpperCase()}
              </span>
            </div>
          </div>

          <div className="fg-ai-section">
            <label>AFFECTED AREAS</label>
            <div className="fg-area-tags">
              {affectedNames.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          </div>

          <div className="fg-ai-section">
            <label>IDENTIFIED THREATS</label>
            <ul>
              <li>Flooding</li>
              <li>Heavy rainfall</li>
              <li>Infrastructure disruption</li>
            </ul>
          </div>

          <div className="fg-ai-section">
            <label>RECOMMENDED ACTION</label>
            <ul className="fg-check-list">
              <li>Monitor official weather advisories from PAGASA</li>
              <li>Prepare for potential flooding</li>
              <li>Avoid flood-prone areas</li>
              <li>Stay updated with local announcements</li>
            </ul>
          </div>

          <div className="fg-ai-section">
            <div className="fg-confidence-title">
              <span>AI CONFIDENCE</span>
              <strong>90%</strong>
            </div>
            <div className="fg-confidence-track">
              <span />
            </div>
          </div>

          <div className="fg-ai-footer">
            Cached analysis · Source: Google Gemini
            <span>11:24 AM · 14 Aug 2026</span>
          </div>
        </div>
      </aside>

      {/* RIGHT — MAP CONTROLS */}
      <div className="fg-map-controls">
        <button type="button" onClick={() => command("home")} aria-label="Home">
          ⌂
        </button>
        <button type="button" onClick={() => command("zoom-in")} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => command("zoom-out")} aria-label="Zoom out">
          −
        </button>
      </div>

      {/* SELECTED MUNICIPALITY */}
      {selected && (
        <div className="fg-selected-location">
          <div>
            <span>MUNICIPALITY / CITY</span>
            <strong>{selected.name}</strong>
            <small>
              {selected.risk} Risk · Score {selected.score}
            </small>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close municipality"
          >
            ×
          </button>
        </div>
      )}

      {loading && (
        <div className="fg-map-loading">
          <div />
          Loading Philippine municipalities...
        </div>
      )}

      {error && (
        <div className="fg-map-error">
          <strong>Map data error</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="fg-map-stat">
        {formatNumber(totalRisked)} areas with moderate-or-higher risk
      </div>
    </div>
  );
}