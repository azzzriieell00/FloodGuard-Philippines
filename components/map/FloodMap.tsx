"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  Map as LeafletMap,
  FeatureGroup,
} from "leaflet";

import "leaflet/dist/leaflet.css";
import "./FloodMap.css";

/* ============================================================
   TYPES
============================================================ */

type RiskLevel =
  | "Low"
  | "Moderate"
  | "High"
  | "Very High";

type MapFeature = {
  type: "Feature";
  properties?: Record<string, any>;
  geometry: any;
};

type GeoJSONData = {
  type: "FeatureCollection";
  features: MapFeature[];
};

type SelectedLocation = {
  name: string;
  risk: RiskLevel;
};


/* ============================================================
   RISK COLORS
============================================================ */

const RISK_COLORS: Record<
  RiskLevel,
  string
> = {
  Low: "#16a34a",
  Moderate: "#eab308",
  High: "#f97316",
  "Very High": "#ef4444",
};

const RISK_FILL_OPACITY = 0.78;


/* ============================================================
   NORMALIZE TEXT
============================================================ */

function normalizeText(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* ============================================================
   GET FEATURE NAME
============================================================ */

function getFeatureName(
  feature: MapFeature
): string {
  const properties =
    feature.properties || {};

  /*
   * Philippine administrative GeoJSON
   * files can use different property names.
   */

  const possibleNames = [
    properties.name,
    properties.NAME,

    properties.NAME_3,
    properties.NAME_2,
    properties.NAME_1,

    properties.NAMELONG,
    properties.NAMELSAD,

    properties.shapeName,
    properties.SHAPENAME,

    properties.MUNICIPALITY_NAME,
    properties.MUNICIPALITY,

    properties.MUNICITY_NAME,
    properties.MUNICITY,

    properties.CITY_NAME,
    properties.CITY,

    properties.ADM3_EN,
    properties.ADM3_NAME,
    properties.ADM3_REF,

    properties.ADM2_EN,
    properties.ADM2_NAME,
    properties.ADM2_REF,

    properties.BARANGAY,
    properties.BGY_NAME,

    properties.LOCALITY,
    properties.LOCATION,
  ];

  /*
   * First use known property names.
   */

  for (
    const value of possibleNames
  ) {
    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value.trim();
    }
  }

  /*
   * Fallback:
   *
   * Search ALL string properties.
   *
   * This is important for Manila because
   * different administrative datasets may
   * store the name under an unexpected field.
   */

  for (
    const value of Object.values(
      properties
    )
  ) {
    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      const normalized =
        normalizeText(value);

      if (
        normalized ===
          "manila" ||
        normalized.includes(
          "manila city"
        ) ||
        normalized.includes(
          "city of manila"
        )
      ) {
        return value.trim();
      }
    }
  }

  return "Unknown location";
}


/* ============================================================
   IS MANILA?
============================================================ */

function isManila(
  feature: MapFeature
): boolean {
  const properties =
    feature.properties || {};

  /*
   * Search every property rather than
   * depending on one specific field.
   */

  for (
    const value of Object.values(
      properties
    )
  ) {
    if (
      typeof value !== "string"
    ) {
      continue;
    }

    const normalized =
      normalizeText(value);

    if (
      normalized === "manila" ||
      normalized ===
        "manila city" ||
      normalized.includes(
        "city of manila"
      ) ||
      normalized.includes(
        "manila city"
      )
    ) {
      return true;
    }
  }

  /*
   * Also check the resolved feature name.
   */

  const name =
    normalizeText(
      getFeatureName(feature)
    );

  return (
    name === "manila" ||
    name === "manila city" ||
    name.includes(
      "city of manila"
    ) ||
    name.includes(
      "manila city"
    )
  );
}


/* ============================================================
   GET RISK LEVEL
============================================================ */

function getRiskLevel(
  feature: MapFeature
): RiskLevel {
  const properties =
    feature.properties || {};

  /*
   * Check if GeoJSON already contains
   * a risk value.
   */

  const possibleRisk =
    properties.riskLevel ??
    properties.risk_level ??
    properties.risk ??
    properties.Risk ??
    properties.RISK ??
    properties.floodRisk ??
    properties.flood_risk ??
    properties.floodRiskLevel ??
    properties.FloodRiskLevel;


  /* ----------------------------------------------------------
     STRING RISK
  ---------------------------------------------------------- */

  if (
    typeof possibleRisk ===
    "string"
  ) {
    const value =
      normalizeText(
        possibleRisk
      );

    if (
      value === "very high" ||
      value === "very high risk" ||
      value === "critical"
    ) {
      return "Very High";
    }

    if (
      value === "high" ||
      value === "high risk"
    ) {
      return "High";
    }

    if (
      value === "moderate" ||
      value === "medium" ||
      value === "moderate risk"
    ) {
      return "Moderate";
    }

    if (
      value === "low" ||
      value === "low risk"
    ) {
      return "Low";
    }
  }


  /* ----------------------------------------------------------
     NUMERIC RISK
  ---------------------------------------------------------- */

  if (
    typeof possibleRisk ===
      "number" &&
    Number.isFinite(
      possibleRisk
    )
  ) {
    /*
     * Supports both:
     *
     * 0-100
     *
     * and
     *
     * 0-1
     */

    const value =
      possibleRisk <= 1
        ? possibleRisk * 100
        : possibleRisk;

    if (value >= 61) {
      return "Very High";
    }

    if (value >= 41) {
      return "High";
    }

    if (value >= 21) {
      return "Moderate";
    }

    return "Low";
  }


  /* ----------------------------------------------------------
     MANILA VISUAL FALLBACK
  ---------------------------------------------------------- */

  /*
   * Your current project does not yet have
   * live municipality-level flood data.
   *
   * We therefore keep Manila visible as
   * Moderate for the dashboard design.
   *
   * This will later be replaced with real
   * Manila risk data.
   */

  if (
    isManila(feature)
  ) {
    return "Moderate";
  }


  /* ----------------------------------------------------------
     DEFAULT
  ---------------------------------------------------------- */

  return "Low";
}


/* ============================================================
   FEATURE STYLE
============================================================ */

function getFeatureStyle(
  feature: MapFeature
) {
  const risk =
    getRiskLevel(feature);

  return {
    color: "#b8c7d9",

    weight: 0.65,

    opacity: 0.9,

    fillColor:
      RISK_COLORS[risk],

    fillOpacity:
      RISK_FILL_OPACITY,
  };
}


/* ============================================================
   COMPONENT
============================================================ */

export default function FloodMapClient() {

  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const mapRef =
    useRef<LeafletMap | null>(
      null
    );

  const layersRef =
    useRef<FeatureGroup | null>(
      null
    );

  const philippinesBoundsRef =
    useRef<any>(null);

  const [
    selectedLocation,
    setSelectedLocation,
  ] =
    useState<SelectedLocation | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  /* ==========================================================
     INITIALIZE
  ========================================================== */

  useEffect(() => {

    let cancelled =
      false;

    async function initialize() {

      if (
        !mapContainerRef.current
      ) {
        return;
      }

      if (
        mapRef.current
      ) {
        return;
      }


      try {

        setLoading(true);
        setError(null);


        /*
         * IMPORTANT:
         *
         * Leaflet is dynamically imported
         * inside useEffect.
         *
         * Therefore Next.js never tries to
         * execute Leaflet on the server.
         */

        const L =
          await import(
            "leaflet"
          );


        if (
          cancelled ||
          !mapContainerRef.current
        ) {
          return;
        }


        /* ====================================================
           CREATE MAP
        ==================================================== */

        const map =
          L.map(
            mapContainerRef.current,
            {
              zoomControl:
                false,

              attributionControl:
                true,

              minZoom:
                5,

              maxZoom:
                12,

              preferCanvas:
                true,

              worldCopyJump:
                false,
            }
          );


        mapRef.current =
          map;


        /* ====================================================
           DARK BASEMAP
        ==================================================== */

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; OpenStreetMap contributors &copy; CARTO',

            subdomains:
              "abcd",

            maxZoom:
              20,
          }
        ).addTo(map);


        /* ====================================================
           INITIAL PHILIPPINES VIEW
        ==================================================== */

        map.setView(
          [
            12.8797,
            121.774,
          ],
          6
        );


        /* ====================================================
           FEATURE GROUP
        ==================================================== */

        const layerGroup =
          L.featureGroup()
            .addTo(map);

        layersRef.current =
          layerGroup;


        /* ====================================================
           LOAD DATASETS
        ==================================================== */

        const files = [
          "/geojson/philippines-municipalities.geojson",

          "/geojson/philippines-component-cities.geojson",

          "/geojson/philippines-huc.geojson",

          "/geojson/philippines-icc.geojson",
        ];


        const responses =
          await Promise.all(
            files.map(
              async (
                file
              ) => {

                const response =
                  await fetch(
                    file,
                    {
                      cache:
                        "no-store",
                    }
                  );


                if (
                  !response.ok
                ) {
                  throw new Error(
                    `Unable to load ${file}. HTTP ${response.status}`
                  );
                }


                return response.json();
              }
            )
          );


        if (
          cancelled
        ) {
          return;
        }


        const datasets =
          responses as GeoJSONData[];


        /* ====================================================
           DATASET COUNTS
        ==================================================== */

        datasets.forEach(
          (
            dataset,
            index
          ) => {

            console.log(
              files[index],
              "features:",
              Array.isArray(
                dataset.features
              )
                ? dataset
                    .features
                    .length
                : 0
            );

          }
        );


        /* ====================================================
           COMBINE FEATURES
        ==================================================== */

        const allFeatures =
          datasets.flatMap(
            (
              dataset
            ) =>
              Array.isArray(
                dataset.features
              )
                ? dataset.features
                : []
          );


        console.log(
          "TOTAL PHILIPPINES FEATURES:",
          allFeatures.length
        );


        /* ====================================================
           REMOVE INVALID FEATURES
        ==================================================== */

        const validFeatures =
          allFeatures.filter(
            (
              feature
            ) =>
              feature &&
              feature.geometry
          );


        console.log(
          "VALID PHILIPPINES FEATURES:",
          validFeatures.length
        );


        /* ====================================================
           REMOVE EXACT DUPLICATES
        ==================================================== */

        const uniqueFeatures =
          new Map<
            string,
            MapFeature
          >();


        for (
          const feature of validFeatures
        ) {

          const name =
            getFeatureName(
              feature
            );


          /*
           * Use geometry + name.
           *
           * This prevents duplicated
           * administrative datasets from
           * drawing the same polygon twice.
           */

          const key =
            `${normalizeText(name)}|${JSON.stringify(
              feature.geometry
            )}`;


          if (
            !uniqueFeatures.has(
              key
            )
          ) {
            uniqueFeatures.set(
              key,
              feature
            );
          }

        }


        const uniqueFeatureList =
          Array.from(
            uniqueFeatures.values()
          );


        console.log(
          "UNIQUE PHILIPPINES FEATURES:",
          uniqueFeatureList.length
        );


        /* ====================================================
           FIND MANILA
        ==================================================== */

        const manilaFeatures =
          uniqueFeatureList.filter(
            (
              feature
            ) =>
              isManila(
                feature
              )
          );


        console.log(
          "MANILA FEATURES FOUND:",
          manilaFeatures.length
        );


        /*
         * We no longer generate a scary
         * warning if the source happens to
         * call Manila something unexpected.
         *
         * We only report it for debugging.
         */

        if (
          manilaFeatures.length > 0
        ) {

          console.log(
            "MANILA FEATURE FOUND:",
            manilaFeatures[0]
              .properties
          );

        } else {

          console.warn(
            "Manila was not identified by name fields. The map will still render all supplied features."
          );

        }


        /* ====================================================
           DRAW FEATURES
        ==================================================== */

        for (
          const feature of uniqueFeatureList
        ) {

          if (
            cancelled
          ) {
            break;
          }


          const name =
            getFeatureName(
              feature
            );


          const risk =
            getRiskLevel(
              feature
            );


          const style =
            getFeatureStyle(
              feature
            );


          const layer =
            L.geoJSON(
              feature as any,
              {
                style,

                onEachFeature:
                  (
                    _feature,
                    featureLayer
                  ) => {

                    const path =
                      featureLayer as any;


                    /* ======================================
                       HOVER
                    ====================================== */

                    path.on(
                      "mouseover",
                      () => {

                        path.setStyle(
                          {
                            weight:
                              2,

                            color:
                              "#ffffff",

                            opacity:
                              1,

                            fillOpacity:
                              0.94,
                          }
                        );


                        if (
                          typeof path.bringToFront ===
                          "function"
                        ) {
                          path.bringToFront();
                        }

                      }
                    );


                    /* ======================================
                       MOUSE OUT
                    ====================================== */

                    path.on(
                      "mouseout",
                      () => {

                        path.setStyle(
                          style
                        );

                      }
                    );


                    /* ======================================
                       CLICK
                    ====================================== */

                    path.on(
                      "click",
                      () => {

                        setSelectedLocation(
                          {
                            name,

                            risk,
                          }
                        );

                        /*
                         * Fit the selected
                         * municipality/city.
                         *
                         * We create a temporary
                         * GeoJSON layer so we don't
                         * rely on LayerGroup.getBounds().
                         */

                        try {

                          const bounds =
                            L.geoJSON(
                              feature as any
                            ).getBounds();


                          if (
                            bounds.isValid()
                          ) {

                            map.fitBounds(
                              bounds,
                              {
                                padding:
                                  [
                                    100,
                                    100,
                                  ],

                                maxZoom:
                                  11,

                                animate:
                                  true,
                              }
                            );

                          }

                        } catch (
                          boundsError
                        ) {

                          console.warn(
                            "Unable to zoom to selected location:",
                            boundsError
                          );

                        }


                        /*
                         * Tell the rest of the
                         * dashboard which location
                         * was selected.
                         */

                        window.dispatchEvent(
                          new CustomEvent(
                            "floodguard-location-selected",
                            {
                              detail: {
                                name,

                                risk,
                              },
                            }
                          )
                        );

                      }
                    );


                    /* ======================================
                       TOOLTIP
                    ====================================== */

                    path.bindTooltip(
                      name,
                      {
                        direction:
                          "top",

                        sticky:
                          true,

                        opacity:
                          0.95,

                        className:
                          "floodguard-tooltip",
                      }
                    );

                  },
              }
            );


          layerGroup.addLayer(
            layer
          );

        }


        /* ====================================================
           CHECK MAP LAYER COUNT
        ==================================================== */

        console.log(
          "MAP LAYERS:",
          layerGroup
            .getLayers()
            .length
        );


        /* ====================================================
           FIT ENTIRE PHILIPPINES
        ==================================================== */

        const bounds =
          layerGroup.getBounds();


        if (
          bounds.isValid()
        ) {

          philippinesBoundsRef.current =
            bounds;


          map.fitBounds(
            bounds,
            {
              padding:
                [
                  80,
                  80,
                ],

              maxZoom:
                7,

              animate:
                false,
            }
          );

        }


        /* ====================================================
           HOME EVENT
        ==================================================== */

        const handleHome =
          () => {

            const philippinesBounds =
              philippinesBoundsRef.current;


            if (
              philippinesBounds &&
              philippinesBounds.isValid()
            ) {

              map.fitBounds(
                philippinesBounds,
                {
                  padding:
                    [
                      80,
                      80,
                    ],

                  maxZoom:
                    7,

                  animate:
                    true,
                }
              );

            }

          };


        /* ====================================================
           ZOOM IN
        ==================================================== */

        const handleZoomIn =
          () => {
            map.zoomIn();
          };


        /* ====================================================
           ZOOM OUT
        ==================================================== */

        const handleZoomOut =
          () => {
            map.zoomOut();
          };


        /* ====================================================
           REGISTER EVENTS
        ==================================================== */

        window.addEventListener(
          "floodguard-map-home",
          handleHome
        );

        window.addEventListener(
          "floodguard-map-zoom-in",
          handleZoomIn
        );

        window.addEventListener(
          "floodguard-map-zoom-out",
          handleZoomOut
        );


        /* ====================================================
           MAP RESIZE
        ==================================================== */

        const resizeTimer =
          window.setTimeout(
            () => {

              if (
                mapRef.current
              ) {

                mapRef.current.invalidateSize(
                  true
                );

              }

            },
            300
          );


        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }


        /* ====================================================
           CLEANUP EVENTS
        ==================================================== */

        return () => {

          window.removeEventListener(
            "floodguard-map-home",
            handleHome
          );

          window.removeEventListener(
            "floodguard-map-zoom-in",
            handleZoomIn
          );

          window.removeEventListener(
            "floodguard-map-zoom-out",
            handleZoomOut
          );

          window.clearTimeout(
            resizeTimer
          );

        };

      } catch (
        err
      ) {

        console.error(
          "PHILIPPINES MAP ERROR:",
          err
        );


        if (
          !cancelled
        ) {

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load Philippines map."
          );

          setLoading(
            false
          );

        }

      }

    }


    const cleanupPromise =
      initialize();


    /*
     * Cleanup when component
     * unmounts.
     */

    return () => {

      cancelled =
        true;


      void cleanupPromise;


      if (
        mapRef.current
      ) {

        mapRef.current.remove();

        mapRef.current =
          null;

      }


      layersRef.current =
        null;

      philippinesBoundsRef.current =
        null;

    };

  }, []);


  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="flood-map-wrapper">

      {/* ======================================================
          MAP
      ====================================================== */}

      <div
        ref={mapContainerRef}
        className="flood-map"
      />


      {/* ======================================================
          LOADING
      ====================================================== */}

      {loading && (
        <div className="map-loading">

          <div className="map-loading-spinner" />

          <span>
            Loading Philippine
            municipalities...
          </span>

        </div>
      )}


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="map-error">

          <strong>
            Map data error
          </strong>

          <span>
            {error}
          </span>

        </div>
      )}


      {/* ======================================================
          SELECTED LOCATION
      ====================================================== */}

      {selectedLocation && (
        <div className="map-location-card">

          <button
            type="button"
            className="map-location-close"
            onClick={() =>
              setSelectedLocation(
                null
              )
            }
            aria-label="Close selected location"
          >
            ×
          </button>


          <div className="map-location-label">
            SELECTED LOCATION
          </div>


          <h3>
            {selectedLocation.name}
          </h3>


          <div className="map-location-risk">

            <span
              style={{
                background:
                  RISK_COLORS[
                    selectedLocation
                      .risk
                  ],
              }}
            />

            {selectedLocation.risk}

          </div>

        </div>
      )}

    </div>
  );
}