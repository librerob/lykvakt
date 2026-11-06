import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as crypto from "../src/crypto";
import * as storage from "../src/storage";
import { emptyVault } from "../src/model";
import type { Session } from "../src/session";
import { createRecovery } from "../src/ui/recovery";
import { click, context, resetUI, send, set, ui } from "./helpers/ui";
vi.mock("../src/dom", async () => import("./helpers/ui"));
let raw: Uint8Array, abort: AbortController, expected: crypto.Envelope;
function setup() {
  const session = {
    check: vi.fn(),
    epoch: () => 0,
    cancellationSignal: () => abort.signal,
    current: () => expected,
    accounts: () => emptyVault(),
  } as unknown as Session;
  const ctx = context(session);
  createRecovery(ctx, async () => {}).backupsView();
  return ctx;
}
beforeEach(() => {
  resetUI();
  abort = new AbortController();
  raw = new Uint8Array(32).fill(7);
  expected = { id: "synthetic", revision: 1 } as crypto.Envelope;
  vi.spyOn(crypto, "unwrapPassword").mockResolvedValue(raw);
  vi.spyOn(storage, "removeRecoveryCopy").mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());
it("requires authentication before removing a copy and clears temporary key bytes and input", async () => {
  setup();
  await click("Remove recent recovery copy…");
  expect(storage.removeRecoveryCopy).not.toHaveBeenCalled();
  set("password", "synthetic password");
  await send();
  expect(crypto.unwrapPassword).toHaveBeenCalledWith(
    expected,
    "synthetic password",
    expect.any(AbortSignal),
  );
  expect([...raw]).toEqual(Array(32).fill(0));
  expect(storage.removeRecoveryCopy).toHaveBeenCalledWith(
    expected,
    expect.any(AbortSignal),
  );
  expect(ui.fields.get("password")?.value).toBe("");
  expect(ui.dialog).toBeUndefined();
});
it("a wrong password leaves the recovery copy alone and clears the field", async () => {
  setup();
  await click("Remove recent recovery copy…");
  vi.mocked(crypto.unwrapPassword).mockRejectedValue(
    new Error("Wrong password"),
  );
  set("password", "wrong");
  await expect(send()).rejects.toThrow("Wrong password");
  expect(storage.removeRecoveryCopy).not.toHaveBeenCalled();
  expect(ui.fields.get("password")?.value).toBe("");
});
it("locking during authentication cancels deletion", async () => {
  setup();
  await click("Remove recent recovery copy…");
  vi.mocked(crypto.unwrapPassword).mockImplementation(async () => {
    abort.abort(new Error("Locked"));
    return raw;
  });
  set("password", "synthetic");
  await expect(send()).rejects.toThrow("Locked");
  expect(storage.removeRecoveryCopy).not.toHaveBeenCalled();
  expect([...raw]).toEqual(Array(32).fill(0));
  expect(ui.fields.get("password")?.value).toBe("");
});
it("a concurrent active-record change is reported without claiming success", async () => {
  setup();
  await click("Remove recent recovery copy…");
  vi.mocked(storage.removeRecoveryCopy).mockRejectedValue(
    new storage.StorageConflictError(),
  );
  set("password", "synthetic");
  await expect(send()).rejects.toThrow("changed");
  expect(ui.messages).not.toContain(
    "Recent recovery copy removed. Your current vault is unchanged.",
  );
  expect(ui.fields.get("password")?.value).toBe("");
});
