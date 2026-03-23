import { BLOCK_TYPE } from "@/lib/domain";
import { type ParseResult, ParserError } from "@/lib/parsers/types";

type PdfJsModule = {
  getDocument: (params: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNo: number) => Promise<unknown>;
    }>;
  };
  OPS: {
    paintImageXObject: number;
    paintJpegXObject: number;
  };
};

type PdfPage = {
  getTextContent: () => Promise<{
    items: Array<{ str?: string }>;
  }>;
  getOperatorList: () => Promise<{
    fnArray: number[];
    argsArray: unknown[];
  }>;
  objs: {
    get: (name: string, cb: (img: unknown) => void) => void;
  };
};

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs as unknown as PdfJsModule;
}

function parseDataUrl(input: string) {
  const match = input.match(/^data:([^;]+);base64,(.*)$/i);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: Buffer.from(match[2], "base64"),
  };
}

function getImageFromObject(raw: unknown, fallbackMime: string) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const img = raw as {
    src?: string | Uint8Array;
    data?: Uint8Array;
    width?: number;
    height?: number;
  };

  if (typeof img.src === "string") {
    const parsed = parseDataUrl(img.src);
    if (parsed) {
      return {
        mimeType: parsed.mimeType,
        data: parsed.data,
        width: img.width,
        height: img.height,
      };
    }
  }

  if (img.src instanceof Uint8Array) {
    return {
      mimeType: fallbackMime,
      data: Buffer.from(img.src),
      width: img.width,
      height: img.height,
    };
  }

  if (img.data instanceof Uint8Array) {
    return {
      mimeType: fallbackMime,
      data: Buffer.from(img.data),
      width: img.width,
      height: img.height,
    };
  }

  return null;
}

async function resolvePageObj(page: PdfPage, name: string) {
  return new Promise<unknown>((resolve) => {
    const timeout = setTimeout(() => resolve(null), 500);
    try {
      page.objs.get(name, (obj) => {
        clearTimeout(timeout);
        resolve(obj);
      });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  try {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;

    const blocks: ParseResult["blocks"] = [];
    const assets: ParseResult["assets"] = [];
    const warnings: string[] = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = (await pdf.getPage(pageNo)) as PdfPage;
      const textContent = await page.getTextContent();
      const joined = textContent.items
        .map((item) => (typeof item.str === "string" ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (joined) {
        blocks.push({
          type: BLOCK_TYPE.PARAGRAPH,
          text: joined,
          attrs: { page: pageNo },
        });
      }

      try {
        const opList = await page.getOperatorList();
        const imageOps: Array<{ name: string; mimeType: string }> = [];

        for (let i = 0; i < opList.fnArray.length; i += 1) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i] as unknown[];
          const name = typeof args?.[0] === "string" ? args[0] : null;
          if (!name) {
            continue;
          }

          if (fn === pdfjs.OPS.paintJpegXObject) {
            imageOps.push({ name, mimeType: "image/jpeg" });
          } else if (fn === pdfjs.OPS.paintImageXObject) {
            imageOps.push({ name, mimeType: "application/octet-stream" });
          }
        }

        const seen = new Set<string>();
        for (const imageOp of imageOps) {
          if (seen.has(imageOp.name)) {
            continue;
          }
          seen.add(imageOp.name);

          const raw = await resolvePageObj(page, imageOp.name);
          const extracted = getImageFromObject(raw, imageOp.mimeType);
          if (!extracted) {
            continue;
          }

          const ext = extracted.mimeType.includes("jpeg") ? "jpg" : extracted.mimeType.includes("png") ? "png" : "bin";
          const fileName = `pdf-page-${pageNo}-${assets.length + 1}.${ext}`;
          const blockIndex = blocks.length;

          blocks.push({
            type: BLOCK_TYPE.IMAGE,
            text: fileName,
            attrs: {
              page: pageNo,
            },
          });

          assets.push({
            blockIndex,
            kind: "IMAGE",
            fileName,
            mimeType: extracted.mimeType,
            data: extracted.data,
            width: extracted.width,
            height: extracted.height,
          });
        }
      } catch {
        warnings.push(`PDF_IMAGE_EXTRACTION_FAILED_PAGE_${pageNo}`);
      }
    }

    if (blocks.length === 0) {
      throw new ParserError("NO_TEXT_LAYER", "PDF has no text layer");
    }

    if (assets.length === 0) {
      warnings.push("PDF_IMAGE_EXTRACTION_EMPTY");
    }

    const allText = blocks
      .filter((block) => block.type !== BLOCK_TYPE.IMAGE)
      .map((block) => block.text ?? "")
      .join(" ");

    return {
      blocks,
      assets,
      warnings,
      meta: {
        title: undefined,
        hasText: allText.trim().length > 0,
        wordCount: allText.trim().length > 0 ? allText.trim().split(/\s+/).length : 0,
      },
    };
  } catch (error) {
    const name = (error as { name?: string }).name ?? "";
    if (name.includes("Password") || name.includes("Encrypted") || name.includes("InvalidPDFPassword")) {
      throw new ParserError("UNSUPPORTED_ENCRYPTED_PDF", "Encrypted PDFs are not supported");
    }

    if (error instanceof ParserError) {
      throw error;
    }

    throw new ParserError("PDF_PARSE_FAILED", "Failed to parse PDF");
  }
}
