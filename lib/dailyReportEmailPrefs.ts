import { z } from "zod";
import type { CloudSettings } from "./cloudPortfolio";

const reportEmailSchema = z.string().trim().email();

export type DailyReportEmailPrefs = {
  dailyReportEmail: string;
  dailyReportEmailEnabled: boolean;
};

export const DEFAULT_DAILY_REPORT_EMAIL_PREFS: DailyReportEmailPrefs = {
  dailyReportEmail: "",
  dailyReportEmailEnabled: false
};

export function isValidReportEmail(value: string) {
  return reportEmailSchema.safeParse(value).success;
}

export function normalizeReportEmail(value: string) {
  return value.trim().toLowerCase();
}

export function dailyReportEmailPrefsFromSettings(settings: Partial<CloudSettings> | undefined): DailyReportEmailPrefs {
  const email = typeof settings?.dailyReportEmail === "string"
    ? normalizeReportEmail(settings.dailyReportEmail)
    : "";
  const enabled = Boolean(settings?.dailyReportEmailEnabled);
  return {
    dailyReportEmail: email,
    dailyReportEmailEnabled: enabled && Boolean(email) && isValidReportEmail(email)
  };
}

export function shouldSendDailyReportEmail(prefs: DailyReportEmailPrefs) {
  return prefs.dailyReportEmailEnabled && isValidReportEmail(prefs.dailyReportEmail);
}
