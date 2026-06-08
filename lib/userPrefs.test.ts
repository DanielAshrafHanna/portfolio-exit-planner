import { describe, expect, it } from "vitest";
import { parseStoredUserPrefs, resolveUserPrefsForSync, serializeUserPrefs } from "./userPrefs";

describe("userPrefs", () => {
  it("parses stored prefs", () => {
    const prefs = parseStoredUserPrefs(serializeUserPrefs({ displayName: "Chantel", shareHoldings: true }));
    expect(prefs).toEqual({ displayName: "Chantel", shareHoldings: true });
  });

  it("returns null for corrupted prefs", () => {
    expect(parseStoredUserPrefs("{bad")).toBeNull();
  });

  it("keeps local prefs when local storage is newer than cloud", () => {
    const resolved = resolveUserPrefsForSync({
      local: { displayName: "Chantel", shareHoldings: true },
      cloudDisplayName: "Friend",
      cloudShareHoldings: false,
      localIsNewer: true
    });
    expect(resolved.shareHoldings).toBe(true);
  });

  it("uses cloud prefs when local is not newer", () => {
    const resolved = resolveUserPrefsForSync({
      local: { displayName: "Friend", shareHoldings: false },
      cloudDisplayName: "Chantel",
      cloudShareHoldings: true,
      localIsNewer: false
    });
    expect(resolved).toEqual({ displayName: "Chantel", shareHoldings: true });
  });
});
