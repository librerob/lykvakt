import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSettings } from "../src/ui/settings";
import type { Session } from "../src/session";
import { context } from "./helpers/ui";
import { primaryText, type TestElement, testDocument } from "./helpers/dom";

beforeEach(() => {
  vi.stubGlobal("document", testDocument);
  vi.stubGlobal("localStorage", { getItem: () => null });
});
afterEach(() => vi.unstubAllGlobals());

it.each([300_000, 0])(
  "keeps the browser-session trade-off visible with timeout %i",
  (timeout) => {
    const setTimeout = vi.fn();
    const session = { timeout, setTimeout } as unknown as Session;
    const view = createSettings(
      context(session),
    ).settingsView() as unknown as TestElement;
    const text = primaryText(view);
    expect(text).toContain("there is no inactivity timeout");
    expect(text).toContain("even after you close the popup or window");
    expect(text).toContain("temporary memory, not your master password");
    expect(text).toContain("press Lock when you are finished");
    expect(view.querySelector("details")).toBeNull();
    expect(setTimeout).not.toHaveBeenCalled();
    expect(session.timeout).toBe(timeout);
  },
);
