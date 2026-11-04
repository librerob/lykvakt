import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";
import ts from "typescript";
import { expect, it, vi } from "vitest";

// Exercise the actual entry-point runner, including the await before actions start.
const source = ts.createSourceFile(
  "main.ts",
  readFileSync(new URL("../src/main.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const declaration = source.statements
  .filter(ts.isFunctionDeclaration)
  .find((node) => node.name?.text === "run");
if (!declaration) throw new Error("Missing application action runner.");
const code = ts.transpileModule(declaration.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2023 },
}).outputText;
type Dialog = { isConnected: boolean };
function harness(origin?: Dialog) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let epoch = 0;
  const session = {
    unlocked: true,
    epoch: () => epoch,
    validate: vi.fn(() => gate),
  };
  const announce = vi.fn();
  const make = compileFunction(
    `let dialog = origin; ${code}; return { run, replace(next) { dialog = next; } };`,
    [
      "session",
      "origin",
      "announce",
      "friendlyError",
      "OldFormatError",
      "state",
      "status",
    ],
  );
  const runner = make(
    session,
    origin,
    announce,
    () => ({ message: "failure", technical: "" }),
    class extends Error {},
    {},
    {},
  ) as {
    run: (action: () => void | Promise<void>) => Promise<void>;
    replace: (next?: Dialog) => void;
  };
  return {
    ...runner,
    release,
    session,
    announce,
    changeSession: () => epoch++,
  };
}
it.each(["closed", "replaced"])(
  "does not start a dialog action if its origin was %s during validation",
  async (mode) => {
    const origin = { isConnected: true };
    const runner = harness(origin),
      action = vi.fn();
    const pending = runner.run(action);
    expect(runner.session.validate).toHaveBeenCalledOnce();
    origin.isConnected = false;
    runner.replace(mode === "closed" ? undefined : { isConnected: true });
    runner.release();
    await pending;
    expect(action).not.toHaveBeenCalled();
    expect(runner.announce).not.toHaveBeenCalled();
  },
);
it("does not start an old action after locking and unlocking during validation", async () => {
  const runner = harness({ isConnected: true }),
    action = vi.fn();
  const pending = runner.run(action);
  runner.changeSession();
  runner.release();
  await pending;
  expect(action).not.toHaveBeenCalled();
});
it("does not let an old page action replace a newly opened dialog", async () => {
  const runner = harness(),
    action = vi.fn();
  const pending = runner.run(action);
  runner.replace({ isConnected: true });
  runner.release();
  await pending;
  expect(action).not.toHaveBeenCalled();
});
it("still runs the action when its session and originating dialog remain current", async () => {
  const runner = harness({ isConnected: true }),
    action = vi.fn();
  const pending = runner.run(action);
  runner.release();
  await pending;
  expect(action).toHaveBeenCalledOnce();
});
