import { DOCUMENT_SOURCE, type DocumentSourceType } from "@/lib/domain";

import { parseDocx } from "@/lib/parsers/docx";
import { parseMarkdown } from "@/lib/parsers/markdown";
import { parsePdf } from "@/lib/parsers/pdf";
import { parsePlainText } from "@/lib/parsers/text";
import { parsePpt } from "@/lib/parsers/ppt";
import { parsePptx } from "@/lib/parsers/pptx";
import { type ParseContext, type ParseResult } from "@/lib/parsers/types";

export async function parseDocument(params: {
  sourceType: DocumentSourceType;
  buffer: Buffer;
  context?: Omit<ParseContext, "sourceType">;
}): Promise<ParseResult> {
  const context: ParseContext = {
    sourceType: params.sourceType,
    ...params.context,
  };

  switch (params.sourceType) {
    case DOCUMENT_SOURCE.MD:
      return parseMarkdown(params.buffer, context);
    case DOCUMENT_SOURCE.TXT:
      return parsePlainText(params.buffer);
    case DOCUMENT_SOURCE.DOCX:
      return parseDocx(params.buffer);
    case DOCUMENT_SOURCE.PDF:
      return parsePdf(params.buffer);
    case DOCUMENT_SOURCE.PPTX:
      return parsePptx(params.buffer);
    case DOCUMENT_SOURCE.PPT:
      return parsePpt(params.buffer);
    default:
      throw new Error("UNSUPPORTED_SOURCE_TYPE");
  }
}
