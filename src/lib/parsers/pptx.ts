import path from "node:path";

import JSZip from "jszip";

import { BLOCK_TYPE } from "@/lib/domain";
import { getImageMimeType } from "@/lib/file";
import { computeParseMeta } from "@/lib/parsers/index";
import { type ParseResult } from "@/lib/parsers/types";

function decodeXmlText(input: string) {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/gi, "\n");
}

function sortSlideFiles(files: string[]) {
  return files.sort((a, b) => {
    const aNo = Number(a.match(/slide(\d+)\.xml$/i)?.[1] ?? "0");
    const bNo = Number(b.match(/slide(\d+)\.xml$/i)?.[1] ?? "0");
    return aNo - bNo;
  });
}

function relPathForSlide(slidePath: string) {
  const dir = path.posix.dirname(slidePath);
  const file = path.posix.basename(slidePath);
  return `${dir}/_rels/${file}.rels`;
}

function resolveTargetPath(fromPath: string, target: string) {
  const fromDir = path.posix.dirname(fromPath);
  return path.posix.normalize(path.posix.join(fromDir, target));
}

function parseSlideRelationshipMap(relXml: string) {
  const map = new Map<string, string>();
  const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>(?:<\/Relationship>)?/gi;
  let match = relRegex.exec(relXml);
  while (match) {
    map.set(match[1], match[2]);
    match = relRegex.exec(relXml);
  }
  return map;
}

function parseSlideTextParagraphs(slideXml: string) {
  const paragraphs: Array<{ text: string; isList: boolean }> = [];
  const paragraphRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi;
  let paragraphMatch = paragraphRegex.exec(slideXml);

  while (paragraphMatch) {
    const rawParagraph = paragraphMatch[1];
    const textParts: string[] = [];
    const textRegex = /<a:t>([\s\S]*?)<\/a:t>/gi;
    let textMatch = textRegex.exec(rawParagraph);

    while (textMatch) {
      const cleaned = decodeXmlText(textMatch[1]).trim();
      if (cleaned) {
        textParts.push(cleaned);
      }
      textMatch = textRegex.exec(rawParagraph);
    }

    const text = textParts.join("").trim();
    if (text) {
      paragraphs.push({
        text,
        isList: /<a:buChar\b|<a:buAutoNum\b/i.test(rawParagraph),
      });
    }

    paragraphMatch = paragraphRegex.exec(slideXml);
  }

  return paragraphs;
}

function parseSlidePictureEmbeds(slideXml: string) {
  const rids: string[] = [];
  const picRegex = /<p:pic\b[\s\S]*?<a:blip\b[^>]*r:embed="([^"]+)"[^>]*\/?>(?:<\/a:blip>)?[\s\S]*?<\/p:pic>/gi;
  let match = picRegex.exec(slideXml);
  while (match) {
    rids.push(match[1]);
    match = picRegex.exec(slideXml);
  }
  return rids;
}

export async function parsePptx(buffer: Buffer): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  const allFiles = Object.keys(zip.files);
  const slideFiles = sortSlideFiles(
    allFiles.filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)),
  );

  const blocks: ParseResult["blocks"] = [];
  const assets: ParseResult["assets"] = [];
  const warnings: string[] = [];

  for (let slideIndex = 0; slideIndex < slideFiles.length; slideIndex += 1) {
    const slidePath = slideFiles[slideIndex];
    const slideNo = slideIndex + 1;
    const slideFile = zip.files[slidePath];
    if (!slideFile) {
      continue;
    }

    const slideXml = await slideFile.async("text");

    const paragraphs = parseSlideTextParagraphs(slideXml);
    let order = 0;
    for (let i = 0; i < paragraphs.length; i += 1) {
      const item = paragraphs[i];
      if (i === 0) {
        blocks.push({
          type: BLOCK_TYPE.HEADING,
          text: item.text,
          level: 2,
          attrs: { slide: slideNo, order: order++ },
        });
      } else if (item.isList) {
        blocks.push({
          type: BLOCK_TYPE.LIST_ITEM,
          text: item.text,
          attrs: { slide: slideNo, order: order++ },
        });
      } else {
        blocks.push({
          type: BLOCK_TYPE.PARAGRAPH,
          text: item.text,
          attrs: { slide: slideNo, order: order++ },
        });
      }
    }

    const relPath = relPathForSlide(slidePath);
    const relFile = zip.files[relPath];
    const relMap = relFile
      ? parseSlideRelationshipMap(await relFile.async("text"))
      : new Map<string, string>();

    const pictureEmbedIds = parseSlidePictureEmbeds(slideXml);

    for (const rid of pictureEmbedIds) {
      const target = relMap.get(rid);
      if (!target) {
        warnings.push(`PPTX_IMAGE_REL_NOT_FOUND:${slideNo}:${rid}`);
        continue;
      }

      const resolved = resolveTargetPath(slidePath, target);
      const mediaFile = zip.files[resolved];
      if (!mediaFile) {
        warnings.push(`PPTX_IMAGE_FILE_NOT_FOUND:${slideNo}:${resolved}`);
        continue;
      }

      const mediaData = await mediaFile.async("nodebuffer");
      const fileName = path.posix.basename(resolved);
      const blockIndex = blocks.length;

      blocks.push({
        type: BLOCK_TYPE.IMAGE,
        text: fileName,
        attrs: {
          slide: slideNo,
          order: order++,
          sourcePath: resolved,
        },
      });

      assets.push({
        blockIndex,
        kind: "IMAGE",
        fileName,
        mimeType: getImageMimeType(fileName) ?? "application/octet-stream",
        data: mediaData,
      });
    }
  }

  const textBlocks = blocks
    .filter((block) => block.type !== BLOCK_TYPE.IMAGE)
    .map((block) => block.text ?? "");

  const meta = computeParseMeta(textBlocks, blocks.length);

  const titleBlock = blocks.find((block) => block.type === BLOCK_TYPE.HEADING && typeof block.text === "string");

  return {
    blocks,
    assets,
    warnings,
    meta: {
      title: titleBlock?.text,
      hasText: meta.hasText,
      wordCount: meta.wordCount,
    },
  };
}
