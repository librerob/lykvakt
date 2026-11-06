import { afterEach, beforeEach, expect, it, vi } from "vitest";
const root = "chrome-extension://" + "a".repeat(32) + "/";
let alarm: (event: { name: string }) => void;
let message: (
  request: unknown,
  sender: unknown,
  respond: (value: unknown) => void,
) => unknown;
let api: ReturnType<typeof chromeStub>;
function chromeStub() {
  return {
    runtime: {
      id: "a".repeat(32),
      getURL: (p: string) => root + p,
      reload: vi.fn(),
      getContexts: vi.fn(async () => []),
      onMessage: {
        addListener: (listener: typeof message) => {
          message = listener;
        },
      },
    },
    storage: {
      session: {
        setAccessLevel: vi.fn(async () => {}),
        get: vi.fn(async (): Promise<Record<string, unknown>> => {
          throw Error("Storage unavailable");
        }),
        set: vi.fn(async () => {}),
      },
    },
    alarms: {
      clear: vi.fn(async () => true),
      create: vi.fn(async () => {}),
      onAlarm: {
        addListener: (listener: typeof alarm) => {
          alarm = listener;
        },
      },
    },
  };
}
async function boot() {
  vi.resetModules();
  await import("../src/background");
  await new Promise((resolve) => setTimeout(resolve, 0));
}
beforeEach(() => {
  api = chromeStub();
  vi.stubGlobal("chrome", api);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("persistent storage failure on worker startup cannot create a reload loop", async () => {
  for (let i = 0; i < 3; i++) await boot();
  expect(api.runtime.reload).not.toHaveBeenCalled();
});
it("an expiry failure reloads once and the failed next startup does not reload again", async () => {
  await boot();
  expect(api.runtime.reload).not.toHaveBeenCalled();
  alarm({ name: "vault-expiry" });
  await vi.waitFor(() => expect(api.runtime.reload).toHaveBeenCalledOnce());
  await boot();
  expect(api.runtime.reload).toHaveBeenCalledOnce();
});
it("session requests stay locked while startup storage remains unavailable", async () => {
  await boot();
  const respond = vi.fn();
  message(
    { type: "lykvakt-session", action: "resume" },
    {
      id: api.runtime.id,
      url: root + "index.html?window",
      documentId: "known-document",
      frameId: 0,
    },
    respond,
  );
  await vi.waitFor(() => expect(respond).toHaveBeenCalledWith({ ok: false }));
});
it("a later storage recovery allows requests to retry without a reload", async () => {
  await boot();
  api.storage.session.get.mockResolvedValue({});
  const respond = vi.fn();
  message(
    { type: "lykvakt-session", action: "resume" },
    {
      id: api.runtime.id,
      url: root + "index.html?window",
      documentId: "known-document",
      frameId: 0,
    },
    respond,
  );
  await vi.waitFor(() => expect(respond).toHaveBeenCalled());
  expect(respond.mock.calls[0]![0]).toMatchObject({
    ok: true,
    value: undefined,
  });
  expect(api.runtime.reload).not.toHaveBeenCalled();
});
