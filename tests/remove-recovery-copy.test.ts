import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  base64,
  importVaultKey,
  random,
  seal,
  headerOf,
  type Envelope,
} from "../src/crypto";
import { emptyVault } from "../src/model";
import {
  commit,
  load,
  removeRecoveryCopy,
  StorageConflictError,
} from "../src/storage";
let first: Envelope, active: Envelope, key: CryptoKey;
beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  const raw = random(32);
  try {
    key = await importVaultKey(raw);
  } finally {
    raw.fill(0);
  }
  first = await seal(
    {
      format: "otp-vault",
      version: 2,
      kind: "vault",
      id: "recovery-removal",
      revision: 0,
      password: {
        kdf: "Argon2id",
        m: 65536,
        t: 3,
        p: 1,
        salt: base64(random(32)),
        iv: base64(random(12)),
        wrapped: base64(random(48)),
      },
    },
    key,
    emptyVault(),
  );
  await commit(first);
  active = await seal({ ...headerOf(first), revision: 1 }, key, emptyVault());
  await commit(active, first);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function record(name: string, value?: unknown) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("otp-vault", 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(
        "vault",
        value === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("vault");
      const r = value === undefined ? store.get(name) : store.put(value, name);
      tx.oncomplete = () => resolve(r.result);
      tx.onabort = tx.onerror = () => reject(new Error("Fixture failed"));
    });
  } finally {
    db.close();
  }
}
it("removes only previous and the next ordinary save recreates it from current active", async () => {
  await removeRecoveryCopy(active);
  expect(await record("previous")).toBeUndefined();
  expect(await load()).toEqual(active);
  const next = await seal(
    { ...headerOf(active), revision: 2 },
    key,
    emptyVault(),
  );
  await commit(next, active);
  expect(await record("previous")).toEqual(active);
  expect(await load()).toEqual(next);
});
it.each(["revision", "same-revision payload", "corruption"])(
  "preserves the last good copy on %s changes",
  async (change) => {
    const changed =
      change === "revision"
        ? { ...active, revision: 2 }
        : change === "corruption"
          ? { broken: true }
          : {
              ...active,
              payload: { ...active.payload, iv: base64(random(12)) },
            };
    await record("active", changed);
    await expect(removeRecoveryCopy(active)).rejects.toBeInstanceOf(
      StorageConflictError,
    );
    expect(await record("active")).toEqual(changed);
    expect(await record("previous")).toEqual(first);
  },
);
it("preserves both records on an already-cancelled request", async () => {
  const c = new AbortController();
  c.abort(new Error("Locked"));
  await expect(removeRecoveryCopy(active, c.signal)).rejects.toThrow("Locked");
  expect(await record("active")).toEqual(active);
  expect(await record("previous")).toEqual(first);
});
it("rolls back a deletion if locking cancels its transaction", async () => {
  const c = new AbortController(),
    original = IDBObjectStore.prototype.delete;
  vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(
    function (name) {
      const request = original.call(this, name);
      c.abort(new Error("Locked"));
      return request;
    },
  );
  await expect(removeRecoveryCopy(active, c.signal)).rejects.toThrow("Locked");
  expect(await record("active")).toEqual(active);
  expect(await record("previous")).toEqual(first);
});
it("preserves both copies if the deletion fails", async () => {
  vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(() => {
    throw new DOMException("Synthetic failure", "QuotaExceededError");
  });
  await expect(removeRecoveryCopy(active)).rejects.toThrow("unchanged");
  expect(await record("active")).toEqual(active);
  expect(await record("previous")).toEqual(first);
});
it("removing an already-absent copy is harmless", async () => {
  await removeRecoveryCopy(active);
  await removeRecoveryCopy(active);
  expect(await record("previous")).toBeUndefined();
  expect(await record("active")).toEqual(active);
});
