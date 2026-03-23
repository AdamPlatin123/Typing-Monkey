import { Queue } from "bullmq";

import { type DocumentSourceType, type ImportKind } from "@/lib/domain";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis";

export type SingleIngestJobPayload = {
  kind: "SINGLE";
  documentId: string;
  ingestJobId: string;
  sourceType: DocumentSourceType;
  objectKey: string;
  ownerId: string;
  fileName?: string;
};

export type BatchIngestJobPayload = {
  kind: "BATCH";
  batchId: string;
  objectKey: string;
  fileName: string;
  ownerId: string;
  importKind: Exclude<ImportKind, "SINGLE">;
  rootName?: string;
};

export type IngestJobPayload = SingleIngestJobPayload | BatchIngestJobPayload;

const globalForQueue = globalThis as unknown as {
  ingestQueue: Queue<IngestJobPayload> | undefined;
};

export function getIngestQueue() {
  if (globalForQueue.ingestQueue) {
    return globalForQueue.ingestQueue;
  }

  const queue = new Queue<IngestJobPayload>(env.INGEST_QUEUE_NAME, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 500,
      removeOnFail: 1000,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForQueue.ingestQueue = queue;
  }

  return queue;
}
