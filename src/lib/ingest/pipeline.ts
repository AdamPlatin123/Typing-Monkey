import path from "node:path";

import { Prisma } from "@prisma/client";

import {
  ASSET_KIND,
  DOCUMENT_STATUS,
  IMPORT_BATCH_STATUS,
  INGEST_STATUS,
  type DocumentSourceType,
} from "@/lib/domain";
import { prisma } from "@/lib/db";
import { sanitizeRelativePath, sourceTypeFromFileName, getImageMimeType, getImageExtension } from "@/lib/file";
import { extractArchiveFromBuffer } from "@/lib/ingest/archive";
import { parseDocument } from "@/lib/parsers";
import {
  type BatchIngestJobPayload,
  type SingleIngestJobPayload,
} from "@/lib/queue";
import { type ParsedResolvedAsset, ParserError } from "@/lib/parsers/types";
import { getObjectCommand, putObjectCommand, s3Client } from "@/lib/storage";
import { streamToBuffer } from "@/lib/streams";

const PARSER_VERSION = "2.0.0";

async function parseAndPersistDocument(params: {
  documentId: string;
  ingestJobId: string;
  sourceType: DocumentSourceType;
  ownerId: string;
  buffer: Buffer;
  fileName: string;
  resolveMarkdownAsset?: (sourcePath: string) => Promise<ParsedResolvedAsset | null>;
}) {
  const parseResult = await parseDocument({
    sourceType: params.sourceType,
    buffer: params.buffer,
    context: {
      fileName: params.fileName,
      resolveAsset: params.resolveMarkdownAsset,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.documentBlock.deleteMany({ where: { documentId: params.documentId } });
    await tx.documentAsset.deleteMany({ where: { documentId: params.documentId } });

    if (parseResult.blocks.length > 0) {
      await tx.documentBlock.createMany({
        data: parseResult.blocks.map((block, index) => ({
          documentId: params.documentId,
          index,
          type: block.type,
          text: block.text,
          level: block.level,
          attrs: block.attrs ? (block.attrs as Prisma.JsonObject) : undefined,
        })),
      });
    }

    if (parseResult.assets.length > 0) {
      for (let idx = 0; idx < parseResult.assets.length; idx += 1) {
        const asset = parseResult.assets[idx];
        const ext = getImageExtension(asset.mimeType);
        const assetKey = `documents/${params.ownerId}/${params.documentId}/assets/${idx + 1}.${ext}`;

        await s3Client.send(
          putObjectCommand({
            key: assetKey,
            contentType: asset.mimeType,
            body: asset.data,
          }),
        );

        await tx.documentAsset.create({
          data: {
            documentId: params.documentId,
            blockIndex: asset.blockIndex,
            kind: ASSET_KIND.IMAGE,
            storageKey: assetKey,
            mimeType: asset.mimeType,
            width: asset.width,
            height: asset.height,
          },
        });
      }
    }

    await tx.ingestJob.update({
      where: { id: params.ingestJobId },
      data: {
        status: INGEST_STATUS.COMPLETED,
        finishedAt: new Date(),
        errorCode: null,
        errorText: parseResult.warnings.length > 0 ? parseResult.warnings.join("|") : null,
      },
    });

    await tx.documentMeta.update({
      where: { id: params.documentId },
      data: {
        status: DOCUMENT_STATUS.READY,
        parserVersion: PARSER_VERSION,
        wordCount: parseResult.meta.wordCount,
        title: parseResult.meta.title ?? undefined,
      },
    });
  });
}

async function runIngestFromBuffer(params: {
  documentId: string;
  ingestJobId: string;
  sourceType: DocumentSourceType;
  ownerId: string;
  buffer: Buffer;
  fileName: string;
  resolveMarkdownAsset?: (sourcePath: string) => Promise<ParsedResolvedAsset | null>;
}) {
  await prisma.$transaction([
    prisma.ingestJob.update({
      where: { id: params.ingestJobId },
      data: {
        status: INGEST_STATUS.PROCESSING,
        startedAt: new Date(),
      },
    }),
    prisma.documentMeta.update({
      where: { id: params.documentId },
      data: {
        status: DOCUMENT_STATUS.PROCESSING,
      },
    }),
  ]);

  try {
    await parseAndPersistDocument(params);
    return { status: "COMPLETED" as const };
  } catch (error) {
    const code = error instanceof ParserError ? error.code : "INGEST_FAILED";
    const message = error instanceof Error ? error.message : "Unknown ingest error";

    await prisma.$transaction([
      prisma.ingestJob.update({
        where: { id: params.ingestJobId },
        data: {
          status: INGEST_STATUS.FAILED,
          errorCode: code,
          errorText: message,
          finishedAt: new Date(),
          retryCount: {
            increment: 1,
          },
        },
      }),
      prisma.documentMeta.update({
        where: { id: params.documentId },
        data: {
          status: DOCUMENT_STATUS.FAILED,
        },
      }),
    ]);

    throw error;
  }
}

export async function runSingleIngestPipeline(input: SingleIngestJobPayload) {
  const object = await s3Client.send(getObjectCommand(input.objectKey));
  const buffer = await streamToBuffer(object.Body);

  return runIngestFromBuffer({
    documentId: input.documentId,
    ingestJobId: input.ingestJobId,
    sourceType: input.sourceType,
    ownerId: input.ownerId,
    buffer,
    fileName: input.fileName ?? `${input.documentId}`,
  });
}

function buildMarkdownResolver(args: {
  currentFilePath: string;
  fileMap: Map<string, Buffer>;
}) {
  const baseDir = path.posix.dirname(args.currentFilePath);

  return async (sourcePath: string): Promise<ParsedResolvedAsset | null> => {
    const trimmed = sourcePath.trim();
    if (!trimmed) return null;

    if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
      return null;
    }

    let relativeTarget: string;
    try {
      relativeTarget = sanitizeRelativePath(path.posix.join(baseDir, trimmed));
    } catch {
      return null;
    }

    const data = args.fileMap.get(relativeTarget);
    if (!data) {
      return null;
    }

    return {
      fileName: path.posix.basename(relativeTarget),
      mimeType: getImageMimeType(relativeTarget) ?? "application/octet-stream",
      data,
    };
  };
}

export async function runBatchIngestPipeline(input: BatchIngestJobPayload) {
  await prisma.importBatch.update({
    where: { id: input.batchId },
    data: {
      status: IMPORT_BATCH_STATUS.PROCESSING,
      startedAt: new Date(),
    },
  });

  try {
    const object = await s3Client.send(getObjectCommand(input.objectKey));
    const archiveBuffer = await streamToBuffer(object.Body);

    const extracted = await extractArchiveFromBuffer({
      fileName: input.fileName,
      buffer: archiveBuffer,
    });

    const fileMap = new Map<string, Buffer>();
    for (const file of extracted.files) {
      fileMap.set(file.relativePath, file.buffer);
    }

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const entry of extracted.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
      let sourceType: DocumentSourceType | null = null;
      try {
        sourceType = sourceTypeFromFileName(entry.relativePath);
      } catch {
        sourceType = null;
      }

      if (!sourceType) {
        await prisma.importItem.create({
          data: {
            batchId: input.batchId,
            relativePath: entry.relativePath,
            status: "SKIPPED",
            errorCode: "UNSUPPORTED_FILE_TYPE",
            errorText: "File type is not supported for parsing",
          },
        });
        skippedCount += 1;
        continue;
      }

      const title = path.posix.basename(entry.relativePath).replace(/\.[^.]+$/, "");

      const [document, ingestJob, importItem] = await prisma.$transaction(async (tx) => {
        const createdDocument = await tx.documentMeta.create({
          data: {
            ownerId: input.ownerId,
            title,
            sourceType,
            objectKey: `${input.objectKey}#${entry.relativePath}`,
            status: DOCUMENT_STATUS.QUEUED,
          },
        });

        const createdJob = await tx.ingestJob.create({
          data: {
            documentId: createdDocument.id,
            status: INGEST_STATUS.QUEUED,
          },
        });

        const createdItem = await tx.importItem.create({
          data: {
            batchId: input.batchId,
            relativePath: entry.relativePath,
            sourceType,
            status: "PROCESSING",
            documentId: createdDocument.id,
            ingestJobId: createdJob.id,
          },
        });

        return [createdDocument, createdJob, createdItem] as const;
      });

      try {
        const markdownResolver =
          sourceType === "MD"
            ? buildMarkdownResolver({
                currentFilePath: entry.relativePath,
                fileMap,
              })
            : undefined;

        await runIngestFromBuffer({
          documentId: document.id,
          ingestJobId: ingestJob.id,
          sourceType,
          ownerId: input.ownerId,
          buffer: entry.buffer,
          fileName: entry.relativePath,
          resolveMarkdownAsset: markdownResolver,
        });

        await prisma.importItem.update({
          where: { id: importItem.id },
          data: {
            status: "COMPLETED",
            errorCode: null,
            errorText: null,
          },
        });
        successCount += 1;
      } catch (error) {
        await prisma.importItem.update({
          where: { id: importItem.id },
          data: {
            status: "FAILED",
            errorCode: error instanceof ParserError ? error.code : "INGEST_FAILED",
            errorText: error instanceof Error ? error.message : "Unknown ingest error",
          },
        });
        failedCount += 1;
      }
    }

    const totalCount = extracted.files.length;
    const batchStatus =
      failedCount > 0 && successCount > 0
        ? IMPORT_BATCH_STATUS.PARTIAL_SUCCESS
        : failedCount > 0 && successCount === 0
          ? IMPORT_BATCH_STATUS.FAILED
          : IMPORT_BATCH_STATUS.COMPLETED;

    await prisma.importBatch.update({
      where: { id: input.batchId },
      data: {
        archiveFormat: extracted.archiveFormat,
        totalCount,
        successCount,
        failedCount,
        skippedCount,
        status: batchStatus,
        finishedAt: new Date(),
      },
    });

    return {
      status: batchStatus,
      totalCount,
      successCount,
      failedCount,
      skippedCount,
    };
  } catch (error) {
    await prisma.importBatch.update({
      where: { id: input.batchId },
      data: {
        status: IMPORT_BATCH_STATUS.FAILED,
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}
