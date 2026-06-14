import { describe, expect, it } from "vitest";
import {
  chartDateLabel,
  getDailyPlSessionInfo,
  getLastTradingDate,
  isTradingWeekday
} from "./marketSession";

describe("isTradingWeekday", () => {
  it("treats US Saturday and Sunday as non-trading days", () => {
    expect(isTradingWeekday("US", "2026-06-13")).toBe(false);
    expect(isTradingWeekday("US", "2026-06-14")).toBe(false);
    expect(isTradingWeekday("US", "2026-06-12")).toBe(true);
  });

  it("treats EGX Friday and Saturday as non-trading days", () => {
    expect(isTradingWeekday("EG", "2026-06-12")).toBe(false);
    expect(isTradingWeekday("EG", "2026-06-13")).toBe(false);
    expect(isTradingWeekday("EG", "2026-06-11")).toBe(true);
  });
});

describe("getLastTradingDate", () => {
  it("returns Friday when checked on a US Sunday", () => {
    expect(getLastTradingDate("US", new Date("2026-06-14T15:00:00.000Z"))).toBe("2026-06-12");
  });

  it("returns Thursday when checked on an EGX Friday", () => {
    expect(getLastTradingDate("EG", new Date("2026-06-12T10:00:00.000Z"))).toBe("2026-06-11");
  });
});

describe("getDailyPlSessionInfo", () => {
  it("labels a US Sunday as the last Friday session", () => {
    const info = getDailyPlSessionInfo("US", new Date("2026-06-14T15:00:00.000Z"));
    expect(info.isMarketClosed).toBe(true);
    expect(info.sessionDate).toBe("2026-06-12");
    expect(info.moversTitle).toContain("Fri");
    expect(info.subtitle).toContain("weekend");
  });

  it("labels an open US session as today", () => {
    const info = getDailyPlSessionInfo("US", new Date("2026-06-09T18:00:00.000Z"));
    expect(info.isMarketClosed).toBe(false);
    expect(info.columnLabel).toContain("Today");
  });
});

describe("chartDateLabel", () => {
  it("marks weekend snapshot dates as closed", () => {
    expect(chartDateLabel("2026-06-13", "US", new Date("2026-06-14T15:00:00.000Z"))).toContain("closed");
    expect(chartDateLabel("2026-06-12", "US", new Date("2026-06-14T15:00:00.000Z"))).not.toContain("closed");
  });
});
