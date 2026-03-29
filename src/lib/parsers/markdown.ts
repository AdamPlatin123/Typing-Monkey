import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";

import { BLOCK_TYPE } from "@/lib/domain";
import { computeParseMeta } from "@/lib/parsers/index";
import { type ParseContext, type ParseResult } from "@/lib/parsers/types";

type MdNode = {
  type?: string;
  value?: string;
  children?: MdNode[];
  depth?: number;
  lang?: string | null;
  ordered?: boolean;
  alt?: string | null;
  url?: string;
};

function nodeToText(node: MdNode | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  if (!Array.isArray(node.children)) return "";
  return node.children.map((child) => nodeToText(child)).join("").trim();
}

function isExternalUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("data:") ||
    lower.startsWith("//")
  );
}

async function pushImageBlock(
  args: {
    image: MdNode;
    blocks: ParseResult["blocks"];
    assets: ParseResult["assets"];
    warnings: string[];
    context?: ParseContext;
  },
) {
  const { image, blocks, assets, warnings, context } = args;
  const sourcePath = image.url ?? "";
  const alt = image.alt ?? undefined;

  if (!sourcePath) {
    return;
  }

  if (isExternalUrl(sourcePath) || !context?.resolveAsset) {
    blocks.push({
      type: BLOCK_TYPE.IMAGE,
      text: alt,
      attrs: {
        sourcePath,
        sourceUrl: sourcePath,
        external: true,
      },
    });

    if (!isExternalUrl(sourcePath)) {
      warnings.push("MARKDOWN_IMAGE_REFERENCES_NOT_IMPORTED");
    }
    return;
  }

  const resolved = await context.resolveAsset(sourcePath);
  if (!resolved) {
    blocks.push({
      type: BLOCK_TYPE.IMAGE,
      text: alt,
      attrs: {
        sourcePath,
        resolvedLocal: false,
      },
    });
    warnings.push("MARKDOWN_LOCAL_ASSET_NOT_FOUND");
    return;
  }

  const blockIndex = blocks.length;
  blocks.push({
    type: BLOCK_TYPE.IMAGE,
    text: alt ?? resolved.fileName,
    attrs: {
      sourcePath,
      resolvedLocal: true,
    },
  });
  assets.push({
    blockIndex,
    kind: "IMAGE",
    fileName: resolved.fileName,
    mimeType: resolved.mimeType,
    data: resolved.data,
  });
}

export async function parseMarkdown(
  buffer: Buffer,
  context?: ParseContext,
): Promise<ParseResult> {
  const raw = buffer.toString("utf8");
  const ast = unified().use(remarkParse).use(remarkGfm).parse(raw) as unknown as {
    children: MdNode[];
  };

  const blocks: ParseResult["blocks"] = [];
  const assets: ParseResult["assets"] = [];
  const warnings: string[] = [];

  let title: string | undefined;

  for (const node of ast.children ?? []) {
    switch (node.type) {
      case "heading": {
        const text = nodeToText(node);
        if (text) {
          blocks.push({ type: BLOCK_TYPE.HEADING, text, level: node.depth ?? 2 });
          if (!title && node.depth === 1) {
            title = text;
          }
        }
        break;
      }
      case "paragraph": {
        const children = node.children ?? [];
        const textParts: string[] = [];
        for (const child of children) {
          if (child.type === "image") {
            await pushImageBlock({ image: child, blocks, assets, warnings, context });
          } else {
            const piece = nodeToText(child);
            if (piece) {
              textParts.push(piece);
            }
          }
        }

        const text = textParts.join("").trim();
        if (text) {
          blocks.push({ type: BLOCK_TYPE.PARAGRAPH, text });
        }
        break;
      }
      case "blockquote": {
        const text = nodeToText(node);
        if (text) {
          blocks.push({ type: BLOCK_TYPE.QUOTE, text });
        }
        break;
      }
      case "list": {
        const listNode = node;
        for (const listItem of listNode.children ?? []) {
          const text = nodeToText(listItem);
          if (!text) continue;
          blocks.push({
            type: BLOCK_TYPE.LIST_ITEM,
            text,
            attrs: {
              ordered: Boolean(listNode.ordered),
            },
          });
        }
        break;
      }
      case "code": {
        blocks.push({
          type: BLOCK_TYPE.CODE,
          text: node.value ?? "",
          attrs: {
            lang: node.lang ?? undefined,
          },
        });
        break;
      }
      case "thematicBreak": {
        blocks.push({ type: BLOCK_TYPE.HR });
        break;
      }
      case "image": {
        await pushImageBlock({ image: node, blocks, assets, warnings, context });
        break;
      }
      default:
        break;
    }
  }

  const textBlocks = blocks
    .filter((block) => block.type !== BLOCK_TYPE.IMAGE && block.text)
    .map((block) => block.text ?? "");

  const meta = computeParseMeta(textBlocks, blocks.length);

  return {
    blocks,
    assets,
    warnings,
    meta: {
      title,
      hasText: meta.hasText,
      wordCount: meta.wordCount,
    },
  };
}
