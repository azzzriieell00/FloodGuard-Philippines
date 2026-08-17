"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";

import type {
  Feature,
  FeatureCollection,
  Geometry,
} from "geojson";

import type {
  Layer,
  PathOptions,
} from "leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./PhilippinesMap.css";

type Properties = Record<string, unknown>;

type GeoJSONData = FeatureCollection<
  Geometry,
  Properties
>;

type RiskLevel =
  | "Low"
  | "Moderate"
  | "High"
  | "Very High";

type RiskResult = {
  level: RiskLevel;
  color: string;
};

const PHILIPPINES_CENTER: [number, number] = [
  12.8797,
  121.774,
];

export default function PhilippinesMap() {
  const [regions, setRegions] =
    useState<GeoJSONData | null>(null);

  const [provinces, setProvinces] =
    useState<GeoJSONData | null>(null);

  const [municipalities, setMunicipalities] =
    useState<GeoJSONData | null>(null);

  const [selectedLocation, setSelectedLocation] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMapData() {
      try {
        setLoading(true);
        setError(null);

        const [
          regionsResponse,
          provincesResponse,
          municipalitiesResponse,
        ] = await Promise.all([
          fetch(
            "/geojson/philippines-regions.geojson",
            {
              cache: "force-cache",
            }
          ),

          fetch(
            "/geojson/philippines-provinces.geojson",
            {
              cache: "force-cache",
            }
          ),

          fetch(
            "/geojson/philippines-municipalities.geojson",
            {
              cache: "force-cache",
            }
          ),
        ]);

        if (
          !regionsResponse.ok ||
          !provincesResponse.ok ||
          !municipalitiesResponse.ok
        ) {
          throw new Error(
            "One or more Philippines GeoJSON files could not be loaded."
          );
        }

        const [
          regionsData,
          provincesData,
          municipalitiesData,
        ] = await Promise.all([
          regionsResponse.json(),
          provincesResponse.json(),
          municipalitiesResponse.json(),
        ]);

        if (cancelled) {
          return;
        }

        setRegions(regionsData);
        setProvinces(provincesData);
        setMunicipalities(municipalitiesData);
      } catch (err) {
        console.error(
          "PHILIPPINES MAP ERROR:",
          err
        );

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load Philippines map data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMapData();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * -------------------------------------------------------
   * REGION STYLE
   * -------------------------------------------------------
   */

  const regionStyle = useMemo(
    (): PathOptions => ({
      color: "#334155",
      weight: 1.2,
      opacity: 0.75,
      fillColor: "#0b1118",
      fillOpacity: 0.15,
    }),
    []
  );

  /*
   * -------------------------------------------------------
   * PROVINCE STYLE
   * -------------------------------------------------------
   */

  const provinceStyle = useMemo(
    (): PathOptions => ({
      color: "#526477",
      weight: 0.9,
      opacity: 0.7,
      fillColor: "#111a24",
      fillOpacity: 0.12,
    }),
    []
  );

  /*
   * -------------------------------------------------------
   * MUNICIPALITY STYLE
   *
   * Currently uses deterministic demonstration
   * colors.
   *
   * We will replace this with the REAL
   * /api/live-monitoring data next.
   * -------------------------------------------------------
   */

  function municipalityStyle(
    feature?: Feature<
      Geometry,
      Properties
    >
  ): PathOptions {
    const name =
      getFeatureName(feature);

    const risk =
      getDemoRisk(name);

    return {
      color: "#cbd5e1",
      weight: 0.55,
      opacity: 0.8,
      fillColor: risk.color,
      fillOpacity: 0.58,
    };
  }

  /*
   * -------------------------------------------------------
   * REGION EVENTS
   * -------------------------------------------------------
   */

  function onEachRegion(
    feature: Feature<
      Geometry,
      Properties
    >,
    layer: Layer
  ) {
    const name =
      getFeatureName(feature);

    if (!name) {
      return;
    }

    layer.bindTooltip(name, {
      sticky: true,
      direction: "center",
      className:
        "philippines-map-tooltip",
    });
  }

  /*
   * -------------------------------------------------------
   * PROVINCE EVENTS
   * -------------------------------------------------------
   */

  function onEachProvince(
    feature: Feature<
      Geometry,
      Properties
    >,
    layer: Layer
  ) {
    const name =
      getFeatureName(feature);

    if (!name) {
      return;
    }

    layer.bindTooltip(name, {
      sticky: true,
      direction: "center",
      className:
        "philippines-map-tooltip province-tooltip",
    });
  }

  /*
   * -------------------------------------------------------
   * MUNICIPALITY EVENTS
   * -------------------------------------------------------
   */

  function onEachMunicipality(
    feature: Feature<
      Geometry,
      Properties
    >,
    layer: Layer
  ) {
    const name =
      getFeatureName(feature);

    if (name) {
      layer.bindTooltip(name, {
        sticky: true,
        direction: "center",
        className:
          "philippines-map-tooltip municipality-tooltip",
      });
    }

    layer.on({
      mouseover: () => {
        const path = layer as any;

        if (typeof path.setStyle === "function") {
          path.setStyle({
            weight: 1.8,
            color: "#ffffff",
            fillOpacity: 0.82,
          });
        }

        if (
          typeof path.bringToFront ===
          "function"
        ) {
          path.bringToFront();
        }
      },

      mouseout: () => {
        const path = layer as any;

        if (typeof path.setStyle === "function") {
          path.setStyle(
            municipalityStyle(feature)
          );
        }
      },

      click: () => {
        if (!name) {
          return;
        }

        setSelectedLocation(name);
      },
    });
  }

  /*
   * -------------------------------------------------------
   * LOADING
   * -------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="philippines-map-loading">
        <div className="map-loading-spinner" />

        <strong>
          Loading Philippines Flood Map
        </strong>

        <span>
          Loading regions, provinces, and
          municipalities...
        </span>
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * ERROR
   * -------------------------------------------------------
   */

  if (error) {
    return (
      <div className="philippines-map-error">
        <strong>
          Philippines map unavailable
        </strong>

        <span>{error}</span>

        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
        >
          Reload Map
        </button>
      </div>
    );
  }

  /*
   * -------------------------------------------------------
   * MAIN MAP
   * -------------------------------------------------------
   */

  return (
    <div className="philippines-map">
      <MapContainer
        center={PHILIPPINES_CENTER}
        zoom={5}
        minZoom={4}
        maxZoom={12}
        zoomControl={true}
        scrollWheelZoom={true}
        preferCanvas={true}
        className="philippines-leaflet-map"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {regions && (
          <GeoJSON
            data={regions}
            style={regionStyle}
            onEachFeature={onEachRegion}
          />
        )}

        {provinces && (
          <GeoJSON
            data={provinces}
            style={provinceStyle}
            onEachFeature={onEachProvince}
          />
        )}

        {municipalities && (
          <GeoJSON
            data={municipalities}
            style={municipalityStyle}
            onEachFeature={
              onEachMunicipality
            }
          />
        )}

        {regions && (
          <FitPhilippinesBounds
            data={regions}
          />
        )}
      </MapContainer>

      {/* -------------------------------------------------
          TOP HEADER
      -------------------------------------------------- */}

      <div className="philippines-map-header">
        <div>
          <div className="map-eyebrow">
            FLOODGUARD
          </div>

          <h1>
            Philippines Flood Risk
          </h1>

          <p>
            Municipality-level monitoring
          </p>
        </div>

        <div className="map-status">
          <span className="status-dot" />
          SYSTEM ONLINE
        </div>
      </div>

      {/* -------------------------------------------------
          SELECTED MUNICIPALITY
      -------------------------------------------------- */}

      {selectedLocation && (
        <div className="municipality-card">
          <button
            type="button"
            className="municipality-close"
            aria-label="Close selected location"
            onClick={() =>
              setSelectedLocation(null)
            }
          >
            ×
          </button>

          <div className="card-eyebrow">
            SELECTED LOCATION
          </div>

          <h2>
            {selectedLocation}
          </h2>

          <div className="card-divider" />

          <div className="card-row">
            <span>
              Monitoring level
            </span>

            <strong>
              Municipality
            </strong>
          </div>

          <div className="card-row">
            <span>
              Current indicator
            </span>

            <strong>
              Weather-based
            </strong>
          </div>

          <div className="card-row">
            <span>
              Data status
            </span>

            <strong className="live-value">
              LIVE
            </strong>
          </div>

          <div className="card-note">
            Live weather and flood-risk data
            will be connected to this
            municipality in the next step.
          </div>
        </div>
      )}

      {/* -------------------------------------------------
          LEGEND
      -------------------------------------------------- */}

      <div className="philippines-legend">
        <div className="legend-title">
          FLOOD RISK INDICATOR
        </div>

        <LegendItem
          color="#16a34a"
          label="Low"
        />

        <LegendItem
          color="#eab308"
          label="Moderate"
        />

        <LegendItem
          color="#f97316"
          label="High"
        />

        <LegendItem
          color="#ef4444"
          label="Very High"
        />
      </div>

      {/* -------------------------------------------------
          MAP STATUS
      -------------------------------------------------- */}

      <div className="map-info">
        <span>
          PHILIPPINES
        </span>

        <span className="info-separator">
          |
        </span>

        <span>
          MUNICIPALITY MONITORING
        </span>
      </div>
    </div>
  );
}


/* =======================================================
   FIT WHOLE PHILIPPINES
   ======================================================= */

function FitPhilippinesBounds({
  data,
}: {
  data: GeoJSONData;
}) {
  const map = useMap();

  useEffect(() => {
    try {
      const layer =
        L.geoJSON(data as any);

      const bounds =
        layer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          paddingTopLeft: [
            40,
            120,
          ],

          paddingBottomRight: [
            40,
            80,
          ],

          maxZoom: 5.5,

          animate: false,
        });
      }
    } catch (error) {
      console.error(
        "MAP BOUNDS ERROR:",
        error
      );

      map.setView(
        PHILIPPINES_CENTER,
        5
      );
    }
  }, [data, map]);

  return null;
}


/* =======================================================
   LEGEND ITEM
   ======================================================= */

function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="legend-item">
      <span
        className="legend-color"
        style={{
          backgroundColor: color,
        }}
      />

      <span>{label}</span>
    </div>
  );
}


/* =======================================================
   GET FEATURE NAME
   ======================================================= */

function getFeatureName(
  feature?: Feature<
    Geometry,
    Properties
  >
): string {
  if (!feature?.properties) {
    return "";
  }

  const properties =
    feature.properties;

  /*
   * Common property names
   */
  const preferredKeys = [
    "name",
    "NAME",
    "Name",

    "municipality",
    "Municipality",
    "MUNICIPALITY",

    "municipality_name",
    "MunicipalityName",
    "MUNICIPALITY_NAME",

    "mun_name",
    "MUN_NAME",

    "city",
    "City",
    "CITY",

    "city_name",
    "CITY_NAME",

    "ADM3_EN",

    "province",
    "Province",
    "PROVINCE",

    "province_name",
    "PROVINCE_NAME",

    "region",
    "Region",
    "REGION",

    "region_name",
    "REGION_NAME",
  ];

  /*
   * First pass:
   * exact property names
   */
  for (const key of preferredKeys) {
    const value =
      properties[key];

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value.trim();
    }
  }

  /*
   * Second pass:
   * intelligently search property names
   */
  for (const [
    key,
    value,
  ] of Object.entries(properties)) {
    if (
      typeof value !== "string" ||
      value.trim().length === 0
    ) {
      continue;
    }

    const normalized =
      key.toLowerCase();

    if (
      normalized === "name" ||
      normalized.includes("municipality") ||
      normalized.includes("mun_name") ||
      normalized.includes("city_name") ||
      normalized.includes("adm3_en")
    ) {
      return value.trim();
    }
  }

  return "";
}


/* =======================================================
   TEMPORARY DEMONSTRATION RISK
   ======================================================= */

function getDemoRisk(
  name: string
): RiskResult {
  /*
   * IMPORTANT:
   *
   * These are temporary visual values.
   *
   * They are NOT real flood warnings.
   *
   * The next step will replace this with
   * live weather-based risk calculations.
   */

  const value =
    hashString(name) % 100;

  if (value < 45) {
    return {
      level: "Low",
      color: "#16a34a",
    };
  }

  if (value < 75) {
    return {
      level: "Moderate",
      color: "#eab308",
    };
  }

  if (value < 93) {
    return {
      level: "High",
      color: "#f97316",
    };
  }

  return {
    level: "Very High",
    color: "#ef4444",
  };
}


/* =======================================================
   SIMPLE DETERMINISTIC HASH
   ======================================================= */

function hashString(
  value: string
): number {
  let hash = 0;

  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    hash =
      (hash << 5) -
      hash +
      value.charCodeAt(i);

    hash |= 0;
  }

  return Math.abs(hash);
}