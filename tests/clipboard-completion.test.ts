import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAccounts } from "../src/ui/accounts";
import { parseURI } from "../src/import";
import { emptyVault } from "../src/model";
import type { Session } from "../src/session";
import { context, resetUI } from "./helpers/ui";
import { testDocument, type TestElement } from "./helpers/dom";
let accounts: ReturnType<typeof createAccounts>;
beforeEach(() => {
  resetUI();
  vi.stubGlobal("document", testDocument);
  vi.stubGlobal("localStorage", { getItem: () => null });
});
afterEach(() => {
  accounts?.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  let release!: () => void, started!: () => void;
  const finished = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const writeText = vi.fn(async () => {
    started();
    await finished;
  });
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const data = emptyVault();
  data.accounts = [
    parseURI(
      "otpauth://hotp/Audit:synthetic?secret=JBSWY3DPEHPK3PXP&counter=0",
    ),
  ];
  let epoch = 0;
  const session = {
    unlocked: true,
    epoch: () => epoch,
    check() {
      if (!this.unlocked) throw Error("Locked");
    },
    accounts: () => structuredClone(data),
  };
  const ctx = context(session as unknown as Session);
  ctx.announce = vi.fn();
  accounts = createAccounts(ctx);
  const root = accounts.codesView() as unknown as TestElement;
  const copy = root
    .querySelectorAll("button")
    .find((node) => node.textContent === "Copy")!;
  return {
    ctx,
    session,
    copy,
    writing,
    release,
    writeText,
    changeEpoch: () => epoch++,
  };
}
it.each(["lock", "view change", "hide"])(
  "a clipboard reply after %s cannot announce account metadata",
  async (reason) => {
    const f = setup();
    f.copy.click();
    await f.writing;
    if (reason === "lock") {
      f.session.unlocked = false;
      f.changeEpoch();
      accounts.clear();
    } else if (reason === "view change") accounts.clear();
    else accounts.mask();
    f.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.writeText).toHaveBeenCalledOnce();
    expect(f.ctx.announce).not.toHaveBeenCalled();
  },
);
it("still announces a completed user copy while its view and session remain current", async () => {
  const f = setup();
  f.copy.click();
  await f.writing;
  f.release();
  await vi.waitFor(() =>
    expect(f.ctx.announce).toHaveBeenCalledWith(
      "Copied code for Audit synthetic. Clipboard managers may keep a copy.",
    ),
  );
});
