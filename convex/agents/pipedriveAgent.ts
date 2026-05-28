import { actionGeneric as action, anyApi } from "convex/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

type ActivityType = "call" | "tasting" | "event" | "bartender_training";

type ParsedActivity = {
  brandName: string | null;
  accountManagerName: string | null;
  type: ActivityType | null;
  count: number | null;
  weekStartDate: string | null;
};

type ParsedDeal = {
  brandName: string | null;
  stage: string | null;
  valueEuros: number | null;
  probability: number | null;
  date: string | null;
  probabilityDefaulted?: boolean;
};

type ParsedResponse = {
  activities?: ParsedActivity[];
  deals?: ParsedDeal[];
  unmappedFields?: string[];
};

const SYSTEM_PROMPT = `You are a data extraction agent specialising in Pipedrive CRM export files.

Pipedrive typically exports activity and pipeline (deal) data as CSV. A single export
may contain activities only, deals only, or both. Column headers vary by pipeline
configuration and language but commonly include variants like:

Activities:
- Subject / Type / Activity Type (call, meeting, task, lunch, demo, tasting, event,
  training, bartender training, etc.)
- Organization / Org / Company / Account / Account Name
- Owner / Assigned To / User / Account Manager
- Due Date / Date / Activity Date / Done Date
- Done / Marked as Done / Completed
- Notes / Description

Deals:
- Title / Deal Title / Deal Name
- Organization / Org / Account
- Stage / Pipeline Stage / Deal Stage
- Value / Deal Value / Amount / Weighted Value (in EUR or local currency)
- Probability / Win Probability / Likelihood (as a percentage 0–100)
- Add Time / Won Time / Close Date / Expected Close Date / Date

Your task: extract every activity and every deal from the CSV and return a single
JSON object (not an array) of the form:
{
  "activities": [
    {
      "brandName": "string",          // organization / account / company name from the row
      "accountManagerName": "string", // owner / assigned-to / user name
      "type": "call" | "tasting" | "event" | "bartender_training" | null,
      "count": 1,                     // emit 1 per row unless the row aggregates multiple
      "weekStartDate": "YYYY-MM-DD"   // Monday of the week the activity falls in
    }
  ],
  "deals": [
    {
      "brandName": "string",
      "stage": "string",
      "valueEuros": 0.0,
      "probability": null,            // 0-100, or null if missing
      "date": "YYYY-MM-DD",
      "probabilityDefaulted": false   // true when probability is missing/blank in the source
    }
  ],
  "unmappedFields": ["col1", "col2"]
}

Activity type mapping rules:
- "call", "phone", "telephone", "outbound call", "inbound call" → "call"
- "tasting", "sampling", "product tasting" → "tasting"
- "event", "trade show", "launch", "fair", "expo" → "event"
- "bartender training", "training", "staff training", "education" → "bartender_training"
- Anything else (meeting, lunch, email, task, demo, etc.) → null
  (the agent will log and skip these — do not invent a type)

Other rules:
- Infer column mappings from the CSV headers — do NOT hardcode column names.
- Convert deal value to a number in euros (strip currency symbols, thousands separators,
  normalise decimal separator). If the source is in cents, convert to euros.
- If probability is missing or blank, set it to null and set probabilityDefaulted = true.
- For weekStartDate, compute the Monday (ISO week start) of the week containing the
  activity date and format as YYYY-MM-DD.
- If a required field cannot be confidently extracted for a row, set it to null.
- "unmappedFields" should include any header you saw but could not confidently map.
- Skip header rows, totals/subtotals, and obviously empty rows.
- If the export only contains activities, return deals: []. If only deals, return activities: [].
- Return ONLY valid JSON — a single JSON object, no markdown fences, no explanation, no preamble.`;

function normaliseName(s: string): string {
  return s.trim().toLowerCase();
}

function findBrandId(
  brands: Array<{ _id: string; name: string }>,
  name: string | null
): string | null {
  if (!name) return null;
  const n = normaliseName(name);
  // Exact match first
  const exact = brands.find((b) => normaliseName(b.name) === n);
  if (exact) return exact._id;
  // Partial match: brand name contained in supplied name or vice versa
  const partial = brands.find((b) => {
    const bn = normaliseName(b.name);
    return bn.includes(n) || n.includes(bn);
  });
  return partial?._id ?? null;
}

function findUserId(
  users: Array<{ _id: string; name?: string }>,
  name: string | null
): string | null {
  if (!name) return null;
  const n = normaliseName(name);
  const exact = users.find(
    (u) => typeof u.name === "string" && normaliseName(u.name) === n
  );
  if (exact) return exact._id;
  const partial = users.find((u) => {
    if (typeof u.name !== "string") return false;
    const un = normaliseName(u.name);
    return un.includes(n) || n.includes(un);
  });
  return partial?._id ?? null;
}

export const runPipedriveAgent = action({
  args: {
    uploadId: v.id("uploads"),
    storageId: v.id("_storage"),
    brandId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Read file from Convex storage
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("File not found in storage");
    const fileContent = await blob.text();

    // 2. Call Claude with prompt caching on the system prompt
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Parse this Pipedrive CSV export and return the JSON object:\n\n${fileContent}`,
        },
      ],
    });

    const firstBlock = response.content[0];
    const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    // 3. Parse response — Claude may wrap JSON in markdown despite the prompt.
    let parsed: ParsedResponse = {};
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as ParsedResponse;
      }
    } catch {
      throw new Error(
        `Failed to parse agent response: ${text.substring(0, 200)}`
      );
    }

    const activitiesIn = Array.isArray(parsed.activities)
      ? parsed.activities
      : [];
    const dealsIn = Array.isArray(parsed.deals) ? parsed.deals : [];
    const unmappedFields = new Set<string>(
      Array.isArray(parsed.unmappedFields) ? parsed.unmappedFields : []
    );

    // 4. Load brands and users for resolution
    const brands = (await ctx.runQuery(internal.brands.listInternal, {})) as Array<{
      _id: string;
      name: string;
    }>;
    const users = (await ctx.runQuery(anyApi.users.list, {})) as Array<{
      _id: string;
      name?: string;
    }>;

    // 5. Activities
    let activityRowsProcessed = 0;
    let activityRowsSkipped = 0;
    const skippedUnknownType: string[] = [];
    const skippedUnknownBrand: string[] = [];
    const skippedUnknownAccountManager: string[] = [];

    for (const row of activitiesIn) {
      if (
        row.type !== "call" &&
        row.type !== "tasting" &&
        row.type !== "event" &&
        row.type !== "bartender_training"
      ) {
        skippedUnknownType.push(row.brandName ?? "(no brand)");
        activityRowsSkipped++;
        continue;
      }

      const brandId = findBrandId(brands, row.brandName);
      if (!brandId) {
        skippedUnknownBrand.push(row.brandName ?? "(no brand)");
        activityRowsSkipped++;
        continue;
      }

      const accountManagerId = findUserId(users, row.accountManagerName);
      if (!accountManagerId) {
        skippedUnknownAccountManager.push(
          row.accountManagerName ?? "(no owner)"
        );
        activityRowsSkipped++;
        continue;
      }

      if (!row.weekStartDate) {
        activityRowsSkipped++;
        continue;
      }
      const weekStart = new Date(row.weekStartDate).getTime();
      if (Number.isNaN(weekStart)) {
        activityRowsSkipped++;
        continue;
      }

      const count =
        typeof row.count === "number" && row.count > 0 ? row.count : 1;

      await ctx.runMutation(internal.activities.insert, {
        brandId,
        accountManagerId,
        type: row.type,
        count,
        weekStart,
      });

      activityRowsProcessed++;
    }

    // 6. Deals
    let dealRowsProcessed = 0;
    let dealRowsSkipped = 0;
    let dealsWithDefaultedProbability = 0;
    const dealsMissingBrand: string[] = [];

    for (const row of dealsIn) {
      const brandId = findBrandId(brands, row.brandName);
      if (!brandId) {
        dealsMissingBrand.push(row.brandName ?? "(no brand)");
        dealRowsSkipped++;
        continue;
      }

      if (!row.stage || row.valueEuros == null || !row.date) {
        dealRowsSkipped++;
        continue;
      }

      const parsedDate = new Date(row.date).getTime();
      if (Number.isNaN(parsedDate)) {
        dealRowsSkipped++;
        continue;
      }

      const probabilityDefaulted =
        row.probability == null || row.probabilityDefaulted === true;
      if (probabilityDefaulted) dealsWithDefaultedProbability++;

      const dealArgs: {
        brandId: string;
        stage: string;
        valueCents: number;
        date: number;
        probability?: number;
      } = {
        brandId,
        stage: row.stage,
        valueCents: Math.round(row.valueEuros * 100),
        date: parsedDate,
      };
      if (typeof row.probability === "number") {
        dealArgs.probability = row.probability;
      }

      await ctx.runMutation(internal.deals.insert, dealArgs);

      dealRowsProcessed++;
    }

    return {
      activityRowsProcessed,
      activityRowsSkipped,
      dealRowsProcessed,
      dealRowsSkipped,
      dealsWithDefaultedProbability,
      skippedUnknownType,
      skippedUnknownBrand,
      skippedUnknownAccountManager,
      dealsMissingBrand,
      unmappedFields: Array.from(unmappedFields),
    };
  },
});
