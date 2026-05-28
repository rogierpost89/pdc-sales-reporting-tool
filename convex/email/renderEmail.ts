import { render } from "@react-email/render";
import { createElement } from "react";
import { MonthlyNotification } from "../../src/components/email/MonthlyNotification";
import { QuarterlyNotification } from "../../src/components/email/QuarterlyNotification";

interface MonthlyEmailProps {
  brandName: string;
  brandLogoUrl?: string | null;
  monthLabel: string;
  totalRevenueCents: number;
  totalVolume: number;
  highlights: Array<{ url: string | null; caption: string }>;
  reportUrl: string;
  unsubscribeUrl: string;
}

interface QuarterlyEmailProps {
  brandName: string;
  brandLogoUrl?: string | null;
  quarterLabel: string;
  totalRevenueCents: number;
  totalVolume: number;
  highlights: Array<{ url: string | null; caption: string }>;
  reportUrl: string;
  unsubscribeUrl: string;
}

export async function renderMonthlyEmail(
  props: MonthlyEmailProps
): Promise<string> {
  return render(createElement(MonthlyNotification, props));
}

export async function renderQuarterlyEmail(
  props: QuarterlyEmailProps
): Promise<string> {
  return render(createElement(QuarterlyNotification, props));
}
