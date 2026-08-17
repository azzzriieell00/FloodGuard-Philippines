import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   TYPES
============================================================ */

type LocationInput = {
  id?: string;
  name?: string;
  latitude: number;
  longitude: number;
};

type OpenMeteoCurrent = {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  rain?: number;
  wind_speed_10m?: number;
  weather_code?: number;
};

type OpenMeteoHourly = {
  precipitation_probability?: number[];
};

type OpenMeteoResponse = {
  latitude?: number;
  longitude?: number;
  current?: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
  error?: boolean;
  reason?: string;
};

type WeatherResult = {
  id: string;
  name: string;

  latitude: number;
  longitude: number;

  precipitation: number;
  rain: number;
  precipitationProbability: number;

  windSpeed: number;
  humidity: number;
  temperature: number;
  weatherCode: number;

  riskScore: number;

  riskLevel:
    | "Low"
    | "Moderate"
    | "High"
    | "Very High"
    | "Critical";

  weatherUnavailable?: boolean;
};

/* ============================================================
   CONFIGURATION
============================================================ */

/*
 * Cache weather for 10 minutes.
 *
 * The map does NOT need to call Open-Meteo every few seconds.
 */

const CACHE_DURATION = 10 * 60 * 1000;

/*
 * Open-Meteo rate-limit cooldown.
 *
 * When a 429 is received, do not immediately try again.
 */

const RATE_LIMIT_COOLDOWN = 70 * 1000;

/*
 * Maximum coordinates per Open-Meteo request.
 *
 * Open-Meteo supports comma-separated coordinates.
 */

const BATCH_SIZE = 100;

/*
 * Small delay between successful batches.
 */

const BATCH_DELAY = 1500;

/* ============================================================
   SERVER CACHE
============================================================ */

/*
 * Cache is keyed by the requested location set.
 *
 * This is safer than one global cache because a request
 * for Aklan cannot accidentally receive another dataset.
 */

type WeatherCacheEntry = {
  locationsKey: string;
  results: WeatherResult[];
  updatedAt: number;
};

const weatherCaches =
  new Map<string, WeatherCacheEntry>();

/*
 * Each location set gets its own active request.
 *
 * This prevents duplicate requests when multiple components
 * ask for the same weather data at the same time.
 */

const activeRequests =
  new Map<string, Promise<WeatherResult[]>>();

/*
 * Open-Meteo cooldown is global because the provider
 * can rate-limit the application.
 */

let rateLimitedUntil = 0;

/* ============================================================
   CLEAN OLD CACHE
============================================================ */

function cleanupCaches() {
  const now = Date.now();

  for (const [
    key,
    cache,
  ] of weatherCaches.entries()) {
    if (
      now - cache.updatedAt >
      CACHE_DURATION * 3
    ) {
      weatherCaches.delete(key);
    }
  }
}

/* ============================================================
   NUMBER HELPER
============================================================ */

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

/* ============================================================
   RISK SCORE
============================================================ */

/*
 * IMPORTANT:
 *
 * This is WEATHER-DERIVED FLOOD RISK.
 *
 * It does NOT mean Open-Meteo has confirmed flooding.
 *
 * It estimates risk from:
 *
 * - precipitation
 * - rain
 * - precipitation probability
 * - humidity
 * - weather condition
 * - wind
 */

function calculateRiskScore(
  weather: OpenMeteoCurrent,
  precipitationProbability: number
): number {
  const precipitation =
    safeNumber(
      weather.precipitation
    );

  const rain =
    safeNumber(
      weather.rain
    );

  const probability =
    safeNumber(
      precipitationProbability
    );

  const wind =
    safeNumber(
      weather.wind_speed_10m
    );

  const humidity =
    safeNumber(
      weather.relative_humidity_2m
    );

  const weatherCode =
    safeNumber(
      weather.weather_code
    );

  let score = 0;

  /* ----------------------------------------------------------
     PRECIPITATION
  ---------------------------------------------------------- */

  if (precipitation >= 50) {
    score += 45;
  } else if (precipitation >= 30) {
    score += 35;
  } else if (precipitation >= 20) {
    score += 28;
  } else if (precipitation >= 10) {
    score += 18;
  } else if (precipitation >= 5) {
    score += 10;
  } else if (precipitation > 0) {
    score += 4;
  }

  /* ----------------------------------------------------------
     RAIN
  ---------------------------------------------------------- */

  if (rain >= 30) {
    score += 25;
  } else if (rain >= 20) {
    score += 20;
  } else if (rain >= 10) {
    score += 14;
  } else if (rain >= 5) {
    score += 8;
  } else if (rain > 0) {
    score += 3;
  }

  /* ----------------------------------------------------------
     PRECIPITATION PROBABILITY
  ---------------------------------------------------------- */

  if (probability >= 90) {
    score += 15;
  } else if (probability >= 75) {
    score += 12;
  } else if (probability >= 50) {
    score += 8;
  } else if (probability >= 30) {
    score += 4;
  }

  /* ----------------------------------------------------------
     HUMIDITY
  ---------------------------------------------------------- */

  if (humidity >= 90) {
    score += 5;
  } else if (humidity >= 80) {
    score += 3;
  }

  /* ----------------------------------------------------------
     WMO WEATHER CODE
  ---------------------------------------------------------- */

  /*
   * 51-57  drizzle
   * 61-67  rain
   * 80-82  rain showers
   * 95-99  thunderstorms
   */

  if (
    weatherCode >= 51 &&
    weatherCode <= 57
  ) {
    score += 5;
  }

  if (
    weatherCode >= 61 &&
    weatherCode <= 67
  ) {
    score += 10;
  }

  if (
    weatherCode >= 80 &&
    weatherCode <= 82
  ) {
    score += 15;
  }

  if (
    weatherCode === 95 ||
    weatherCode === 96 ||
    weatherCode === 99
  ) {
    score += 20;
  }

  /* ----------------------------------------------------------
     WIND
  ---------------------------------------------------------- */

  if (wind >= 60) {
    score += 10;
  } else if (wind >= 40) {
    score += 7;
  } else if (wind >= 25) {
    score += 4;
  }

  return Math.max(
    0,
    Math.min(
      Math.round(score),
      100
    )
  );
}

/* ============================================================
   RISK LEVEL
============================================================ */

function getRiskLevel(
  score: number
):
  | "Low"
  | "Moderate"
  | "High"
  | "Very High"
  | "Critical" {
  if (score >= 81) {
    return "Critical";
  }

  if (score >= 61) {
    return "Very High";
  }

  if (score >= 41) {
    return "High";
  }

  if (score >= 21) {
    return "Moderate";
  }

  return "Low";
}

/* ============================================================
   LOCATION KEY
============================================================ */

function createLocationsKey(
  locations: LocationInput[]
): string {
  return locations
    .map((location) => {
      const lat =
        safeNumber(
          location.latitude
        ).toFixed(4);

      const lon =
        safeNumber(
          location.longitude
        ).toFixed(4);

      const id =
        String(
          location.id ?? ""
        );

      return `${id}:${lat},${lon}`;
    })
    .sort()
    .join("|");
}

/* ============================================================
   NORMALIZE OPEN-METEO RESPONSE
============================================================ */

function normalizeOpenMeteoResponse(
  data:
    | OpenMeteoResponse
    | OpenMeteoResponse[]
): OpenMeteoResponse[] {
  if (Array.isArray(data)) {
    return data;
  }

  return [data];
}

/* ============================================================
   FETCH WEATHER
============================================================ */

async function fetchWeather(
  locations: LocationInput[]
): Promise<OpenMeteoResponse[]> {
  if (
    locations.length === 0
  ) {
    return [];
  }

  const latitudes =
    locations
      .map((location) =>
        safeNumber(
          location.latitude
        )
      )
      .join(",");

  const longitudes =
    locations
      .map((location) =>
        safeNumber(
          location.longitude
        )
      )
      .join(",");

  const url =
    new URL(
      "https://api.open-meteo.com/v1/forecast"
    );

  url.searchParams.set(
    "latitude",
    latitudes
  );

  url.searchParams.set(
    "longitude",
    longitudes
  );

  /*
   * CURRENT WEATHER
   */

  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "wind_speed_10m",
      "weather_code",
    ].join(",")
  );

  /*
   * PRECIPITATION PROBABILITY IS HOURLY.
   */

  url.searchParams.set(
    "hourly",
    "precipitation_probability"
  );

  /*
   * Only retrieve the next hour.
   *
   * This keeps the response smaller.
   */

  url.searchParams.set(
    "forecast_hours",
    "1"
  );

  /*
   * Philippine local time.
   */

  url.searchParams.set(
    "timezone",
    "Asia/Manila"
  );

  console.log(
    "OPEN-METEO REQUEST:",
    locations.length,
    "locations"
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",

        cache:
          "no-store",

        headers: {
          Accept:
            "application/json",
        },
      }
    );

  /* ==========================================================
     RATE LIMIT
  ========================================================== */

  if (
    response.status === 429
  ) {
    const text =
      await response.text();

    console.error(
      "OPEN-METEO RATE LIMIT:",
      text
    );

    rateLimitedUntil =
      Date.now() +
      RATE_LIMIT_COOLDOWN;

    throw new Error(
      "OPEN_METEO_RATE_LIMIT"
    );
  }

  /* ==========================================================
     OTHER API ERROR
  ========================================================== */

  if (
    !response.ok
  ) {
    const text =
      await response.text();

    console.error(
      "OPEN-METEO ERROR:",
      response.status,
      text
    );

    throw new Error(
      `OPEN_METEO_HTTP_${response.status}`
    );
  }

  const data =
    (await response.json()) as
      | OpenMeteoResponse
      | OpenMeteoResponse[];

  return normalizeOpenMeteoResponse(
    data
  );
}

/* ============================================================
   WAIT
============================================================ */

function wait(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

/* ============================================================
   CREATE UNAVAILABLE RESULT
============================================================ */

function createUnavailableResult(
  location: LocationInput
): WeatherResult {
  return {
    id:
      location.id ||
      `${location.latitude}-${location.longitude}`,

    name:
      location.name ||
      "Unknown location",

    latitude:
      safeNumber(
        location.latitude
      ),

    longitude:
      safeNumber(
        location.longitude
      ),

    precipitation: 0,

    rain: 0,

    precipitationProbability: 0,

    windSpeed: 0,

    humidity: 0,

    temperature: 0,

    weatherCode: 0,

    riskScore: 0,

    /*
     * IMPORTANT:
     *
     * We don't claim Low when the API failed.
     *
     * The frontend can keep the previous/static
     * municipality risk instead.
     */

    riskLevel:
      "Low",

    weatherUnavailable:
      true,
  };
}

/* ============================================================
   LOAD ALL WEATHER
============================================================ */

async function loadAllWeather(
  locations: LocationInput[]
): Promise<WeatherResult[]> {
  const batches:
    LocationInput[][] = [];

  for (
    let index = 0;
    index < locations.length;
    index += BATCH_SIZE
  ) {
    batches.push(
      locations.slice(
        index,
        index + BATCH_SIZE
      )
    );
  }

  console.log(
    "LIVE WEATHER:",
    locations.length,
    "locations"
  );

  console.log(
    "LIVE WEATHER BATCHES:",
    batches.length
  );

  const allResults:
    WeatherResult[] = [];

  for (
    let batchIndex = 0;
    batchIndex <
    batches.length;
    batchIndex++
  ) {
    const batch =
      batches[batchIndex];

    console.log(
      `LIVE WEATHER BATCH ${
        batchIndex + 1
      }/${batches.length}`
    );

    /*
     * NEVER continue requesting after a rate limit.
     */

    if (
      Date.now() <
      rateLimitedUntil
    ) {
      throw new Error(
        "OPEN_METEO_RATE_LIMIT"
      );
    }

    try {
      const weatherData =
        await fetchWeather(
          batch
        );

      /*
       * Open-Meteo normally returns one response
       * for every requested coordinate.
       */

      for (
        let index = 0;
        index < batch.length;
        index++
      ) {
        const location =
          batch[index];

        const weather =
          weatherData[index];

        /*
         * If Open-Meteo somehow doesn't return
         * this coordinate, mark it unavailable.
         */

        if (!weather) {
          allResults.push(
            createUnavailableResult(
              location
            )
          );

          continue;
        }

        const current =
          weather.current ?? {};

        const hourly =
          weather.hourly ?? {};

        const probability =
          safeNumber(
            hourly
              .precipitation_probability?.[0],
            0
          );

        const riskScore =
          calculateRiskScore(
            current,
            probability
          );

        const riskLevel =
          getRiskLevel(
            riskScore
          );

        allResults.push({
          id:
            location.id ||
            `${location.latitude}-${location.longitude}`,

          name:
            location.name ||
            "Unknown location",

          latitude:
            safeNumber(
              location.latitude
            ),

          longitude:
            safeNumber(
              location.longitude
            ),

          precipitation:
            safeNumber(
              current.precipitation
            ),

          rain:
            safeNumber(
              current.rain
            ),

          precipitationProbability:
            probability,

          windSpeed:
            safeNumber(
              current.wind_speed_10m
            ),

          humidity:
            safeNumber(
              current.relative_humidity_2m
            ),

          temperature:
            safeNumber(
              current.temperature_2m
            ),

          weatherCode:
            safeNumber(
              current.weather_code
            ),

          riskScore,

          riskLevel,

          weatherUnavailable:
            false,
        });
      }

      /*
       * Wait between successful batches.
       */

      if (
        batchIndex <
        batches.length - 1
      ) {
        await wait(
          BATCH_DELAY
        );
      }
    } catch (
      error
    ) {
      console.error(
        `LIVE WEATHER BATCH ${
          batchIndex + 1
        } FAILED:`,
        error
      );

      /*
       * STOP IMMEDIATELY ON 429.
       *
       * Do NOT continue to batch 16/17.
       */

      if (
        error instanceof Error &&
        error.message ===
          "OPEN_METEO_RATE_LIMIT"
      ) {
        throw error;
      }

      /*
       * For non-rate-limit errors, mark
       * this batch unavailable.
       */

      for (
        const location of batch
      ) {
        allResults.push(
          createUnavailableResult(
            location
          )
        );
      }
    }
  }

  return allResults;
}

/* ============================================================
   JSON RESPONSE HELPERS
============================================================ */

function successResponse(
  results: WeatherResult[],
  requested: number,
  options?: {
    cached?: boolean;
    rateLimited?: boolean;
    joined?: boolean;
    updatedAt?: number;
  }
) {
  return NextResponse.json(
    {
      success: true,

      source:
        "Open-Meteo",

      region:
        "Philippines",

      results,

      requested,

      returned:
        results.length,

      cached:
        options?.cached ??
        false,

      rateLimited:
        options?.rateLimited ??
        false,

      joined:
        options?.joined ??
        false,

      updatedAt:
        new Date(
          options?.updatedAt ??
            Date.now()
        ).toISOString(),
    },
    {
      status: 200,

      headers: {
        "Cache-Control":
          "private, max-age=60",
      },
    }
  );
}

/* ============================================================
   POST
============================================================ */

export async function POST(
  request: NextRequest
) {
  try {
    cleanupCaches();

    const body =
      await request.json();

    if (
      !body ||
      !Array.isArray(
        body.locations
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Request must contain a locations array.",
        },
        {
          status: 400,
        }
      );
    }

    const inputLocations =
      body.locations as LocationInput[];

    /*
     * Validate coordinates.
     */

    const validLocations =
      inputLocations.filter(
        (location) => {
          const latitude =
            Number(
              location.latitude
            );

          const longitude =
            Number(
              location.longitude
            );

          return (
            Number.isFinite(
              latitude
            ) &&
            Number.isFinite(
              longitude
            ) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180
          );
        }
      );

    if (
      validLocations.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "No valid latitude/longitude locations were supplied.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent accidental duplicate coordinates.
     */

    const uniqueMap =
      new Map<string, LocationInput>();

    for (
      const location of
        validLocations
    ) {
      const key =
        `${safeNumber(
          location.latitude
        ).toFixed(
          5
        )},${safeNumber(
          location.longitude
        ).toFixed(
          5
        )}`;

      if (
        !uniqueMap.has(key)
      ) {
        uniqueMap.set(
          key,
          location
        );
      }
    }

    const locations =
      Array.from(
        uniqueMap.values()
      );

    const locationsKey =
      createLocationsKey(
        locations
      );

    /* ========================================================
       CACHE HIT
    ======================================================== */

    const cached =
      weatherCaches.get(
        locationsKey
      );

    if (
      cached &&
      Date.now() -
        cached.updatedAt <
        CACHE_DURATION
    ) {
      console.log(
        "LIVE WEATHER CACHE HIT:",
        cached.results.length
      );

      return successResponse(
        cached.results,
        locations.length,
        {
          cached: true,

          updatedAt:
            cached.updatedAt,
        }
      );
    }

    /* ========================================================
       ACTIVE REQUEST
    ======================================================== */

    const existingRequest =
      activeRequests.get(
        locationsKey
      );

    if (
      existingRequest
    ) {
      console.log(
        "LIVE WEATHER REQUEST JOINED"
      );

      try {
        const results =
          await existingRequest;

        const cache =
          weatherCaches.get(
            locationsKey
          );

        return successResponse(
          results,
          locations.length,
          {
            joined: true,

            cached: Boolean(
              cache
            ),

            updatedAt:
              cache?.updatedAt ??
              Date.now(),
          }
        );
      } catch (
        error
      ) {
        /*
         * Let the original request
         * handle the error.
         */

        throw error;
      }
    }

    /* ========================================================
       RATE LIMIT COOLDOWN
    ======================================================== */

    if (
      Date.now() <
      rateLimitedUntil
    ) {
      const remaining =
        Math.max(
          1,
          Math.ceil(
            (
              rateLimitedUntil -
              Date.now()
            ) / 1000
          )
        );

      console.warn(
        `LIVE WEATHER: Open-Meteo rate limited. ${remaining}s remaining.`
      );

      /*
       * Return matching old cache if available.
       */

      if (
        cached
      ) {
        return successResponse(
          cached.results,
          locations.length,
          {
            cached: true,

            rateLimited: true,

            updatedAt:
              cached.updatedAt,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,

          source:
            "Open-Meteo",

          error:
            "Open-Meteo is temporarily rate limited.",

          retryAfter:
            remaining,
        },
        {
          status: 429,

          headers: {
            "Retry-After":
              String(
                remaining
              ),
          },
        }
      );
    }

    /* ========================================================
       START REQUEST
    ======================================================== */

    console.log(
      "LIVE WEATHER REQUEST STARTED:",
      locations.length,
      "locations"
    );

    const requestPromise =
      loadAllWeather(
        locations
      );

    activeRequests.set(
      locationsKey,
      requestPromise
    );

    try {
      const results =
        await requestPromise;

      /*
       * Save only if we received useful results.
       */

      if (
        results.length > 0
      ) {
        const updatedAt =
          Date.now();

        weatherCaches.set(
          locationsKey,
          {
            locationsKey,

            results,

            updatedAt,
          }
        );

        console.log(
          "LIVE WEATHER CACHE UPDATED:",
          results.length,
          "locations"
        );

        return successResponse(
          results,
          locations.length,
          {
            cached: false,

            updatedAt,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,

          error:
            "Open-Meteo returned no weather results.",
        },
        {
          status: 502,
        }
      );
    } catch (
      error
    ) {
      /*
       * RATE LIMITED
       */

      if (
        error instanceof Error &&
        error.message ===
          "OPEN_METEO_RATE_LIMIT"
      ) {
        /*
         * If matching old cache exists,
         * use it.
         */

        if (
          cached
        ) {
          return successResponse(
            cached.results,
            locations.length,
            {
              cached: true,

              rateLimited:
                true,

              updatedAt:
                cached.updatedAt,
            }
          );
        }

        const remaining =
          Math.max(
            1,
            Math.ceil(
              (
                rateLimitedUntil -
                Date.now()
              ) / 1000
            )
          );

        return NextResponse.json(
          {
            success: false,

            source:
              "Open-Meteo",

            error:
              "Open-Meteo rate limit reached.",

            retryAfter:
              remaining,
          },
          {
            status: 429,

            headers: {
              "Retry-After":
                String(
                  remaining
                ),
            },
          }
        );
      }

      console.error(
        "LIVE WEATHER ROUTE ERROR:",
        error
      );

      /*
       * Old cache is safer than destroying
       * the map's existing weather state.
       */

      if (
        cached
      ) {
        return successResponse(
          cached.results,
          locations.length,
          {
            cached: true,

            updatedAt:
              cached.updatedAt,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,

          error:
            error instanceof Error
              ? error.message
              : "Unable to retrieve live weather data.",
        },
        {
          status: 502,
        }
      );
    } finally {
      /*
       * Remove ONLY this location set's
       * active request.
       */

      activeRequests.delete(
        locationsKey
      );
    }
  } catch (
    error
  ) {
    console.error(
      "LIVE WEATHER ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to process weather request.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ============================================================
   GET
============================================================ */

export async function GET() {
  cleanupCaches();

  const now =
    Date.now();

  const rateLimited =
    now < rateLimitedUntil;

  const remaining =
    rateLimited
      ? Math.ceil(
          (
            rateLimitedUntil -
            now
          ) / 1000
        )
      : 0;

  return NextResponse.json(
    {
      success: true,

      service:
        "FloodGuard Live Weather",

      provider:
        "Open-Meteo",

      status:
        rateLimited
          ? "rate-limited"
          : "online",

      cacheDuration:
        "10 minutes",

      rateLimited,

      retryAfter:
        remaining,

      message:
        "Use POST /api/live-weather with a locations array.",
    },
    {
      status: 200,
    }
  );
}