import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { parsePptx } from "@/lib/parsers/pptx";

describe("parsePptx", () => {
  it("extracts text and image blocks", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide1.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>Slide Title</a:t></a:r></a:p>
                <a:p><a:r><a:t>Slide paragraph</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
            <p:pic>
              <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
            </p:pic>
          </p:spTree>
        </p:cSld>
      </p:sld>`,
    );
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
      </Relationships>`,
    );
    zip.file("ppt/media/image1.png", Buffer.from([1, 2, 3, 4]));

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const result = await parsePptx(buffer);

    expect(result.blocks.some((block) => block.type === "HEADING" && block.text === "Slide Title")).toBe(true);
    expect(result.blocks.some((block) => block.type === "PARAGRAPH" && block.text === "Slide paragraph")).toBe(true);
    expect(result.blocks.some((block) => block.type === "IMAGE")).toBe(true);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.mimeType).toBe("image/png");
  });
});
