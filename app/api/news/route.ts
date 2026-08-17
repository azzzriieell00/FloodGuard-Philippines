import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GNewsArticle = {
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  source?: {
    name?: string;
    url?: string;
  };
};

type NewsArticle = {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: string;
  sourceUrl: string;
  country: string;
  category: string;
  priority: string;
};

type CachedNews = {
  data: NewsResponse;
  expiresAt: number;
};

type NewsResponse = {
  success: boolean;
  source: string;
  region: string;
  query: string;
  totalArticles: number;
  returnedArticles: number;
  disasterRelatedArticles: number;
  articles: NewsArticle[];
  updatedAt: string;
};

/*
 * ============================================================
 * CACHE SETTINGS
 * ============================================================
 *
 * GNews will only be contacted when the cache expires.
 *
 * 10 minutes is intentionally conservative so that:
 *
 * - refreshing the browser does NOT call GNews repeatedly
 * - AI Insight can reuse the same news
 * - development testing does not burn the API quota
 */

const CACHE_DURATION = 10 * 60 * 1000;

/*
 * When GNews gives us a 429, temporarily avoid calling it
 * again for 60 seconds.
 */
const RATE_LIMIT_COOLDOWN = 60 * 1000;

/*
 * ============================================================
 * GLOBAL SERVER CACHE
 * ============================================================
 *
 * globalThis helps preserve the cache during Next.js
 * development hot reloads when possible.
 */

declare global {
  // eslint-disable-next-line no-var
  var __floodguardNewsCache:
    Map<string, CachedNews> | undefined;

  // eslint-disable-next-line no-var
  var __floodguardNewsRequests:
    Map<string, Promise<NewsResponse>> | undefined;

  // eslint-disable-next-line no-var
  var __floodguardNewsRateLimitUntil:
    number | undefined;
}

const newsCache =
  globalThis.__floodguardNewsCache ??
  new Map<string, CachedNews>();

const activeRequests =
  globalThis.__floodguardNewsRequests ??
  new Map<string, Promise<NewsResponse>>();

globalThis.__floodguardNewsCache =
  newsCache;

globalThis.__floodguardNewsRequests =
  activeRequests;


/* ============================================================
   CLASSIFY NEWS
   ============================================================ */

function classifyNews(
  title: string,
  description: string
) {
  const text =
    `${title} ${description}`.toLowerCase();

  if (
    /flood|flooding|flash flood|inundation/.test(
      text
    )
  ) {
    return "Flood";
  }

  if (
    /typhoon|tropical storm|tropical depression|bagyo/.test(
      text
    )
  ) {
    return "Typhoon";
  }

  if (
    /heavy rain|rainfall|rainstorm|monsoon|habagat/.test(
      text
    )
  ) {
    return "Heavy Rain";
  }

  if (
    /landslide|mudslide/.test(text)
  ) {
    return "Landslide";
  }

  if (
    /earthquake|quake|magnitude/.test(
      text
    )
  ) {
    return "Earthquake";
  }

  if (
    /volcano|volcanic|eruption|ashfall/.test(
      text
    )
  ) {
    return "Volcanic";
  }

  if (
    /storm surge|coastal flooding|tsunami/.test(
      text
    )
  ) {
    return "Coastal Hazard";
  }

  if (
    /evacuation|evacuated|evacuate|rescue/.test(
      text
    )
  ) {
    return "Emergency";
  }

  if (
    /road closure|road closed|bridge closed/.test(
      text
    )
  ) {
    return "Infrastructure";
  }

  return "General";
}


/* ============================================================
   PRIORITY
   ============================================================ */

function getPriority(
  category: string
) {
  if (
    [
      "Flood",
      "Typhoon",
      "Landslide",
      "Earthquake",
      "Volcanic",
      "Coastal Hazard",
    ].includes(category)
  ) {
    return "HIGH";
  }

  if (
    [
      "Heavy Rain",
      "Emergency",
      "Infrastructure",
    ].includes(category)
  ) {
    return "MODERATE";
  }

  return "LOW";
}


/* ============================================================
   DEFAULT QUERY
   ============================================================ */

function getQuery(
  request: NextRequest
) {
  const requestedQuery =
    request.nextUrl.searchParams.get(
      "q"
    );

  return (
    requestedQuery ||
    "Philippines flood OR typhoon OR rainfall OR weather OR disaster OR earthquake OR landslide"
  );
}


/* ============================================================
   MAX ARTICLES
   ============================================================ */

function getMax(
  request: NextRequest
) {
  const value = Number(
    request.nextUrl.searchParams.get(
      "max"
    ) || "10"
  );

  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.min(
    Math.max(Math.floor(value), 1),
    10
  );
}


/* ============================================================
   FETCH GNEWS
   ============================================================ */

async function fetchGNews(
  query: string,
  max: number,
  apiKey: string
): Promise<NewsResponse> {
  const url = new URL(
    "https://gnews.io/api/v4/search"
  );

  url.searchParams.set(
    "q",
    query
  );

  url.searchParams.set(
    "lang",
    "en"
  );

  url.searchParams.set(
    "country",
    "ph"
  );

  url.searchParams.set(
    "max",
    String(max)
  );

  url.searchParams.set(
    "sortby",
    "publishedAt"
  );

  url.searchParams.set(
    "apikey",
    apiKey
  );

  const response =
    await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  /*
   * ==========================================================
   * GNEWS RATE LIMIT
   * ==========================================================
   */

  if (response.status === 429) {
    console.warn(
      "GNews rate limit reached."
    );

    globalThis.__floodguardNewsRateLimitUntil =
      Date.now() +
      RATE_LIMIT_COOLDOWN;

    throw new Error(
      "GNews rate limit reached. Please wait before requesting new news."
    );
  }

  if (!response.ok) {
    console.error(
      "GNews error:",
      data
    );

    throw new Error(
      `GNews request failed with status ${response.status}`
    );
  }

  const rawArticles =
    Array.isArray(data?.articles)
      ? data.articles
      : [];

  const articles: NewsArticle[] =
    rawArticles.map(
      (
        article: GNewsArticle,
        index: number
      ) => {
        const title =
          article.title ||
          "Untitled article";

        const description =
          article.description ||
          "";

        const category =
          classifyNews(
            title,
            description
          );

        return {
          id:
            article.id ||
            `ph-news-${Date.now()}-${index}`,

          title,

          description,

          content:
            article.content || "",

          url:
            article.url || "",

          image:
            article.image || "",

          publishedAt:
            article.publishedAt || "",

          source:
            article.source?.name ||
            "Unknown",

          sourceUrl:
            article.source?.url ||
            "",

          country:
            "Philippines",

          category,

          priority:
            getPriority(category),
        };
      }
    );

  /*
   * Sort:
   *
   * HIGH
   * MODERATE
   * LOW
   */

  const priorityOrder: Record<
    string,
    number
  > = {
    HIGH: 3,
    MODERATE: 2,
    LOW: 1,
  };

  articles.sort(
    (
      a,
      b
    ) =>
      priorityOrder[b.priority] -
      priorityOrder[a.priority]
  );

  return {
    success: true,

    source: "GNews",

    region: "Philippines",

    query,

    totalArticles:
      Number(
        data?.totalArticles
      ) ||
      articles.length,

    returnedArticles:
      articles.length,

    disasterRelatedArticles:
      articles.filter(
        (article) =>
          article.category !==
          "General"
      ).length,

    articles,

    updatedAt:
      new Date().toISOString(),
  };
}


/* ============================================================
   GET NEWS
   ============================================================ */

export async function GET(
  request: NextRequest
) {
  try {
    const apiKey =
      process.env.GNEWS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GNEWS_API_KEY is missing from .env.local",
        },
        {
          status: 500,
        }
      );
    }

    const query =
      getQuery(request);

    const max =
      getMax(request);

    /*
     * Cache key.
     *
     * Different search queries get different caches.
     */

    const cacheKey =
      `${query}|${max}`;

    /*
     * ========================================================
     * 1. CHECK CACHE
     * ========================================================
     */

    const cached =
      newsCache.get(cacheKey);

    if (
      cached &&
      Date.now() <
        cached.expiresAt
    ) {
      console.log(
        "NEWS CACHE HIT:",
        cacheKey
      );

      return NextResponse.json(
        {
          ...cached.data,

          cached: true,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "private, max-age=600",
          },
        }
      );
    }

    /*
     * ========================================================
     * 2. CHECK RATE-LIMIT COOLDOWN
     * ========================================================
     */

    const rateLimitUntil =
      globalThis
        .__floodguardNewsRateLimitUntil ||
      0;

    if (
      Date.now() <
      rateLimitUntil
    ) {
      /*
       * If we have stale cache,
       * return it instead of failing.
       */

      if (cached) {
        console.warn(
          "GNews rate limited. Returning stale news cache."
        );

        return NextResponse.json(
          {
            ...cached.data,

            cached: true,

            stale: true,
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

      return NextResponse.json(
        {
          success: false,

          error:
            "GNews is temporarily rate-limited. Please try again shortly.",

          retryAfterSeconds:
            Math.ceil(
              (rateLimitUntil -
                Date.now()) /
                1000
            ),
        },
        {
          status: 429,
        }
      );
    }

    /*
     * ========================================================
     * 3. PREVENT DUPLICATE SIMULTANEOUS REQUESTS
     * ========================================================
     *
     * If two components request /api/news
     * at exactly the same time, only ONE
     * GNews request will be made.
     */

    const existingRequest =
      activeRequests.get(
        cacheKey
      );

    if (existingRequest) {
      console.log(
        "NEWS REQUEST JOINED:",
        cacheKey
      );

      try {
        const result =
          await existingRequest;

        return NextResponse.json(
          {
            ...result,

            cached: true,
          },
          {
            status: 200,

            headers: {
              "Cache-Control":
                "private, max-age=600",
            },
          }
        );
      } catch (error) {
        console.error(
          "Joined news request failed:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Philippines news service is temporarily unavailable.",
          },
          {
            status: 503,
          }
        );
      }
    }

    /*
     * ========================================================
     * 4. MAKE ONE GNEWS REQUEST
     * ========================================================
     */

    const requestPromise =
      fetchGNews(
        query,
        max,
        apiKey
      );

    activeRequests.set(
      cacheKey,
      requestPromise
    );

    try {
      const result =
        await requestPromise;

      /*
       * ======================================================
       * 5. SAVE TO CACHE
       * ======================================================
       */

      newsCache.set(
        cacheKey,
        {
          data: result,

          expiresAt:
            Date.now() +
            CACHE_DURATION,
        }
      );

      console.log(
        "NEWS CACHE UPDATED:",
        cacheKey
      );

      return NextResponse.json(
        {
          ...result,

          cached: false,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "private, max-age=600",
          },
        }
      );
    } catch (error) {
      console.error(
        "NEWS ROUTE ERROR:",
        error
      );

      /*
       * If GNews fails but stale
       * data exists, keep FloodGuard
       * functional.
       */

      if (cached) {
        console.warn(
          "Returning stale news cache because GNews failed."
        );

        return NextResponse.json(
          {
            ...cached.data,

            cached: true,

            stale: true,
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

      const message =
        error instanceof Error
          ? error.message
          : "Philippines news service is unavailable.";

      const isRateLimited =
        message
          .toLowerCase()
          .includes(
            "rate limit"
          );

      return NextResponse.json(
        {
          success: false,

          error:
            isRateLimited
              ? "GNews is temporarily rate-limited. Please try again shortly."
              : "Philippines news service is unavailable.",
        },
        {
          status:
            isRateLimited
              ? 429
              : 500,
        }
      );
    } finally {
      /*
       * Always remove the active
       * request after it finishes.
       */

      activeRequests.delete(
        cacheKey
      );
    }
  } catch (error) {
    console.error(
      "NEWS ROUTE UNEXPECTED ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "Philippines news service is unavailable.",
      },
      {
        status: 500,
      }
    );
  }
}