import { describe, expect, it } from "vitest";
import {
  dailyReportEmailPrefsFromSettings,
  isValidReportEmail,
  shouldSendDailyReportEmail
} from "./dailyReportEmailPrefs";

describe("dailyReportEmailPrefs", () => {
  it("parses enabled prefs only when email is valid", () => {
    expect(dailyReportEmailPrefsFromSettings({
      dailyReportEmail: "User@Example.com",
      dailyReportEmailEnabled: true
    })).toEqual({
      dailyReportEmail: "user@example.com",
      dailyReportEmailEnabled: true
    });
  });

  it("disables delivery for invalid email addresses", () => {
    expect(shouldSendDailyReportEmail({
      dailyReportEmail: "not-an-email",
      dailyReportEmailEnabled: true
    })).toBe(false);
    expect(isValidReportEmail("friend@example.com")).toBe(true);
  });
});
