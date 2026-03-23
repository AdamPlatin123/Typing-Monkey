import JSZip from "jszip";
import mammoth from "mammoth";

import { BLOCK_TYPE } from "@/lib/domain";
import { ParseResult } from "@/lib/parsers/types";

const DOCX_IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

function getMimeType(name: string) {
  const lower = name.toLowerCase();
  const ext = Object.keys(DOCX_IMAGE_MIME).find((candidate) => lower.endsWith(candidate));
  return ext ? DOCX_IMAGE_MIME[ext] : "application/octet-stream";
}

export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
  const extracted = await mammoth.extractRawText({ buffer });
  const text = extracted.value.replace(/\r\n/g, "\n").trim();

  const blocks: ParseResult["blocks"] = [];
  const assets: ParseResult["assets"] = [];
  const warnings: string[] = [];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph, index) => {
    if (index === 0 && paragraph.length <= 120) {
      blocks.push({
        type: BLOCK_TYPE.HEADING,
        text: paragraph,
        level: 1,
      });
      return;
    }

    blocks.push({ type: BLOCK_TYPE.PARAGRAPH, text: paragraph });
  });

  try {
    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.keys(zip.files).filter((fileName) => fileName.startsWith("word/media/"));

    for (const fileName of mediaFiles) {
      const file = zip.files[fileName];
      if (!file) {
        continue;
      }

      const bytes = await file.async("nodebuffer");
      const blockIndex = blocks.length;
      const visibleName = fileName.split("/").pop() ?? `image-${assets.length + 1}`;

      blocks.push({
        type: BLOCK_TYPE.IMAGE,
        text: visibleName,
      });

      assets.push({
        blockIndex,
        kind: "IMAGE",
        fileName: visibleName,
        mimeType: getMimeType(visibleName),
        data: bytes,
      });
    }
  } catch (error) {
    warnings.push("DOCX_IMAGE_EXTRACTION_FAILED");
    console.error("Docx image extraction failed", error);
  }

  const allText = blocks
    .filter((block) => block.type !== BLOCK_TYPE.IMAGE)
    .map((block) => block.text ?? "")
    .join(" ")
    .trim();

  return {
    blocks,
    assets,
    warnings,
    meta: {
      title: blocks.find((block) => block.type === BLOCK_TYPE.HEADING)?.text,
      hasText: allText.length > 0,
      wordCount: allText.length ? allText.split(/\s+/).length : 0,
    },
  };
}
