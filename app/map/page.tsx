"use client";

import FloodMapClient from "@/components/map/FloodMapClient";

export default function MapPage() {
  return (
    <main className="fg-map-page">
      <header className="fg-map-header">
        <div className="fg-map-brand">
          <div className="fg-map-brand-name">FLOODGUARD</div>
          <h1>Philippines Flood Risk</h1>
          <p>Municipality-level monitoring</p>
        </div>

        <div className="fg-map-header-status">
          <div className="fg-system-pill">
            <i />
            SYSTEM ONLINE
          </div>
        </div>

        <div className="fg-map-header-right">
          <div className="fg-live-pill fg-header-live">
            <i />
            LIVE
          </div>

          <div className="fg-time-pill">
            <span>◷</span>
            <span>14 Aug 2026</span>
            <b>•</b>
            <span>11:24 AM</span>
          </div>

          <button
            type="button"
            className="fg-header-button"
            aria-label="Home"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("floodguard-map-command", {
                  detail: "home",
                }),
              )
            }
          >
            ⌂
          </button>

          <button
            type="button"
            className="fg-header-button"
            aria-label="Fullscreen"
            onClick={() => {
              const element = document.documentElement;
              if (!document.fullscreenElement) {
                element.requestFullscreen?.();
              } else {
                document.exitFullscreen?.();
              }
            }}
          >
            ⛶
          </button>
        </div>
      </header>

      <section className="fg-map-stage">
        <FloodMapClient />
      </section>

      <footer className="fg-alert-bar">
        <div className="fg-alert-title">
          <span className="fg-alert-bell">♟</span>
          SYSTEM ALERTS
        </div>

        <div className="fg-alert-item">
          <i />
          Orange Rainfall Alert: Zambales, Bataan
        </div>

        <div className="fg-alert-item">
          <i />
          Yellow Rainfall Warning: Metro Manila and nearby areas
        </div>

        <div className="fg-alert-item">
          <i />
          Southwest Monsoon affecting Luzon and Visayas
        </div>

        <button type="button" className="fg-view-alerts">
          VIEW ALL ALERTS
        </button>
      </footer>
    </main>
  );
}