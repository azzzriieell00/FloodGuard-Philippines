"use client";

import { useCallback, useEffect, useState } from "react";
import "./AIInsight.css";

type AIInsightData = {
  headline: string;
  summary: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  affectedAreas: string[];
  threats: string[];
  recommendations: string[];
  confidence: number;
};

type AIResponse = {
  success?: boolean;
  source?: string;
  region?: string;
  insight?: AIInsightData;
  analyzedArticles?: number;
  cached?: boolean;
  stale?: boolean;
  error?: string;
  warning?: string;
};

export default function AIInsight() {
  const [insight, setInsight] =
    useState<AIInsightData | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [warning, setWarning] =
    useState("");

  const [closed, setClosed] =
    useState(false);

  const [updatedAt, setUpdatedAt] =
    useState<string | null>(null);

  const [cached, setCached] =
    useState(false);

  /*
   * Prevent repeated automatic requests.
   */
  const [hasLoaded, setHasLoaded] =
    useState(false);

  const loadInsight = useCallback(
    async (force = false) => {
      if (loading) return;

      /*
       * Don't automatically request again
       * after the first attempt.
       */
      if (hasLoaded && !force) {
        return;
      }

      try {
        setLoading(true);
        setError("");
        setWarning("");

        const response =
          await fetch(
            "/api/news/ai-insight",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              /*
               * This does NOT mean Gemini is
               * called repeatedly. The server
               * route handles caching.
               */
              cache: "no-store",

              body: JSON.stringify({}),
            }
          );

        let data: AIResponse;

        try {
          data =
            await response.json();
        } catch {
          throw new Error(
            "The AI service returned an invalid response."
          );
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
              `AI service returned ${response.status}`
          );
        }

        if (
          !data.success ||
          !data.insight
        ) {
          throw new Error(
            data.error ||
              "AI Insight is currently unavailable."
          );
        }

        setInsight(
          data.insight
        );

        setUpdatedAt(
          new Date().toISOString()
        );

        setCached(
          Boolean(data.cached)
        );

        if (data.warning) {
          setWarning(
            data.warning
          );
        }

        setHasLoaded(true);
      } catch (err) {
        console.error(
          "AI INSIGHT CLIENT ERROR:",
          err
        );

        const message =
          err instanceof Error
            ? err.message
            : "Unable to load AI Insight.";

        if (
          message
            .toLowerCase()
            .includes("quota") ||
          message
            .toLowerCase()
            .includes("rate limit") ||
          message
            .toLowerCase()
            .includes("temporarily unavailable")
        ) {
          setError(
            "AI analysis is temporarily unavailable. The free AI quota has been reached."
          );
        } else {
          setError(message);
        }

        setHasLoaded(true);
      } finally {
        setLoading(false);
      }
    },
    [hasLoaded, loading]
  );

  /*
   * Load only ONCE when the component first appears.
   */
  useEffect(() => {
    loadInsight();
  }, [loadInsight]);

  /*
   * ============================================================
   * CLOSED STATE
   * ============================================================
   */

  if (closed) {
    return (
      <button
        type="button"
        className="ai-reopen-button"
        onClick={() =>
          setClosed(false)
        }
        aria-label="Open AI Insights"
      >
        <span className="ai-reopen-dot" />
        <span>AI INSIGHTS</span>
      </button>
    );
  }

  /*
   * ============================================================
   * PANEL
   * ============================================================
   */

  return (
    <aside
      className="ai-insight"
      aria-label="Philippines AI intelligence"
    >
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="ai-insight-header">
        <div className="ai-insight-title">
          <span>
            AI INSIGHTS
          </span>

          <span
            className="ai-help"
            title="AI-generated analysis of recent Philippine disaster-related news"
          >
            ?
          </span>
        </div>

        <div className="ai-header-actions">
          <span className="ai-live">
            <span className="ai-live-dot" />
            LIVE
          </span>

          <button
            type="button"
            className="ai-close"
            onClick={() =>
              setClosed(true)
            }
            aria-label="Close AI Insights"
          >
            ×
          </button>
        </div>
      </div>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <div className="ai-insight-content">
        {/* LOADING */}

        {loading && (
          <div className="ai-loading">
            <div className="ai-loading-spinner" />

            <div>
              <strong>
                Analyzing Philippine news
              </strong>

              <span>
                Generating intelligence...
              </span>
            </div>
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="ai-error">
            <div className="ai-error-icon">
              !
            </div>

            <div className="ai-error-text">
              <strong>
                AI analysis unavailable
              </strong>

              <span>
                {error}
              </span>
            </div>

            <button
              type="button"
              className="ai-retry"
              onClick={() =>
                loadInsight(true)
              }
            >
              RETRY
            </button>
          </div>
        )}

        {/* ==================================================
            INSIGHT
        ================================================== */}

        {!loading &&
          !error &&
          insight && (
            <>
              {/* CATEGORY */}

              <div className="ai-story-meta">
                <span className="ai-story-icon">
                  ●
                </span>

                <span>
                  PHILIPPINES
                </span>

                <span className="ai-tag">
                  AI ANALYSIS
                </span>
              </div>

              {/* HEADLINE */}

              <h2 className="ai-headline">
                {insight.headline}
              </h2>

              {/* SUMMARY */}

              <p className="ai-summary">
                {insight.summary}
              </p>

              {/* RISK */}

              <div
                className={`ai-risk ai-risk-${insight.riskLevel.toLowerCase()}`}
              >
                <div>
                  <span>
                    AI ASSESSED RISK
                  </span>

                  <strong>
                    {insight.riskLevel}
                  </strong>
                </div>

                <span className="ai-risk-dot" />
              </div>

              {/* AFFECTED AREAS */}

              {insight
                .affectedAreas
                ?.length > 0 && (
                <section className="ai-section">
                  <h3>
                    AFFECTED AREAS
                  </h3>

                  <div className="ai-chips">
                    {insight.affectedAreas
                      .slice(0, 6)
                      .map(
                        (
                          area,
                          index
                        ) => (
                          <span
                            key={`${area}-${index}`}
                            className="ai-chip"
                          >
                            {area}
                          </span>
                        )
                      )}
                  </div>
                </section>
              )}

              {/* THREATS */}

              {insight.threats
                ?.length > 0 && (
                <section className="ai-section">
                  <h3>
                    IDENTIFIED THREATS
                  </h3>

                  <ul className="ai-list">
                    {insight.threats
                      .slice(0, 5)
                      .map(
                        (
                          threat,
                          index
                        ) => (
                          <li
                            key={`${threat}-${index}`}
                          >
                            <span className="ai-bullet" />
                            <span>
                              {threat}
                            </span>
                          </li>
                        )
                      )}
                  </ul>
                </section>
              )}

              {/* RECOMMENDATIONS */}

              {insight
                .recommendations
                ?.length > 0 && (
                <section className="ai-section">
                  <h3>
                    RECOMMENDED ACTION
                  </h3>

                  <ul className="ai-list ai-recommendations">
                    {insight.recommendations
                      .slice(0, 4)
                      .map(
                        (
                          recommendation,
                          index
                        ) => (
                          <li
                            key={`${recommendation}-${index}`}
                          >
                            <span className="ai-bullet" />
                            <span>
                              {recommendation}
                            </span>
                          </li>
                        )
                      )}
                  </ul>
                </section>
              )}

              {/* CONFIDENCE */}

              <div className="ai-confidence">
                <div className="ai-confidence-header">
                  <span>
                    AI confidence
                  </span>

                  <strong>
                    {
                      insight.confidence
                    }
                    %
                  </strong>
                </div>

                <div className="ai-confidence-track">
                  <div
                    className="ai-confidence-fill"
                    style={{
                      width: `${insight.confidence}%`,
                    }}
                  />
                </div>
              </div>

              {/* FOOTER */}

              <div className="ai-footer">
                <span>
                  {cached
                    ? "Cached analysis"
                    : "Updated just now"}
                </span>

                <span>
                  Source: Google Gemini
                </span>
              </div>

              {/* WARNING */}

              {warning && (
                <div className="ai-warning">
                  {warning}
                </div>
              )}

              {/* DISCLAIMER */}

              <div className="ai-disclaimer">
                AI-generated situational
                analysis. This is not an
                official emergency warning.
                Verify warnings with PAGASA,
                PHIVOLCS, NDRRMC, and local
                authorities.
              </div>

              {/* MANUAL REFRESH */}

              <button
                type="button"
                className="ai-refresh"
                onClick={() =>
                  loadInsight(true)
                }
                disabled={loading}
              >
                ↻ UPDATE AI INSIGHT
              </button>
            </>
          )}
      </div>
    </aside>
  );
}