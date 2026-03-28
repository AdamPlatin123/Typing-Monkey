import { Readable } from "node:stream";

export async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) {
    throw new Error("Stream is required");
  }

  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  if (stream instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  if (typeof ReadableStream !== "undefined" && stream instanceof ReadableStream) {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }

    const size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return Buffer.from(merged);
  }

  throw new Error("Unsupported stream type");
}
