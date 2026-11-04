import { expect, it } from "vitest";
import { normalizeSecret } from "../src/otp";
import { friendlyError } from "../src/help";
function failure(input: string) {
  try {
    normalizeSecret(input);
  } catch (error) {
    return friendlyError(error);
  }
  throw Error("Expected invalid setup key.");
}
it.each([
  ["JBSWY3DPEHPK3PX!", "letters A–Z and digits 2–7"],
  ["JBSWY3DPEHPK3PXP=", "padding or length"],
  ["JBSWY3DPEHPK3PXPAZ", "trailing characters"],
])(
  "explains malformed manual keys without password or file guidance",
  (input, guidance) => {
    const shown = failure(input);
    expect(shown.message).toContain(guidance);
    expect(shown.message).not.toMatch(/password|selected file/i);
    expect(shown.message + shown.technical).not.toContain(input);
  },
);
it("does not expose arbitrary errors as primary setup-key guidance", () => {
  const shown = friendlyError(new Error("SYNTHETIC_PRIVATE_MARKER"));
  expect(shown.message).not.toContain("SYNTHETIC_PRIVATE_MARKER");
});
