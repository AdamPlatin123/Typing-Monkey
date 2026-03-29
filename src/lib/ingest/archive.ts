import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import JSZip from "jszip";

import { ARCHIVE_FORMAT, type ArchiveFormat } from "@/lib/domain";
import { env } from "@/lib/env";
import { detectArchiveFormat, sanitizeRelativePath } from "@/lib/file";
import { runProcess } from "@/lib/process";
import { ParserError } from "@/lib/parsers/types";

type ExtractedFile = {
  relativePath: string;
  buffer: Buffer;
};

async function collectFilesFromDirectory(root: string): Promise<ExtractedFile[]> {
  const output: ExtractedFile[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const rel = sanitizeRelativePath(path.relative(root, abs));
      const buffer = await fs.readFile(abs);
      output.push({ relativePath: rel, buffer });
    }
  }

  return output;
}

function assertArchiveLimits(files: ExtractedFile[]) {
  if (files.length > env.MAX_ARCHIVE_ENTRIES) {
    throw new ParserError(
      "ARCHIVE_TOO_MANY_ENTRIES",
      `Archive entries exceed limit ${env.MAX_ARCHIVE_ENTRIES}`,
    );
  }

  const totalBytes = files.reduce((sum, item) => sum + item.buffer.length, 0);
  const maxBytes = env.MAX_EXTRACTED_TOTAL_MB * 1024 * 1024;
  if (totalBytes > maxBytes) {
    throw new ParserError(
      "ARCHIVE_EXTRACTED_TOO_LARGE",
      `Archive extracted size exceeds ${env.MAX_EXTRACTED_TOTAL_MB}MB`,
    );
  }
}

async function extractZip(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const files: ExtractedFile[] = [];

  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      continue;
    }

    const relativePath = sanitizeRelativePath(entryName);
    const fileBuffer = await entry.async("nodebuffer");
    files.push({
      relativePath,
      buffer: fileBuffer,
    });
  }

  assertArchiveLimits(files);
  return files;
}

async function extractBy7z(buffer: Buffer, archiveFormat: ArchiveFormat) {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "typingmonkey-archive-"));
  const ext = archiveFormat === ARCHIVE_FORMAT.RAR ? ".rar" : ".7z";
  const archivePath = path.join(tmpRoot, `input${ext}`);
  const outDir = path.join(tmpRoot, "out");

  await fs.mkdir(outDir, { recursive: true });

  try {
    await fs.writeFile(archivePath, buffer);

    await runProcess(env.SEVEN_ZIP_PATH, ["x", "-y", archivePath, `-o${outDir}`]);

    const files = await collectFilesFromDirectory(outDir);
    assertArchiveLimits(files);
    return files;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archive extraction failed";
    if (/password/i.test(message)) {
      throw new ParserError("ARCHIVE_PASSWORD_PROTECTED", message);
    }

    throw new ParserError("ARCHIVE_EXTRACT_FAILED", message);
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

export async function extractArchiveFromBuffer(params: {
  fileName: string;
  buffer: Buffer;
}): Promise<{ archiveFormat: ArchiveFormat; files: ExtractedFile[] }> {
  const archiveFormat = detectArchiveFormat(params.fileName);

  switch (archiveFormat) {
    case ARCHIVE_FORMAT.ZIP: {
      const files = await extractZip(params.buffer);
      return { archiveFormat, files };
    }
    case ARCHIVE_FORMAT.SEVEN_Z:
    case ARCHIVE_FORMAT.RAR: {
      const files = await extractBy7z(params.buffer, archiveFormat);
      return { archiveFormat, files };
    }
    default:
      throw new ParserError("UNSUPPORTED_ARCHIVE_FORMAT", "Archive format is unsupported");
  }
}
