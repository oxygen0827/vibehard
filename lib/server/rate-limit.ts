import type { NextRequest } from "next/server";

interface Bucket { count: number; resetAt: number }

declare global {
  var __vibehardRateLimits: Map<string, Bucket> | undefined;
}

const buckets = globalThis.__vibehardRateLimits ?? new Map<string, Bucket>();
globalThis.__vibehardRateLimits = buckets;

export function requestAddress(request: NextRequest) {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function consumeRateLimit(namespace: string, key: string, limit: number, windowMs: number) {
  const bucketKey = `${namespace}:${key}`;
  const currentTime = Date.now();
  const existing = buckets.get(bucketKey);
  const bucket = !existing || existing.resetAt <= currentTime ? { count: 0, resetAt: currentTime + windowMs } : existing;
  bucket.count += 1;
  buckets.set(bucketKey, bucket);
  if (buckets.size > 10_000) {
    for (const [candidate, value] of buckets) if (value.resetAt <= currentTime) buckets.delete(candidate);
    while (buckets.size > 10_000) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }
  return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)) };
}

export function clearRateLimit(namespace: string, key: string) {
  buckets.delete(`${namespace}:${key}`);
}
