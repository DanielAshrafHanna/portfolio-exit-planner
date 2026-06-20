import { afterEach, describe, expect, it } from "vitest";
import {
  filterProfilesByReportId,
  isEmailAllowedForDailyAiReport,
  isSnapshotFreshAfterClose,
  parseDailyAiReportProfileFilter
} from "./dailyAiReportData";
import { defaultProfiles } from "./profileUtils";

describe("dailyAiReportData helpers", () => {
  afterEach(() => {
    delete process.env.DAILY_AI_REPORT_ALLOWED_EMAILS;
  });

  it("parses supported profile filters", () => {
    expect(parseDailyAiReportProfileFilter(null)).toBe("all");
    expect(parseDailyAiReportProfileFilter("us-portfolio")).toBe("us-portfolio");
    expect(parseDailyAiReportProfileFilter("eg-portfolio")).toBe("eg-portfolio");
    expect(parseDailyAiReportProfileFilter("invalid")).toBeNull();
  });

  it("filters profiles by id", () => {
    const profiles = defaultProfiles();
    expect(filterProfilesByReportId(profiles, "all")).toHaveLength(2);
    expect(filterProfilesByReportId(profiles, "us-portfolio")).toEqual([profiles[0]]);
    expect(filterProfilesByReportId(profiles, "eg-portfolio")).toEqual([profiles[1]]);
  });

  it("respects optional email allowlist", () => {
    expect(isEmailAllowedForDailyAiReport("owner@example.com")).toBe(true);
    process.env.DAILY_AI_REPORT_ALLOWED_EMAILS = "owner@example.com, other@example.com";
    expect(isEmailAllowedForDailyAiReport("owner@example.com")).toBe(true);
    expect(isEmailAllowedForDailyAiReport("blocked@example.com")).toBe(false);
  });

  it("marks snapshots fresh when updated_at is after US cash close", () => {
    const sessionDate = "2026-06-18";
    const updatedAt = "2026-06-18T21:05:00.000Z";
    expect(isSnapshotFreshAfterClose(updatedAt, "US", sessionDate)).toBe(true);
  });

  it("marks snapshots stale when updated_at is before US cash close", () => {
    const sessionDate = "2026-06-18";
    const updatedAt = "2026-06-18T19:30:00.000Z";
    expect(isSnapshotFreshAfterClose(updatedAt, "US", sessionDate)).toBe(false);
  });
});
