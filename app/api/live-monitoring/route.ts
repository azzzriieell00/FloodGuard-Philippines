import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Municipality = {
  name: string;
  lat: number;
  lon: number;
};

type MunicipalityWeather = Municipality & {
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  rain: number | null;
  showers: number | null;
  weatherCode: number | null;
  windSpeed: number | null;

  liveLevel: "Low" | "Moderate" | "High" | "Very High";

  updatedAt: string;
};

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    rain?: number;
    showers?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
};

/*
|--------------------------------------------------------------------------
| Aklan Municipalities
|--------------------------------------------------------------------------
| Coordinates are municipality reference points.
|
| These are used to request live weather conditions from Open-Meteo.
|--------------------------------------------------------------------------
*/

const MUNICIPALITIES: Municipality[] = [
  {
    name: "Altavas",
    lat: 11.5278,
    lon: 122.6155,
  },
  {
    name: "Balete",
    lat: 11.6472,
    lon: 122.3899,
  },
  {
    name: "Banga",
    lat: 11.6381,
    lon: 122.3406,
  },
  {
    name: "Batan",
    lat: 11.5844,
    lon: 122.5006,
  },
  {
    name: "Buruanga",
    lat: 11.8447,
    lon: 122.1003,
  },
  {
    name: "Ibajay",
    lat: 11.7111,
    lon: 122.1685,
  },
  {
    name: "Kalibo",
    lat: 11.7061,
    lon: 122.3645,
  },
  {
    name: "Lezo",
    lat: 11.6847,
    lon: 122.3281,
  },
  {
    name: "Libacao",
    lat: 11.4148,
    lon: 122.2997,
  },
  {
    name: "Madalag",
    lat: 11.5272,
    lon: 122.2981,
  },
  {
    name: "Makato",
    lat: 11.7022,
    lon: 122.2872,
  },
  {
    name: "Malay",
    lat: 11.9236,
    lon: 121.9236,
  },
  {
    name: "Malinao",
    lat: 11.6453,
    lon: 122.2942,
  },
  {
    name: "Nabas",
    lat: 11.8736,
    lon: 122.0958,
  },
  {
    name: "New Washington",
    lat: 11.6497,
    lon: 122.4328,
  },
  {
    name: "Numancia",
    lat: 11.7028,
    lon: 122.3268,
  },
  {
    name: "Tangalan",
    lat: 11.7553,
    lon: 122.2578,
  },
];

/*
|--------------------------------------------------------------------------
| Determine monitoring level
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This is a WEATHER-BASED monitoring indicator.
| It is NOT an official flood warning.
|
| We use precipitation, rain, showers, wind and weather code to classify
| the current weather condition.
|--------------------------------------------------------------------------
*/

function getLiveLevel(weather: {
  precipitation: number;
  rain: number;
  showers: number;
  weatherCode: number;
  windSpeed: number;
}): MunicipalityWeather["liveLevel"] {
  const {
    precipitation,
    rain,
    showers,
    weatherCode,
    windSpeed,
  } = weather;

  /*
   * Open-Meteo weather codes:
   *
   * 0       Clear
   * 1-3     Mainly clear / partly cloudy / overcast
   * 45-48   Fog
   * 51-57   Drizzle
   * 61-67   Rain
   * 71-77   Snow
   * 80-82   Rain showers
   * 85-86   Snow showers
   * 95      Thunderstorm
   * 96-99   Thunderstorm with hail
   */

  const heavyRainCode =
    weatherCode >= 61 && weatherCode <= 67;

  const showerCode =
    weatherCode >= 80 && weatherCode <= 82;

  const thunderstorm =
    weatherCode >= 95 && weatherCode <= 99;

  const strongWind = windSpeed >= 40;

  const heavyPrecipitation =
    precipitation >= 10 ||
    rain >= 10 ||
    showers >= 10;

  const moderatePrecipitation =
    precipitation >= 2 ||
    rain >= 2 ||
    showers >= 2;

  /*
   * VERY HIGH
   *
   * Severe weather indicators.
   */
  if (
    thunderstorm &&
    (heavyPrecipitation || strongWind)
  ) {
    return "Very High";
  }

  if (
    heavyPrecipitation &&
    (heavyRainCode || showerCode)
  ) {
    return "Very High";
  }

  /*
   * HIGH
   */
  if (
    thunderstorm ||
    (heavyRainCode && moderatePrecipitation) ||
    (showerCode && moderatePrecipitation) ||
    strongWind
  ) {
    return "High";
  }

  /*
   * MODERATE
   */
  if (
    moderatePrecipitation ||
    heavyRainCode ||
    showerCode ||
    (weatherCode >= 51 && weatherCode <= 57)
  ) {
    return "Moderate";
  }

  /*
   * LOW
   */
  return "Low";
}

/*
|--------------------------------------------------------------------------
| Fetch weather for one municipality
|--------------------------------------------------------------------------
*/

async function fetchMunicipalityWeather(
  municipality: Municipality
): Promise<MunicipalityWeather> {
  const url = new URL(
    "https://api.open-meteo.com/v1/forecast"
  );

  url.searchParams.set(
    "latitude",
    municipality.lat.toString()
  );

  url.searchParams.set(
    "longitude",
    municipality.lon.toString()
  );

  /*
   * Current weather variables.
   */
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "showers",
      "weather_code",
      "wind_speed_10m",
    ].join(",")
  );

  /*
   * Philippine timezone.
   */
  url.searchParams.set(
    "timezone",
    "Asia/Manila"
  );

  /*
   * Do not allow the server to serve stale cached weather.
   */
  const response = await fetch(
    url.toString(),
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Open-Meteo request failed for ${municipality.name}: ${response.status}`
    );
  }

  const data =
    (await response.json()) as OpenMeteoResponse;

  const current = data.current;

  const temperature =
    typeof current?.temperature_2m === "number"
      ? current.temperature_2m
      : null;

  const humidity =
    typeof current?.relative_humidity_2m === "number"
      ? current.relative_humidity_2m
      : null;

  const precipitation =
    typeof current?.precipitation === "number"
      ? current.precipitation
      : 0;

  const rain =
    typeof current?.rain === "number"
      ? current.rain
      : 0;

  const showers =
    typeof current?.showers === "number"
      ? current.showers
      : 0;

  const weatherCode =
    typeof current?.weather_code === "number"
      ? current.weather_code
      : 0;

  const windSpeed =
    typeof current?.wind_speed_10m === "number"
      ? current.wind_speed_10m
      : 0;

  const liveLevel = getLiveLevel({
    precipitation,
    rain,
    showers,
    weatherCode,
    windSpeed,
  });

  return {
    ...municipality,

    temperature,
    humidity,
    precipitation,
    rain,
    showers,
    weatherCode,
    windSpeed,

    liveLevel,

    updatedAt:
      current?.time ||
      new Date().toISOString(),
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/live-monitoring
|--------------------------------------------------------------------------
*/

export async function GET() {
  const startedAt = Date.now();

  try {
    /*
     * Request all 17 municipalities.
     *
     * Promise.allSettled allows one municipality to fail without
     * breaking the entire dashboard.
     */
    const results =
      await Promise.allSettled(
        MUNICIPALITIES.map(
          (municipality) =>
            fetchMunicipalityWeather(
              municipality
            )
        )
      );

    const municipalities: MunicipalityWeather[] = [];

    const failedMunicipalities: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        municipalities.push(result.value);
      } else {
        failedMunicipalities.push(
          MUNICIPALITIES[index].name
        );

        console.error(
          `Weather request failed for ${MUNICIPALITIES[index].name}:`,
          result.reason
        );
      }
    });

    /*
     * Sort alphabetically so the API always returns
     * a predictable order.
     */
    municipalities.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    /*
     * Calculate risk distribution.
     */
    const riskDistribution = {
      low: 0,
      moderate: 0,
      high: 0,
      veryHigh: 0,
    };

    municipalities.forEach(
      (municipality) => {
        switch (municipality.liveLevel) {
          case "Low":
            riskDistribution.low++;
            break;

          case "Moderate":
            riskDistribution.moderate++;
            break;

          case "High":
            riskDistribution.high++;
            break;

          case "Very High":
            riskDistribution.veryHigh++;
            break;
        }
      }
    );

    /*
     * Find the municipality currently requiring
     * the most attention.
     */
    const levelPriority: Record<
      MunicipalityWeather["liveLevel"],
      number
    > = {
      Low: 1,
      Moderate: 2,
      High: 3,
      "Very High": 4,
    };

    const highestRiskMunicipality =
      municipalities.length > 0
        ? municipalities.reduce(
            (highest, current) => {
              if (
                levelPriority[current.liveLevel] >
                levelPriority[highest.liveLevel]
              ) {
                return current;
              }

              /*
               * If both have the same level,
               * compare precipitation.
               */
              if (
                levelPriority[
                  current.liveLevel
                ] ===
                  levelPriority[
                    highest.liveLevel
                  ] &&
                current.precipitation !== null &&
                highest.precipitation !== null &&
                current.precipitation >
                  highest.precipitation
              ) {
                return current;
              }

              return highest;
            }
          )
        : null;

    const responseTime = Date.now() - startedAt;

    return NextResponse.json(
      {
        success: true,

        source: "Open-Meteo",

        region: "Aklan",

        monitoringType:
          "Weather-based live monitoring",

        /*
         * This is important for your research/project:
         * these values should not be presented as official
         * flood warnings.
         */
        disclaimer:
          "Flood risk levels are weather-based monitoring indicators and are not official flood warnings. Verify emergencies and warnings with PAGASA and local authorities.",

        municipalityCount:
          municipalities.length,

        expectedMunicipalityCount:
          MUNICIPALITIES.length,

        municipalities,

        riskDistribution,

        highestRiskMunicipality,

        failedMunicipalities,

        updatedAt:
          new Date().toISOString(),

        responseTimeMs:
          responseTime,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma: "no-cache",

          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "LIVE MONITORING ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        source: "Open-Meteo",

        error:
          "Unable to retrieve live Aklan weather monitoring data.",

        updatedAt:
          new Date().toISOString(),
      },
      {
        status: 500,

        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}