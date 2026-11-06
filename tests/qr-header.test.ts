import { afterEach, expect, it, vi } from "vitest";
import { checkQRHeader, headerDimensions } from "../src/qr-header";
function png(width: number, height: number) {
  const b = new Uint8Array(33),
    v = new DataView(b.buffer);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  v.setUint32(8, 13);
  b.set([73, 72, 68, 82], 12);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}
function jpeg(width: number, height: number) {
  const b = new Uint8Array([
      255, 216, 255, 192, 0, 8, 8, 0, 0, 0, 0, 1, 255, 218,
    ]),
    v = new DataView(b.buffer);
  v.setUint16(7, height);
  v.setUint16(9, width);
  return b;
}
function webp(width: number, height: number) {
  const b = new Uint8Array(30),
    v = new DataView(b.buffer);
  b.set([82, 73, 70, 70], 0);
  v.setUint32(4, 22, true);
  b.set([87, 69, 66, 80, 86, 80, 56, 88], 8);
  v.setUint32(16, 10, true);
  for (const [n, p] of [
    [width - 1, 24],
    [height - 1, 27],
  ] as const) {
    b[p] = n! & 255;
    b[p! + 1] = (n! >>> 8) & 255;
    b[p! + 2] = (n! >>> 16) & 255;
  }
  return b;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it.each([
  ["image/png", png],
  ["image/jpeg", jpeg],
  ["image/webp", webp],
] as const)(
  "bounds %s dimensions from the header without allocating pixels",
  async (type, make) => {
    await expect(
      checkQRHeader(new Blob([make(640, 480)], { type })),
    ).resolves.toBeUndefined();
    await expect(
      checkQRHeader(new Blob([make(6001, 4000)], { type })),
    ).rejects.toThrow("dimensions");
    await expect(
      checkQRHeader(new Blob([make(4000, 4000)], { type })),
    ).rejects.toThrow("dimensions");
  },
);
it.each(["image/png", "image/jpeg", "image/webp"])(
  "rejects truncated or mismatched %s headers",
  async (type) => {
    await expect(
      checkQRHeader(new Blob([new Uint8Array([0, 1, 2])], { type })),
    ).rejects.toThrow("header");
    if (type === "image/png")
      await expect(
        checkQRHeader(new Blob([png(1, 1)], { type })),
      ).resolves.toBeUndefined();
    else
      await expect(
        checkQRHeader(new Blob([png(1, 1)], { type })),
      ).rejects.toThrow("header");
  },
);
it("caps header reads at one MiB and rejects JPEG metadata beyond that bound", async () => {
  const bytes = new Uint8Array(1_100_000);
  bytes.set([255, 216]);
  let p = 2;
  while (p + 65537 < bytes.length) {
    bytes.set([255, 225, 255, 255], p);
    p += 65537;
  }
  const file = new Blob([bytes], { type: "image/jpeg" }),
    slice = vi.spyOn(file, "slice");
  await expect(checkQRHeader(file)).rejects.toThrow("header");
  expect(slice).toHaveBeenCalledExactlyOnceWith(0, 1_048_576);
});
it.each([
  ["image/png", png],
  ["image/jpeg", jpeg],
  ["image/webp", webp],
] as const)(
  "rejects oversized %s before calling the browser decoder",
  async (type, make) => {
    const decode = vi.fn(async () => {
      throw Error("Bitmap decoder was called");
    });
    const postMessage = vi.fn(),
      scope = { onmessage: undefined as unknown, postMessage };
    vi.stubGlobal("self", scope);
    vi.stubGlobal("createImageBitmap", decode);
    await import("../src/qr.worker");
    (scope.onmessage as (event: { data: Blob }) => void)({
      data: new Blob([make(6001, 4000)], { type }),
    });
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(decode).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      error: expect.stringContaining("dimensions"),
    });
  },
);
it("rejects malformed WebP chunk sizes without reading beyond the header", () => {
  const b = webp(100, 100);
  new DataView(b.buffer).setUint32(16, 0xffffffff, true);
  expect(() => headerDimensions(b, "image/webp", b.length)).toThrow("header");
});

it.each(["VP8 ", "VP8L"])("reads bounded %s WebP frame dimensions", (tag) => {
  const make = (width: number, height: number) => {
    const b = new Uint8Array(tag === "VP8 " ? 30 : 26),
      v = new DataView(b.buffer);
    b.set([82, 73, 70, 70]);
    v.setUint32(4, b.length - 8, true);
    b.set([87, 69, 66, 80], 8);
    b.set(
      [...tag].map((c) => c.charCodeAt(0)),
      12,
    );
    if (tag === "VP8 ") {
      v.setUint32(16, 10, true);
      b.set([157, 1, 42], 23);
      v.setUint16(26, width, true);
      v.setUint16(28, height, true);
    } else {
      v.setUint32(16, 5, true);
      b[20] = 47;
      v.setUint32(21, (width - 1) | ((height - 1) << 14), true);
    }
    return b;
  };
  expect(() =>
    headerDimensions(make(640, 480), "image/webp", tag === "VP8 " ? 30 : 26),
  ).not.toThrow();
  expect(() =>
    headerDimensions(make(6001, 4000), "image/webp", tag === "VP8 " ? 30 : 26),
  ).toThrow("dimensions");
});
it("explains a rejected header without blaming the password or echoing file contents", async () => {
  const { friendlyError } = await import("../src/help");
  const message =
    "QR image header could not be read. Try a cropped PNG, JPEG or WebP image.";
  expect(friendlyError(new Error(message)).message).toBe(message);
});
