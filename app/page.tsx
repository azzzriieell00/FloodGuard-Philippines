"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  const launchMap = () => {
    router.push("/map");
  };

  return (
    <main className="fg-landing">

      {/* BACKGROUND EFFECTS */}
      <div className="fg-grid" />
      <div className="fg-glow fg-glow-one" />
      <div className="fg-glow fg-glow-two" />

      {/* HEADER */}
      <header className="fg-landing-header">

        <div className="fg-brand">
          <div className="fg-brand-name">
            FLOODGUARD
          </div>

          <div className="fg-brand-status">
            <span className="fg-status-dot" />
            SYSTEM ONLINE
          </div>
        </div>

        <div className="fg-header-right">
          <span className="fg-live">
            <span className="fg-status-dot" />
            LIVE
          </span>

          <span className="fg-header-label">
            MUNICIPALITY MONITORING
          </span>
        </div>

      </header>


      {/* HERO */}
      <section className="fg-hero">

        <div className="fg-hero-content">

          <div className="fg-eyebrow">
            PHILIPPINES FLOOD MONITORING SYSTEM
          </div>

          <h1>
            Philippines
            <span> Flood Risk</span>
          </h1>

          <p className="fg-subtitle">
            Municipality-level monitoring
          </p>

          <p className="fg-description">
            A centralized flood risk monitoring platform
            designed to visualize flood conditions across
            municipalities in the Philippines.
          </p>


          {/* BUTTONS */}
          <div className="fg-actions">

            <button
              type="button"
              className="fg-launch-button"
              onClick={launchMap}
            >
              <span className="fg-launch-icon">
                →
              </span>

              <span>
                LAUNCH MAP
              </span>
            </button>

            <button
              type="button"
              className="fg-secondary-button"
              onClick={() =>
                document
                  .getElementById("about")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              LEARN MORE
            </button>

          </div>


          {/* STATUS */}
          <div className="fg-system-info">

            <div className="fg-info-item">
              <span className="fg-status-dot" />
              <span>System Online</span>
            </div>

            <div className="fg-info-divider" />

            <div className="fg-info-item">
              <span>Municipality-level monitoring</span>
            </div>

            <div className="fg-info-divider" />

            <div className="fg-info-item">
              <span>Philippines</span>
            </div>

          </div>

        </div>


        {/* RIGHT VISUAL */}
        <div className="fg-hero-visual">

          <div className="fg-radar">

            <div className="fg-radar-ring ring-one" />
            <div className="fg-radar-ring ring-two" />
            <div className="fg-radar-ring ring-three" />

            <div className="fg-radar-line" />

            <div className="fg-radar-center">
              <span />
            </div>

            <div className="fg-radar-point point-one" />
            <div className="fg-radar-point point-two" />
            <div className="fg-radar-point point-three" />

          </div>


          <div className="fg-map-preview">

            <div className="fg-map-preview-title">
              FLOOD RISK MONITORING
            </div>

            <div className="fg-map-preview-status">
              <span className="fg-status-dot" />
              LIVE DATA
            </div>

            <div className="fg-mini-map">

              <div className="fg-philippines-shape">

                <span className="risk-low" />
                <span className="risk-low" />
                <span className="risk-moderate" />
                <span className="risk-high" />
                <span className="risk-low" />
                <span className="risk-very-high" />
                <span className="risk-moderate" />
                <span className="risk-high" />
                <span className="risk-low" />
                <span className="risk-moderate" />
                <span className="risk-high" />

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ABOUT / FEATURES */}
      <section
        id="about"
        className="fg-features"
      >

        <div className="fg-section-heading">

          <span>
            FLOODGUARD PLATFORM
          </span>

          <h2>
            Monitor flood risk across
            Philippine municipalities
          </h2>

          <p>
            Explore municipality-level flood risk
            information through an interactive map
            and monitoring dashboard.
          </p>

        </div>


        <div className="fg-feature-grid">

          <article className="fg-feature-card">

            <div className="fg-feature-number">
              01
            </div>

            <h3>
              Municipal Monitoring
            </h3>

            <p>
              View flood risk indicators at the
              municipality level across the Philippines.
            </p>

          </article>


          <article className="fg-feature-card">

            <div className="fg-feature-number">
              02
            </div>

            <h3>
              Risk Visualization
            </h3>

            <p>
              Identify low, moderate, high, very high,
              and critical flood risk areas through
              color-coded map indicators.
            </p>

          </article>


          <article className="fg-feature-card">

            <div className="fg-feature-number">
              03
            </div>

            <h3>
              Situational Awareness
            </h3>

            <p>
              Access flood monitoring information,
              alerts, and AI-assisted situational
              insights from the dashboard.
            </p>

          </article>

        </div>

      </section>


      {/* BOTTOM CTA */}
      <section className="fg-final-cta">

        <div>
          <span className="fg-eyebrow">
            FLOODGUARD
          </span>

          <h2>
            Explore the Philippines
            Flood Risk Map
          </h2>

          <p>
            Open the monitoring dashboard to
            explore municipality-level flood risk.
          </p>
        </div>

        <button
          type="button"
          className="fg-launch-button"
          onClick={launchMap}
        >
          <span className="fg-launch-icon">
            →
          </span>

          LAUNCH MAP
        </button>

      </section>


      {/* FOOTER */}
      <footer className="fg-footer">

        <div>
          <strong>
            FLOODGUARD
          </strong>

          <span>
            Philippines Flood Risk
          </span>
        </div>

        <span>
          Municipality-level monitoring
        </span>

      </footer>

    </main>
  );
}