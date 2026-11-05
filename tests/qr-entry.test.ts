import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEnrollment } from "../src/ui/enrollment";
import { emptyVault } from "../src/model";
import type { Session } from "../src/session";
import { context, ui, resetUI } from "./helpers/ui";
import { TestElement, testDocument } from "./helpers/dom";
const { decode } = vi.hoisted(() => ({ decode: vi.fn() }));
vi.mock("../src/qr", () => ({ readQRs: decode }));
beforeEach(() => {
  resetUI();
  decode.mockReset();
  vi.stubGlobal("document", testDocument);
});
afterEach(() => vi.unstubAllGlobals());
function setup(popup = false) {
  const save = vi.fn(),
    errors: unknown[] = [];
  const session = {
    check: () => {},
    epoch: () => 0,
    accounts: () => emptyVault(),
    cancellationSignal: () => new AbortController().signal,
    save,
  } as unknown as Session;
  const ctx = context(session);
  ctx.isPopup = popup;
  ctx.run = async (action) => {
    try {
      await action();
    } catch (e) {
      errors.push(e);
    }
  };
  return { ctx, save, errors, tools: createEnrollment(ctx, () => {}) };
}
function imageEvent(kind: string, file: File) {
  return Object.assign(new Event(kind, { cancelable: true }), {
    [kind === "paste" ? "clipboardData" : "dataTransfer"]: { files: [file] },
  });
}
it("offers QR import before text inputs with an explicit format hint", () => {
  const { tools } = setup();
  tools.importAccounts();
  const view = ui.dialog as unknown as TestElement;
  const action = view
    .querySelectorAll("button")
    .find((b) => b.textContent === "Import QR image");
  expect(action).toBeDefined();
  expect(action!.getAttribute("aria-describedby")).toBe("qr-import-formats");
  expect(view.textContent.indexOf("Import QR image")).toBeLessThan(
    view.textContent.indexOf("Setup links or export text"),
  );
  expect(view.textContent).toContain(
    "Choose image, paste, or drop — PNG, JPEG or WebP",
  );
  action!.click();
  const qr = ui.dialog as unknown as TestElement;
  expect(qr.querySelector("textarea")!.hasAttribute("readonly")).toBe(true);
  expect(qr.querySelector('[name="file"]')).toBeNull();
  expect(qr.querySelector('[name="sourcePassword"]')).toBeNull();
  expect(qr.querySelector('button[type="submit"]')).toBeNull();
});
it.each([false, true])(
  "shows the correct file-choice action in popup=%s",
  (popup) => {
    const { tools } = setup(popup);
    tools.importAccounts(true);
    const view = ui.dialog as unknown as TestElement;
    expect(view.textContent).toContain("Paste or drop a QR image");
    expect(view.textContent).toContain(
      "Choose image, paste, or drop — PNG, JPEG or WebP",
    );
    if (popup) {
      expect(view.querySelector('input[type="file"]')).toBeNull();
      expect(view.textContent).toContain("Open in a window to choose a file");
    } else {
      const file = view.querySelector('input[type="file"]')!;
      expect((file as unknown as HTMLInputElement).accept).toBe(
        "image/png,image/jpeg,image/webp",
      );
      expect(view.textContent).not.toContain(
        "Open in a window to choose a file",
      );
    }
  },
);
it.each(["image/png", "image/jpeg", "image/webp"])(
  "reviews explicitly pasted %s images before any save",
  async (mime) => {
    const { tools, save, errors } = setup();
    tools.importAccounts(true);
    decode.mockResolvedValue([
      "otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&issuer=Example",
    ]);
    const area = (ui.dialog as unknown as TestElement).querySelector(
      "textarea",
    )!;
    const file = new File(["synthetic"], "qr", { type: mime });
    area.dispatchEvent(imageEvent("paste", file));
    await vi.waitFor(() =>
      expect((ui.dialog as unknown as TestElement).textContent).toContain(
        "1 new account",
      ),
    );
    expect(decode).toHaveBeenCalledWith(file, expect.any(AbortSignal));
    expect(save).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  },
);
it("cancels a QR-only read when the dialog closes", async () => {
  const { ctx, tools, save } = setup();
  let complete!: (value: string[]) => void;
  decode.mockImplementation(
    () =>
      new Promise<string[]>((resolve) => {
        complete = resolve;
      }),
  );
  tools.importAccounts(true);
  const area = (ui.dialog as unknown as TestElement).querySelector("textarea")!;
  area.dispatchEvent(
    imageEvent(
      "drop",
      new File(["synthetic"], "qr.png", { type: "image/png" }),
    ),
  );
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
  ctx.closeDialog();
  complete(["otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP"]);
  await Promise.resolve();
  await Promise.resolve();
  expect(ui.dialog).toBeUndefined();
  expect(save).not.toHaveBeenCalled();
});

it("explains text-only paste without reading, echoing or importing clipboard text", () => {
  const { tools, save } = setup();
  tools.importAccounts(true);
  const area = (ui.dialog as unknown as TestElement).querySelector("textarea")!;
  const event = Object.assign(new Event("paste", { cancelable: true }), {
    clipboardData: {
      files: [],
      getData: () => {
        throw Error("Clipboard text was read");
      },
    },
  });
  area.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(ui.messages).toContain(
    "No image was pasted. Copy the QR image itself, or choose an image file.",
  );
  expect(decode).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it("shows compatibility notes from QR payloads before any account is saved", async () => {
  const { tools, save, errors } = setup();
  decode.mockResolvedValue([
    "otpauth://TOTP/Old:synthetic?secret=MZ&issuer=Explicit&extra=PRIVATE_METADATA",
  ]);
  tools.importAccounts(true);
  (ui.dialog as unknown as TestElement)
    .querySelector("textarea")!
    .dispatchEvent(
      imageEvent(
        "paste",
        new File(["synthetic"], "qr.png", { type: "image/png" }),
      ),
    );
  await vi.waitFor(() =>
    expect(
      (ui.dialog as unknown as TestElement).querySelector(".import-warnings"),
    ).not.toBeNull(),
  );
  const view = ui.dialog as unknown as TestElement;
  expect(view.textContent).toContain("unused Base32 bits");
  expect(view.textContent).toContain("Explicit");
  expect(view.textContent).not.toContain("PRIVATE_METADATA");
  expect(save).not.toHaveBeenCalled();
  expect(errors).toEqual([]);
});
