"use client";

import dynamic from "next/dynamic";

const FloodMapClient = dynamic(
  () => import("./FloodMapClient"),
  {
    ssr: false,

    loading: () => (
      <div className="flood-map-loading">
        <div className="flood-map-loading-spinner" />
        <span>Loading Philippines flood map...</span>
      </div>
    ),
  }
);

export default function FloodMapLoader() {
  return <FloodMapClient />;
}