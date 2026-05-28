import { cronJobs } from "convex/server";
import { anyApi } from "convex/server";

const crons = cronJobs();

// ─── Weekly: every Monday at 08:00 UTC — snapshot all brands ────────────────
crons.weekly(
  "weekly snapshot",
  { dayOfWeek: "monday", hourUTC: 8, minuteUTC: 0 },
  anyApi.reports.generateWeeklySnapshots,
  {}
);

// ─── Monthly: last day of each month — send monthly notification emails ──────
// Fires on days 28-31 so the isLastDayOfMonth() guard inside triggerMonthly can
// match the true last day of every month (including Feb 28/29, months with 30 or 31 days).
crons.cron(
  "monthly notification",
  "0 9 28-31 * *",
  anyApi.notifications.triggerMonthly,
  {}
);

// ─── Quarterly: last day of quarter-end months (Mar/Jun/Sep/Dec) ─────────────
// Same pattern: fire days 28-31 of each quarter-end month; the guard filters to
// the true last day at runtime.
crons.cron(
  "quarterly notification Q1",
  "0 9 28-31 3 *",
  anyApi.notifications.triggerQuarterly,
  {}
);

crons.cron(
  "quarterly notification Q2",
  "0 9 28-31 6 *",
  anyApi.notifications.triggerQuarterly,
  {}
);

crons.cron(
  "quarterly notification Q3",
  "0 9 28-31 9 *",
  anyApi.notifications.triggerQuarterly,
  {}
);

crons.cron(
  "quarterly notification Q4",
  "0 9 28-31 12 *",
  anyApi.notifications.triggerQuarterly,
  {}
);

// ─── Annual: 1 January at 00:01 UTC — snapshot all brands for prior year ─────
// crontab: minute hour day-of-month month day-of-week
crons.cron(
  "annual snapshot",
  "1 0 1 1 *",
  anyApi.reports.generateAnnualSnapshots,
  {}
);

export default crons;
