import { type BlockType, type DocumentSourceType } from "@/lib/domain";

export type ParsedBlock = {
  type: BlockType;
  text?: string;
  level?: number;
  attrs?: Record<string, unknown>;
};

export type ParsedAsset = {
  blockIndex: number;
  kind: "IMAGE";
  fileName: string;
  mimeType: string;
  data: Buffer;
  width?: number;
  height?: number;
};

export type ParseResult = {
  blocks: ParsedBlock[];
  assets: ParsedAsset[];
  warnings: string[];
  meta: {
    title?: string;
    wordCount: number;
    hasText: boolean;
  };
};

export type ParsedResolvedAsset = {
  fileName: string;
  mimeType: string;
  data: Buffer;
};

export type ParseContext = {
  sourceType: DocumentSourceType;
  fileName?: string;
  contentType?: string;
  resolveAsset?: (sourcePath: string) => Promise<ParsedResolvedAsset | null>;
};

export class ParserError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
