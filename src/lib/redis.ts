import IORedis, { Redis } from "ioredis";

import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

export function getRedis() {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = client;
  }

  return client;
}
