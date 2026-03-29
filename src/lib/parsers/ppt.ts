import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { env } from "@/lib/env";
import { runProcess } from "@/lib/process";
import { parsePptx } from "@/lib/parsers/pptx";
import { type ParseResult, ParserError } from "@/lib/parsers/types";

async function convertPptToPptxBuffer(buffer: Buffer): Promise<Buffer> {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "typingmonkey-ppt-"));
  const srcPath = path.join(tmpRoot, "input.ppt");
  const outPath = path.join(tmpRoot, "input.pptx");

  try {
    await fs.writeFile(srcPath, buffer);
    await runProcess(env.LIBREOFFICE_PATH, [
      "--headless",
      "--convert-to",
      "pptx",
      "--outdir",
      tmpRoot,
      srcPath,
    ]);

    const exists = await fs
      .stat(outPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      throw new ParserError("PPT_CONVERSION_FAILED", "Converted PPTX file not found");
    }

    return fs.readFile(outPath);
  } catch (error) {
    if (error instanceof ParserError) {
      throw error;
    }

    throw new ParserError(
      "PPT_CONVERSION_FAILED",
      error instanceof Error ? error.message : "Failed to convert PPT",
    );
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

export async function parsePpt(buffer: Buffer): Promise<ParseResult> {
  const converted = await convertPptToPptxBuffer(buffer);
  const parsed = await parsePptx(converted);

  return {
    ...parsed,
    warnings: [...parsed.warnings, "PPT_CONVERTED_TO_PPTX"],
  };
}
