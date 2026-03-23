import { describe, expect, it } from "vitest";

import { parseMarkdown } from "@/lib/parsers/markdown";

describe("parseMarkdown", () => {
  it("extracts structured blocks", async () => {
    const markdown = Buffer.from(
      "# Guide\n\nParagraph text\n\n- first\n- second\n\n```ts\nconst answer = 42;\n```",
    );

    const result = await parseMarkdown(markdown);

    expect(result.blocks.some((block) => block.type === "HEADING" && block.text === "Guide")).toBe(true);
    expect(result.blocks.some((block) => block.type === "PARAGRAPH" && block.text === "Paragraph text")).toBe(true);
    expect(result.blocks.filter((block) => block.type === "LIST_ITEM")).toHaveLength(2);
    expect(result.blocks.some((block) => block.type === "CODE")).toBe(true);
    expect(result.meta.wordCount).toBeGreaterThan(0);
  });

  it("resolves local image in markdown", async () => {
    const markdown = Buffer.from("# Guide\n\n![img](./assets/a.png)");
    const result = await parseMarkdown(markdown, {
      sourceType: "MD",
      resolveAsset: async (sourcePath) => {
        if (sourcePath !== "./assets/a.png") {
          return null;
        }

        return {
          fileName: "a.png",
          mimeType: "image/png",
          data: Buffer.from([1, 2, 3]),
        };
      },
    });

    expect(result.blocks.some((block) => block.type === "IMAGE")).toBe(true);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.mimeType).toBe("image/png");
  });
});
