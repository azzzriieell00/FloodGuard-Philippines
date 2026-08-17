"use client";

import dynamic from "next/dynamic";

const PhilippinesMap = dynamic(
  () => import("./PhilippinesMap"),
  {
    ssr: false,
    loading: () => (
      <div className="philippines-map-loading">
        <div className="map-loading-spinner" />
        <span>Loading Philippines map...</span>
      </div>
    ),
  }
);

export default function PhilippinesMapClient() {
  return <PhilippinesMap />;
}