import { describe, expect, it } from "vitest";
import { parseStoredUserPrefs, resolveUserPrefsForSync, serializeUserPrefs } from "./userPrefs";

describe("userPrefs", () => {
  it("parses stored prefs", () => {
    const prefs = parseStoredUserPrefs(serializeUserPrefs({ displayName: "Chantal", shareHoldings: true }));
    expect(prefs).toEqual({ displayName: "Chantal", shareHoldings: true });
  });

  it("returns null for corrupted prefs", () => {
    expect(parseStoredUserPrefs("{bad")).toBeNull();
  });

  it("keeps local display name when local storage is newer than cloud", () => {
    const resolved = resolveUserPrefsForSync({
      local: { displayName: "Chantal", shareHoldings: true },
      cloudDisplayName: "Friend",
      cloudShareHoldings: false,
      localIsNewer: true,
      shareHoldingsTouched: true
    });
    expect(resolved.displayName).toBe("Chantal");
    expect(resolved.shareHoldings).toBe(true);
  });

  it("uses cloud prefs when local is not newer", () => {
    const resolved = resolveUserPrefsForSync({
      local: { displayName: "Friend", shareHoldings: false },
      cloudDisplayName: "Chantal",
      cloudShareHoldings: true,
      localIsNewer: false
    });
    expect(resolved).toEqual({ displayName: "Chantal", shareHoldings: true });
  });

  it("keeps cloud sharing when local portfolio is newer but sharing was not toggled locally", () => {
    const resolved = resolveUserPrefsForSync({
      local: { displayName: "Chantal", shareHoldings: false },
      cloudDisplayName: "Chantal",
      cloudShareHoldings: true,
      localIsNewer: true,
      shareHoldingsTouched: false
    });
    expect(resolved).toEqual({ displayName: "Chantal", shareHoldings: true });
  });

  it("honors a local sharing toggle when local portfolio is newer", () => {
    const resolved = resolveUserPrefsForSync({
      local: { displayName: "Chantal", shareHoldings: false },
      cloudDisplayName: "Chantal",
      cloudShareHoldings: true,
      localIsNewer: true,
      shareHoldingsTouched: true
    });
    expect(resolved).toEqual({ displayName: "Chantal", shareHoldings: false });
  });
});
