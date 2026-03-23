import "dotenv/config";

import { Worker } from "bullmq";

import { env } from "@/lib/env";
import { runBatchIngestPipeline, runSingleIngestPipeline } from "@/lib/ingest/pipeline";
import { getRedis } from "@/lib/redis";
import { type IngestJobPayload } from "@/lib/queue";

async function main() {
  const redis = getRedis();
  await redis.connect();

  const worker = new Worker<IngestJobPayload>(
    env.INGEST_QUEUE_NAME,
    async (job) => {
      if (job.data.kind === "BATCH") {
        await runBatchIngestPipeline(job.data);
        return;
      }

      await runSingleIngestPipeline(job.data);
    },
    {
      connection: redis,
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    console.log("Ingest job completed", job.id);
  });

  worker.on("failed", (job, err) => {
    console.error("Ingest job failed", job?.id, err);
  });

  console.log(`Worker listening on queue: ${env.INGEST_QUEUE_NAME}`);
}

main().catch((error) => {
  console.error("Worker crashed", error);
  process.exit(1);
});
