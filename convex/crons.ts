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
// Convex's .monthly() fires on the given day-of-month.
// Day 28 is the latest day guaranteed to exist in every month (February edge case).
// triggerMonthly checks isLastDayOfMonth() at runtime and returns early if today
// is not the true last day, so emails only fire on the actual last day of each month.
crons.monthly(
  "monthly notification",
  { day: 28, hourUTC: 9, minuteUTC: 0 },
  anyApi.notifications.triggerMonthly,
  {}
);

// ─── Quarterly: last month of each quarter (Mar/Jun/Sep/Dec), day 28 ─────────
// Registered as four separate monthly crons restricted to months 3, 6, 9, 12
// using crontab syntax: minute hour day-of-month month day-of-week
// triggerQuarterly checks isLastDayOfMonth() at runtime and returns early if today
// is not the true last day, ensuring emails fire only on the actual quarter-end day.
crons.cron(
  "quarterly notification Q1",
  "0 9 28 3 *",
  anyApi.notifications.triggerQuarterly,
  {}
);

crons.cron(
  "quarterly notification Q2",
  "0 9 28 6 *",
  anyApi.notifications.triggerQuarterly,
  {}
);

crons.cron(
  "quarterly notification Q3",
  "0 9 28 9 *",
  anyApi.notifications.triggerQuarterly,
  {}
);

crons.cron(
  "quarterly notification Q4",
  "0 9 28 12 *",
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
