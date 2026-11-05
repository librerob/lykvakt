import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEnrollment } from "../src/ui/enrollment";
import { emptyVault, type VaultData } from "../src/model";
import { parseURI } from "../src/import";
import type { Session } from "../src/session";
import { context, ui, resetUI } from "./helpers/ui";
import { TestElement, testDocument } from "./helpers/dom";
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("../src/otp", async (original) => ({
  ...(await original<object>()),
  codeFor: generate,
}));
beforeEach(() => {
  resetUI();
  vi.stubGlobal("document", testDocument);
  generate.mockReset().mockResolvedValue("123456");
  vi.stubGlobal(
    "FormData",
    class {
      constructor(private node: TestElement) {}
      get(name: string) {
        return this.node.querySelector('[name="' + name + '"]')?.value ?? null;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function setup(existing: VaultData = emptyVault()) {
  let data = structuredClone(existing);
  const saved = vi.fn(async (next: VaultData) => {
      data = structuredClone(next);
    }),
    errors: unknown[] = [];
  const session = {
    epoch: () => 0,
    check: () => {},
    accounts: () => structuredClone(data),
    cancellationSignal: () => new AbortController().signal,
    save: saved,
  } as unknown as Session;
  const ctx = context(session);
  ctx.run = async (action) => {
    try {
      await action();
    } catch (error) {
      errors.push(error);
    }
  };
  createEnrollment(ctx, () => {}).addAccount();
  const form = ui.dialog as unknown as TestElement;
  form.querySelector('[name="issuer"]')!.value = "Example";
  form.querySelector('[name="label"]')!.value = "demo";
  const secret = form.querySelector('[name="secret"]')!;
  secret.value = "2FASTEST";
  const submit = () =>
    form.dispatchEvent(new Event("submit", { cancelable: true }));
  return {
    ctx,
    form,
    secret,
    submit,
    saved,
    errors,
    get data() {
      return data;
    },
  };
}
it("adds a manually entered account in one submit with no review screen", async () => {
  const app = setup();
  app.secret.dispatchEvent(new Event("input"));
  expect(app.form.querySelector(".short-key-warning")!.hidden).toBe(false);
  expect(app.form.querySelector('button[type="submit"]')!.textContent).toBe(
    "Add account",
  );
  app.submit();
  await vi.waitFor(() =>
    expect(app.errors.length + app.saved.mock.calls.length).toBeGreaterThan(0),
  );
  expect(app.errors).toEqual([]);
  await vi.waitFor(() => expect(app.saved).toHaveBeenCalledOnce());
  expect(app.errors).toEqual([]);
  expect(app.data.accounts[0]!.secret).toBe("2FASTEST");
  expect(app.ctx.state.view).toBe("codes");
  expect(ui.dialog).toBeUndefined();
});
it("keeps exact-duplicate and conflicting keys from adding another account", async () => {
  const account = parseURI(
    "otpauth://totp/Example:demo?secret=2FASTEST&issuer=Example",
  );
  for (const conflict of [false, true]) {
    resetUI();
    const app = setup({
      ...emptyVault(),
      accounts: [{ ...account, label: conflict ? "other" : "demo" }],
    });
    app.submit();
    await vi.waitFor(() => expect(generate).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(app.errors.length + ui.messages.length).toBeGreaterThan(0),
    );
    expect(app.saved).not.toHaveBeenCalled();
    expect(app.data.accounts).toHaveLength(1);
    expect(ui.dialog).toBe(app.form);
  }
});
it("cancels before saving if the manual dialog closes while code validation is pending", async () => {
  let complete!: (value: string) => void;
  generate.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
  );
  const app = setup();
  app.submit();
  await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
  app.ctx.closeDialog();
  complete("123456");
  await vi.waitFor(() => expect(app.errors).toHaveLength(1));
  expect(app.saved).not.toHaveBeenCalled();
  expect(app.data.accounts).toEqual([]);
});
