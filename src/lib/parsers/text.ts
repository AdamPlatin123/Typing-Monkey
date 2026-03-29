import { BLOCK_TYPE } from "@/lib/domain";

import { computeParseMeta } from "@/lib/parsers/index";
import { ParseResult } from "@/lib/parsers/types";

export async function parsePlainText(buffer: Buffer): Promise<ParseResult> {
  const raw = buffer.toString("utf8").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  const blocks: ParseResult["blocks"] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    blocks.push({
      type: BLOCK_TYPE.PARAGRAPH,
      text: trimmed,
    });
  }

  const texts = blocks.map((block) => block.text ?? "");
  const meta = computeParseMeta(texts, blocks.length);

  return {
    blocks,
    assets: [],
    warnings: [],
    meta: {
      hasText: meta.hasText,
      title: blocks[0]?.text?.slice(0, 60),
      wordCount: meta.wordCount,
    },
  };
}
