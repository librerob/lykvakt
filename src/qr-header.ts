import { checkQRDimensions, checkQRFile } from "./qr-policy";
const HEADER_BYTES = 1_048_576;
const invalid = () =>
  new Error(
    "QR image header could not be read. Try a cropped PNG, JPEG or WebP image.",
  );
export function headerDimensions(
  bytes: Uint8Array,
  type: string,
  size: number,
): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const need = (offset: number, count: number) => {
    if (offset < 0 || count < 0 || offset + count > bytes.length)
      throw invalid();
  };
  const text = (offset: number, value: string) => {
    need(offset, value.length);
    for (let i = 0; i < value.length; i++)
      if (bytes[offset + i] !== value.charCodeAt(i)) return false;
    return true;
  };
  if (type === "image/png") {
    need(0, 24);
    if (
      !text(0, "\x89PNG\r\n\x1a\n") ||
      view.getUint32(8) !== 13 ||
      !text(12, "IHDR")
    )
      throw invalid();
    checkQRDimensions(view.getUint32(16), view.getUint32(20));
    return;
  }
  if (type === "image/jpeg") {
    need(0, 2);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw invalid();
    let offset = 2,
      found = false;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) throw invalid();
      while (bytes[offset] === 0xff) offset++;
      need(offset, 1);
      const marker = bytes[offset++]!;
      if (marker === 0xda) {
        if (!found) throw invalid();
        return;
      }
      if (marker === 0xd9 || marker === 0xd8 || marker === 0) throw invalid();
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      need(offset, 2);
      const length = view.getUint16(offset);
      if (length < 2) throw invalid();
      need(offset, length);
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        if (found || length < 8) throw invalid();
        checkQRDimensions(
          view.getUint16(offset + 5),
          view.getUint16(offset + 3),
        );
        found = true;
      }
      offset += length;
    }
    throw invalid();
  }
  if (type === "image/webp") {
    need(0, 12);
    if (
      !text(0, "RIFF") ||
      !text(8, "WEBP") ||
      view.getUint32(4, true) + 8 !== size
    )
      throw invalid();
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const length = view.getUint32(offset + 4, true),
        data = offset + 8;
      if (data + length > size) throw invalid();
      if (text(offset, "VP8X")) {
        if (length !== 10) throw invalid();
        need(data, 10);
        const uint24 = (p: number) =>
          bytes[p]! + bytes[p + 1]! * 256 + bytes[p + 2]! * 65536;
        checkQRDimensions(uint24(data + 4) + 1, uint24(data + 7) + 1);
        return;
      }
      if (text(offset, "VP8 ")) {
        if (length < 10) throw invalid();
        need(data, 10);
        if ((bytes[data]! & 1) !== 0 || !text(data + 3, "\x9d\x01\x2a"))
          throw invalid();
        checkQRDimensions(
          view.getUint16(data + 6, true) & 0x3fff,
          view.getUint16(data + 8, true) & 0x3fff,
        );
        return;
      }
      if (text(offset, "VP8L")) {
        if (length < 5) throw invalid();
        need(data, 5);
        if (bytes[data] !== 0x2f) throw invalid();
        const bits = view.getUint32(data + 1, true);
        if (bits >>> 29) throw invalid();
        checkQRDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
        return;
      }
      offset = data + length + (length & 1);
    }
  }
  throw invalid();
}
export async function checkQRHeader(file: Blob): Promise<void> {
  checkQRFile(file);
  const bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  try {
    headerDimensions(bytes, file.type, file.size);
  } finally {
    bytes.fill(0);
  }
}
