import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

type NewsArticle = {
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  source?: string;
  category?: string;
  priority?: string;
};

type NewsResponse = {
  success?: boolean;
  articles?: NewsArticle[];
  updatedAt?: string;
};

type AIInsight = {
  headline: string;
  summary: string;
  riskLevel:
    | "LOW"
    | "MODERATE"
    | "HIGH"
    | "CRITICAL";
  affectedAreas: string[];
  threats: string[];
  recommendations: string[];
  confidence: number;
};


/*
|--------------------------------------------------------------------------
| GLOBAL CACHE
|--------------------------------------------------------------------------
|
| Keep the Gemini result for 15 minutes.
|
*/

declare global {
  // eslint-disable-next-line no-var
  var __floodguardAIInsightCache:
    | {
        insight: AIInsight;
        updatedAt: string;
        expiresAt: number;
      }
    | undefined;

  // eslint-disable-next-line no-var
  var __floodguardAIInsightRequest:
    | Promise<AIInsight>
    | undefined;
}


/*
|--------------------------------------------------------------------------
| SETTINGS
|--------------------------------------------------------------------------
*/

const AI_CACHE_DURATION =
  15 * 60 * 1000;

const GEMINI_MODEL =
  "gemini-2.5-flash";


/*
|--------------------------------------------------------------------------
| GEMINI API KEY
|--------------------------------------------------------------------------
*/

function getGeminiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    ""
  );
}


/*
|--------------------------------------------------------------------------
| CLEAN GEMINI RESPONSE
|--------------------------------------------------------------------------
*/

function cleanGeminiResponse(
  text: string
) {
  let cleaned =
    text.trim();

  /*
   * Remove Markdown code fences.
   */

  cleaned = cleaned
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();

  /*
   * Find the first JSON object.
   */

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    cleaned =
      cleaned.slice(
        firstBrace,
        lastBrace + 1
      );
  }

  return cleaned;
}


/*
|--------------------------------------------------------------------------
| NORMALIZE AI RESULT
|--------------------------------------------------------------------------
*/

function normalizeInsight(
  raw: any
): AIInsight {
  const allowedRiskLevels = [
    "LOW",
    "MODERATE",
    "HIGH",
    "CRITICAL",
  ];

  let riskLevel =
    String(
      raw?.riskLevel || ""
    )
      .trim()
      .toUpperCase();

  if (
    !allowedRiskLevels.includes(
      riskLevel
    )
  ) {
    riskLevel =
      "MODERATE";
  }

  const affectedAreas =
    Array.isArray(
      raw?.affectedAreas
    )
      ? raw.affectedAreas
          .map((item: unknown) =>
            String(item).trim()
          )
          .filter(Boolean)
          .slice(0, 5)
      : [];

  const threats =
    Array.isArray(
      raw?.threats
    )
      ? raw.threats
          .map((item: unknown) =>
            String(item).trim()
          )
          .filter(Boolean)
          .slice(0, 4)
      : [];

  const recommendations =
    Array.isArray(
      raw?.recommendations
    )
      ? raw.recommendations
          .map((item: unknown) =>
            String(item).trim()
          )
          .filter(Boolean)
          .slice(0, 4)
      : [];

  let confidence =
    Number(
      raw?.confidence
    );

  if (
    !Number.isFinite(
      confidence
    )
  ) {
    confidence = 75;
  }

  confidence = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        confidence
      )
    )
  );

  return {
    headline:
      String(
        raw?.headline ||
          "Philippines Flood and Weather Intelligence"
      ).trim(),

    summary:
      String(
        raw?.summary ||
          "Recent Philippine disaster-related reports are being monitored for potential flood and weather impacts."
      ).trim(),

    riskLevel:
      riskLevel as AIInsight["riskLevel"],

    affectedAreas,

    threats,

    recommendations,

    confidence,
  };
}


/*
|--------------------------------------------------------------------------
| BUILD GEMINI PROMPT
|--------------------------------------------------------------------------
*/

function buildPrompt(
  articles: NewsArticle[]
) {
  const articleText =
    articles
      .slice(0, 10)
      .map(
        (
          article,
          index
        ) => {
          return `
ARTICLE ${index + 1}
Title: ${
            article.title ||
            "Unknown"
          }
Description: ${
            article.description ||
            "No description"
          }
Category: ${
            article.category ||
            "General"
          }
Priority: ${
            article.priority ||
            "LOW"
          }
Source: ${
            article.source ||
            "Unknown"
          }
Published: ${
            article.publishedAt ||
            "Unknown"
          }
`;
        }
      )
      .join("\n");

  return `
You are FloodGuard Philippines AI.

Analyze the supplied Philippine disaster-related news.

Focus on:
- floods
- heavy rainfall
- typhoons
- tropical storms
- landslides
- earthquakes
- volcanic activity
- storm surge
- evacuations
- infrastructure disruption

Use ONLY the supplied articles.

Do not invent facts.

Do not invent locations.

Do not claim an official warning unless the article supports it.

This is situational intelligence, NOT an official emergency warning.

Return ONLY valid JSON.

Use EXACTLY this structure:

{
  "headline": "Short headline",
  "summary": "Short two sentence summary.",
  "riskLevel": "LOW",
  "affectedAreas": ["Area 1", "Area 2"],
  "threats": ["Threat 1", "Threat 2"],
  "recommendations": ["Action 1", "Action 2"],
  "confidence": 80
}

Rules:

riskLevel:
LOW
MODERATE
HIGH
CRITICAL

confidence must be 0-100.

Keep the response concise.

Maximum:
5 affected areas
4 threats
4 recommendations

PHILIPPINE NEWS:

${articleText}
`;
}


/*
|--------------------------------------------------------------------------
| GET NEWS
|--------------------------------------------------------------------------
*/

async function getNews() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const response =
    await fetch(
      `${baseUrl}/api/news?max=10`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `News route returned ${response.status}`
    );
  }

  const data =
    (await response.json()) as NewsResponse;

  if (
    !data.success ||
    !Array.isArray(
      data.articles
    )
  ) {
    throw new Error(
      "Invalid news response."
    );
  }

  return data.articles;
}


/*
|--------------------------------------------------------------------------
| GEMINI REQUEST
|--------------------------------------------------------------------------
*/

async function generateAIInsight(
  articles: NewsArticle[],
  apiKey: string
): Promise<AIInsight> {
  const prompt =
    buildPrompt(articles);

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.1,

          responseMimeType:
            "application/json",

          /*
           * Increased from 1000.
           * This prevents the JSON from being
           * cut off halfway through.
           */
          maxOutputTokens: 2048,
        },
      }),

      cache: "no-store",
    });

  let data: any;

  try {
    data =
      await response.json();
  } catch {
    throw new Error(
      "Gemini returned an invalid response."
    );
  }

  /*
   * GEMINI ERROR
   */

  if (!response.ok) {
    console.error(
      "GEMINI API ERROR:",
      JSON.stringify(
        data,
        null,
        2
      )
    );

    const message =
      data?.error?.message ||
      `Gemini request failed with status ${response.status}`;

    throw new Error(
      message
    );
  }

  /*
   * GET GENERATED TEXT
   */

  const candidates =
    data?.candidates;

  if (
    !Array.isArray(
      candidates
    ) ||
    candidates.length === 0
  ) {
    throw new Error(
      "Gemini returned no candidates."
    );
  }

  const parts =
    candidates[0]?.content
      ?.parts;

  if (
    !Array.isArray(parts)
  ) {
    throw new Error(
      "Gemini returned no content."
    );
  }

  const text =
    parts
      .map(
        (part: any) =>
          part?.text || ""
      )
      .join("")
      .trim();

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  /*
   * Check whether Gemini stopped because
   * the output was too long.
   */

  const finishReason =
    candidates[0]
      ?.finishReason;

  if (
    finishReason ===
    "MAX_TOKENS"
  ) {
    console.warn(
      "Gemini response reached MAX_TOKENS."
    );
  }

  /*
   * CLEAN JSON
   */

  const cleaned =
    cleanGeminiResponse(
      text
    );

  /*
   * PARSE JSON
   */

  let parsed: any;

  try {
    parsed =
      JSON.parse(cleaned);
  } catch {
    /*
     * Log the complete response so
     * debugging is easier.
     */

    console.error(
      "GEMINI JSON PARSE ERROR:"
    );

    console.error(
      cleaned
    );

    /*
     * Try a second extraction.
     */

    try {
      const start =
        cleaned.indexOf(
          "{"
        );

      const end =
        cleaned.lastIndexOf(
          "}"
        );

      if (
        start !== -1 &&
        end !== -1 &&
        end > start
      ) {
        const possibleJson =
          cleaned.slice(
            start,
            end + 1
          );

        parsed =
          JSON.parse(
            possibleJson
          );
      }
    } catch {
      throw new Error(
        "Gemini returned invalid JSON."
      );
    }
  }

  return normalizeInsight(
    parsed
  );
}


/*
|--------------------------------------------------------------------------
| POST /api/news/ai-insight
|--------------------------------------------------------------------------
*/

export async function POST() {
  try {
    const apiKey =
      getGeminiKey();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,

          error:
            "GEMINI_API_KEY is missing from .env.local",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * ========================================================
     * CHECK CACHE
     * ========================================================
     */

    const cached =
      globalThis
        .__floodguardAIInsightCache;

    if (
      cached &&
      Date.now() <
        cached.expiresAt
    ) {
      console.log(
        "AI INSIGHT CACHE HIT"
      );

      return NextResponse.json(
        {
          success: true,

          source:
            "Google Gemini",

          region:
            "Philippines",

          insight:
            cached.insight,

          analyzedArticles: 10,

          cached: true,

          updatedAt:
            cached.updatedAt,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "private, max-age=900",
          },
        }
      );
    }

    /*
     * ========================================================
     * JOIN EXISTING REQUEST
     * ========================================================
     */

    if (
      globalThis
        .__floodguardAIInsightRequest
    ) {
      console.log(
        "AI INSIGHT REQUEST JOINED"
      );

      try {
        const insight =
          await globalThis
            .__floodguardAIInsightRequest;

        const currentCache =
          globalThis
            .__floodguardAIInsightCache;

        return NextResponse.json(
          {
            success: true,

            source:
              "Google Gemini",

            region:
              "Philippines",

            insight,

            analyzedArticles: 10,

            cached: true,

            updatedAt:
              currentCache?.updatedAt ||
              new Date().toISOString(),
          },
          {
            status: 200,
          }
        );
      } catch (error) {
        console.error(
          "JOINED AI REQUEST ERROR:",
          error
        );

        /*
         * Continue to the normal
         * error handling below.
         */
      }
    }

    /*
     * ========================================================
     * CREATE ONE GEMINI REQUEST
     * ========================================================
     */

    const requestPromise =
      (async () => {
        const articles =
          await getNews();

        if (
          articles.length ===
          0
        ) {
          throw new Error(
            "No Philippine news articles are available."
          );
        }

        return generateAIInsight(
          articles,
          apiKey
        );
      })();

    globalThis.__floodguardAIInsightRequest =
      requestPromise;

    try {
      const insight =
        await requestPromise;

      /*
       * ======================================================
       * SAVE CACHE
       * ======================================================
       */

      const updatedAt =
        new Date().toISOString();

      globalThis.__floodguardAIInsightCache =
        {
          insight,

          updatedAt,

          expiresAt:
            Date.now() +
            AI_CACHE_DURATION,
        };

      console.log(
        "AI INSIGHT CACHE UPDATED"
      );

      return NextResponse.json(
        {
          success: true,

          source:
            "Google Gemini",

          region:
            "Philippines",

          insight,

          analyzedArticles:
            10,

          cached: false,

          updatedAt,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "private, max-age=900",
          },
        }
      );
    } catch (error) {
      console.error(
        "AI INSIGHT ROUTE ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "AI Insight unavailable.";

      /*
       * ======================================================
       * RETURN OLD CACHE IF AVAILABLE
       * ======================================================
       */

      const oldCache =
        globalThis
          .__floodguardAIInsightCache;

      if (oldCache) {
        console.warn(
          "Returning previous AI insight."
        );

        return NextResponse.json(
          {
            success: true,

            source:
              "Google Gemini",

            region:
              "Philippines",

            insight:
              oldCache.insight,

            analyzedArticles:
              10,

            cached: true,

            stale: true,

            updatedAt:
              oldCache.updatedAt,

            warning:
              "Showing the previous AI analysis because a new analysis is temporarily unavailable.",
          },
          {
            status: 200,
          }
        );
      }

      /*
       * ======================================================
       * QUOTA / RATE LIMIT
       * ======================================================
       */

      const lower =
        message.toLowerCase();

      const isQuotaError =
        lower.includes(
          "quota"
        ) ||
        lower.includes(
          "resource exhausted"
        ) ||
        lower.includes(
          "rate limit"
        ) ||
        lower.includes(
          "too many requests"
        );

      if (isQuotaError) {
        return NextResponse.json(
          {
            success: false,

            error:
              "AI analysis is temporarily unavailable because the Gemini free-tier quota has been reached.",

            retryAfter:
              "Please wait until the Gemini quota becomes available again.",
          },
          {
            status: 429,
          }
        );
      }

      /*
       * ======================================================
       * JSON ERROR
       * ======================================================
       */

      if (
        lower.includes(
          "invalid json"
        )
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Gemini generated an incomplete analysis. Please try again.",
          },
          {
            status: 502,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,

          error:
            message ||
            "AI Insight unavailable.",
        },
        {
          status: 500,
        }
      );
    } finally {
      /*
       * Clear active request.
       */

      globalThis.__floodguardAIInsightRequest =
        undefined;
    }
  } catch (error) {
    console.error(
      "AI INSIGHT UNEXPECTED ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          "AI Insight service is temporarily unavailable.",
      },
      {
        status: 500,
      }
    );
  }
}