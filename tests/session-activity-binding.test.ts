import { beforeEach, afterEach, expect, it } from "vitest";
import { SessionBroker, type BrokerIO } from "../src/session-broker";
import {
  base64,
  importVaultKey,
  random,
  seal,
  type Envelope,
} from "../src/crypto";
import {
  envelopeBinding,
  type CachedUnlock,
  type SessionState,
} from "../src/session-cache";
import { emptyVault } from "../src/model";
let raw: Uint8Array<ArrayBuffer>,
  active: Envelope | undefined,
  state: SessionState | undefined,
  broker: SessionBroker,
  lease: CachedUnlock,
  now: number;
beforeEach(async () => {
  raw = random(32);
  now = 1_000_000;
  state = undefined;
  active = await seal(
    {
      format: "otp-vault",
      version: 2,
      kind: "vault",
      id: "activity-binding",
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
    await importVaultKey(raw),
    emptyVault(),
  );
  const io: BrokerIO = {
    read: async () => structuredClone(state),
    write: async (value) => {
      state = structuredClone(value);
    },
    active: async () => active,
    alarm: async () => {},
    now: () => now,
  };
  broker = new SessionBroker(io);
  const epoch = await broker.request({ action: "begin" }, "owner");
  lease = (await broker.request(
    {
      action: "remember",
      epoch,
      binding: await envelopeBinding(active),
      key: base64(raw),
      timeout: 300000,
    },
    "owner",
  )) as CachedUnlock;
});
afterEach(() => raw.fill(0));
for (const action of ["touch", "draft"] as const) {
  it.each(["revision", "payload"])(
    action + " rejects a stale %s binding and clears its cached key",
    async (change) => {
      active =
        change === "revision"
          ? { ...active!, revision: 1 }
          : {
              ...active!,
              payload: { ...active!.payload, iv: base64(random(12)) },
            };
      now += 1000;
      await expect(
        broker.request(
          {
            action,
            epoch: lease.epoch,
            value: { mode: "add", fields: { issuer: "synthetic" } },
          },
          "stale-view",
        ),
      ).rejects.toThrow("session ended");
      expect(state!.unlock).toBeUndefined();
    },
  );
  it(
    action + " cannot revive activity after the active vault disappears",
    async () => {
      active = undefined;
      await expect(
        broker.request(
          {
            action,
            epoch: lease.epoch,
            value: { mode: "add", fields: { issuer: "synthetic" } },
          },
          "stale-view",
        ),
      ).rejects.toThrow("session ended");
      expect(state!.unlock).toBeUndefined();
    },
  );
  it(action + " still works with the current vault binding", async () => {
    now += 1000;
    await broker.request(
      {
        action,
        epoch: lease.epoch,
        value: { mode: "add", fields: { issuer: "synthetic" } },
      },
      "owner",
    );
    expect(state!.unlock!.key).toBe(lease.key);
    expect(state!.unlock!.binding).toBe(lease.binding);
    if (action === "touch") expect(state!.unlock!.expires).toBe(now + 300000);
    else
      expect(state!.unlock!.draft).toEqual({
        mode: "add",
        fields: { issuer: "synthetic" },
      });
  });
}
