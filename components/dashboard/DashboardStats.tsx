"use client";

import React from "react";
import "./DashboardStats.css";

type DashboardStatsProps = {
  total?: number;
  low?: number;
  moderate?: number;
  high?: number;
  veryHigh?: number;
};

export default function DashboardStats({
  total = 17,
  low = 2,
  moderate = 12,
  high = 3,
  veryHigh = 0,
}: DashboardStatsProps) {
  return (
    <div className="dashboard-stats" aria-label="FloodGuard-Aklan risk statistics">

      {/* BRAND */}
      <div className="dashboard-brand">
        <div className="dashboard-brand-icon">
          FG
        </div>

        <div>
          <div className="dashboard-brand-title">
            FloodGuard-Aklan
          </div>

          <div className="dashboard-brand-subtitle">
            Flood Risk Monitoring
          </div>
        </div>
      </div>

      {/* TOTAL */}
      <div className="dashboard-stat dashboard-total">
        <div className="dashboard-stat-label">
          MUNICIPALITIES
        </div>

        <div className="dashboard-stat-value">
          {total}
        </div>
      </div>

      {/* LOW */}
      <div className="dashboard-stat dashboard-low">
        <div className="dashboard-stat-label">
          LOW
        </div>

        <div className="dashboard-stat-value">
          {low}
        </div>
      </div>

      {/* MODERATE */}
      <div className="dashboard-stat dashboard-moderate">
        <div className="dashboard-stat-label">
          MODERATE
        </div>

        <div className="dashboard-stat-value">
          {moderate}
        </div>
      </div>

      {/* HIGH */}
      <div className="dashboard-stat dashboard-high">
        <div className="dashboard-stat-label">
          HIGH
        </div>

        <div className="dashboard-stat-value">
          {high}
        </div>
      </div>

      {/* VERY HIGH */}
      <div className="dashboard-stat dashboard-very-high">
        <div className="dashboard-stat-label">
          VERY HIGH
        </div>

        <div className="dashboard-stat-value">
          {veryHigh}
        </div>
      </div>

    </div>
  );
}