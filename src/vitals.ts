import { onLCP, onCLS, onINP, onFCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

function getRating(metric: Metric): string {
  const colors: Record<string, string> = {
    good: "color: #0cce6b",
    "needs-improvement": "color: #ffa400",
    poor: "color: #ff4e42",
  };
  return colors[metric.rating] ?? "color: gray";
}

function logMetric(metric: Metric): void {
  console.log(
    `%c[${metric.rating.toUpperCase()}] ${metric.name}: ${metric.value.toFixed(1)}`,
    getRating(metric),
  );
}

export function initVitals(): void {
  console.log("%c[Web Vitals] Monitoring CWV metrics...", "color: #2563eb; font-weight: bold");
  onLCP(logMetric);
  onCLS(logMetric);
  onINP(logMetric);
  onFCP(logMetric);
  onTTFB(logMetric);
}
