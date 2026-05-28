import { actionGeneric as action, anyApi } from "convex/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

type TargetTable = "sales_data" | "activities" | "deals";

type TableMapping = {
  table: TargetTable;
  confidence: number;
  columnMap: Record<string, string | null>;
  unmappedColumns: string[];
};

type MappingResponse = {
  tableMappings: TableMapping[];
  overallConfidence: number;
  explanation: string;
};

type ActivityType = "call" | "tasting" | "event" | "bartender_training";

type SalesDataRow = {
  date: string | null;
  sku: string | null;
  volume: number | null;
  revenueEuros: number | null;
  channel: string | null;
  brandName: string | null;
};

type ActivityRow = {
  brandName: string | null;
  accountManagerName: string | null;
  type: ActivityType | null;
  count: number | null;
  weekStartDate: string | null;
};

type DealRow = {
  brandName: string | null;
  stage: string | null;
  valueEuros: number | null;
  probability: number | null;
  date: string | null;
};

const CONFIDENCE_THRESHOLD = 0.6;

const SYSTEM_PROMPT = `You are a fallback data extraction agent for the PDC Sales Reporting Tool. You handle
ANY CSV or Excel export whose source is unknown or marked "manual". Your job is to look at
the columns and values in an arbitrary file and decide which Convex table(s) the data best
maps to.

The available Convex tables and their required fields are:

1. sales_data — wholesale or D2C sales line items.
   Required fields:
     - date          (YYYY-MM-DD)
     - sku           (string)
     - volume        (number — units / bottles / cases)
     - revenueCents  (integer — euro amount * 100; supply revenueEuros in your mapping)
     - channel       ("d2c" or "b2b_wholesale" — default "b2b_wholesale" if unclear)
     - brandId       (resolved from a brand name column if present)
   Typical headers: Date, Order Date, Invoice Date, SKU, Article, Product, Qty, Quantity,
   Cases, Bottles, Amount, Revenue, Net Amount, Line Total.

2. activities — account manager activity logs (calls, tastings, events, trainings).
   Required fields:
     - brandName          (string — used to resolve brandId)
     - accountManagerName (string — used to resolve user id)
     - type               ("call" | "tasting" | "event" | "bartender_training")
     - count              (integer; default 1)
     - weekStartDate      (YYYY-MM-DD — Monday of the activity's week)
   Typical headers: Subject, Activity Type, Organization, Owner, Date, Done Date.

3. deals — pipeline / CRM deals.
   Required fields:
     - brandName    (string — used to resolve brandId)
     - stage        (string — pipeline stage name)
     - valueEuros   (number — deal value in euros)
     - probability  (0–100, optional)
     - date         (YYYY-MM-DD)
   Typical headers: Title, Organization, Stage, Value, Probability, Close Date.

Your task is a TWO-STEP analysis. In THIS call you only do step 1 (mapping). You will be
asked for the actual rows in a follow-up call.

Step 1 — Mapping analysis:
- Look at the CSV headers and the first ~10 data rows.
- Decide which of the three tables this file best maps to. It may map to more than one
  table if the file is a combined export (rare). Return one entry in tableMappings per
  table you believe the file maps to.
- For each table you target, produce a columnMap: { requiredField: "Source Column Name" | null }.
  Use null when no source column maps to that required field.
- Give a confidence score 0.0–1.0 per table mapping. 1.0 = unambiguous match on every
  required field; 0.6 = enough fields matched to be useful; below 0.6 = too uncertain.
- List any source columns you could NOT map under unmappedColumns.
- Produce an overallConfidence (0.0–1.0) representing your confidence that this file can
  be ingested at all. If the file appears to be unrelated to sales/activities/deals,
  return overallConfidence below 0.6 and an explanation.

Return ONLY a single JSON object, no markdown fences, no preamble:
{
  "tableMappings": [
    {
      "table": "sales_data" | "activities" | "deals",
      "confidence": 0.0-1.0,
      "columnMap": { "<requiredField>": "<sourceHeader>" | null, ... },
      "unmappedColumns": ["..."]
    }
  ],
  "overallConfidence": 0.0-1.0,
  "explanation": "Brief reason for your decision."
}`;

function isTargetTable(value: unknown): value is TargetTable {
  return (
    value === "sales_data" || value === "activities" || value === "deals"
  );
}

function normaliseName(s: string): string {
  return s.trim().toLowerCase();
}

function findBrandId(
  brands: Array<{ _id: string; name: string }>,
  name: string | null
): string | null {
  if (!name) return null;
  const n = normaliseName(name);
  const exact = brands.find((b) => normaliseName(b.name) === n);
  if (exact) return exact._id;
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

function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function extractJsonArray(text: string): string | null {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : null;
}

export const runManualAgent = action({
  args: {
    uploadId: v.id("uploads"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // 1. Read file from Convex storage.
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new Error("File not found in storage");
    const fileContent = await blob.text();

    const client = new Anthropic();

    // 2. Step 1 — mapping analysis with prompt caching on the (long) system prompt.
    const mappingResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
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
          content: `Analyse this file and return the mapping JSON object:\n\n${fileContent}`,
        },
      ],
    });

    const mappingBlock = mappingResponse.content[0];
    const mappingText =
      mappingBlock && mappingBlock.type === "text" ? mappingBlock.text : "";

    let mapping: MappingResponse;
    try {
      const json = extractJsonObject(mappingText);
      if (!json) throw new Error("no JSON object in mapping response");
      mapping = JSON.parse(json) as MappingResponse;
    } catch {
      // If we can't even parse the mapping response, mark failed and return.
      const explanation = `Manual agent could not parse the mapping response: ${mappingText.substring(0, 200)}`;
      await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
        uploadId: args.uploadId,
        status: "failed",
        agentUsed: "manualAgent",
      });
      return {
        tablesWritten: [] as string[],
        rowsInsertedPerTable: {} as Record<string, number>,
        unmappedColumns: [] as string[],
        confidencePerTable: {} as Record<string, number>,
        overallConfidence: 0,
        explanation,
        skippedRows: [] as Array<{ rowIndex: number; reason: string }>,
      };
    }

    const tableMappings = Array.isArray(mapping.tableMappings)
      ? mapping.tableMappings.filter((m) => isTargetTable(m.table))
      : [];
    const overallConfidence =
      typeof mapping.overallConfidence === "number"
        ? mapping.overallConfidence
        : 0;
    const explanation =
      typeof mapping.explanation === "string" ? mapping.explanation : "";

    // 3. Confidence gate — below threshold: write nothing, mark failed, return summary.
    if (overallConfidence < CONFIDENCE_THRESHOLD || tableMappings.length === 0) {
      await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
        uploadId: args.uploadId,
        status: "failed",
        agentUsed: "manualAgent",
      });
      const aggUnmapped = new Set<string>();
      const confidencePerTable: Record<string, number> = {};
      for (const m of tableMappings) {
        for (const c of m.unmappedColumns ?? []) aggUnmapped.add(c);
        confidencePerTable[m.table] = m.confidence;
      }
      return {
        tablesWritten: [] as string[],
        rowsInsertedPerTable: {} as Record<string, number>,
        unmappedColumns: Array.from(aggUnmapped),
        confidencePerTable,
        overallConfidence,
        explanation:
          explanation ||
          `Overall confidence ${overallConfidence.toFixed(2)} below threshold ${CONFIDENCE_THRESHOLD}; no records written.`,
        skippedRows: [] as Array<{ rowIndex: number; reason: string }>,
      };
    }

    // 4. Load brands and users — needed for resolution and brand-fallback.
    const brands = (await ctx.runQuery(anyApi.brands.list, {})) as Array<{
      _id: string;
      name: string;
    }>;
    const users = (await ctx.runQuery(anyApi.users.list, {})) as Array<{
      _id: string;
      name?: string;
    }>;
    const fallbackBrandId = brands[0]?._id;

    const tablesWritten: string[] = [];
    const rowsInsertedPerTable: Record<string, number> = {};
    const confidencePerTable: Record<string, number> = {};
    const aggUnmapped = new Set<string>();
    const skippedRows: Array<{ rowIndex: number; reason: string }> = [];

    // 5. Step 2 per target table — extract rows under the agreed column map.
    for (const target of tableMappings) {
      confidencePerTable[target.table] = target.confidence;
      for (const c of target.unmappedColumns ?? []) aggUnmapped.add(c);

      if (target.confidence < CONFIDENCE_THRESHOLD) {
        skippedRows.push({
          rowIndex: -1,
          reason: `Per-table confidence ${target.confidence.toFixed(2)} for ${target.table} below threshold; skipped this table.`,
        });
        continue;
      }

      const rowExtractionResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `Using this column mapping for the "${target.table}" table:\n${JSON.stringify(target.columnMap)}\n\nExtract all data rows from this file as a JSON array. Each object must have exactly the keys from the mapping above. Convert numeric fields to numbers, dates to YYYY-MM-DD strings, and use null when a value is missing. Skip header/total/blank rows. Return ONLY the JSON array — no markdown fences, no preamble.\n\nFile contents:\n\n${fileContent}`,
          },
        ],
      });

      const rowBlock = rowExtractionResponse.content[0];
      const rowText =
        rowBlock && rowBlock.type === "text" ? rowBlock.text : "";

      let rows: Array<Record<string, unknown>> = [];
      try {
        const json = extractJsonArray(rowText);
        if (json) {
          rows = JSON.parse(json) as Array<Record<string, unknown>>;
        }
      } catch {
        skippedRows.push({
          rowIndex: -1,
          reason: `Could not parse row extraction response for table ${target.table}: ${rowText.substring(0, 120)}`,
        });
        continue;
      }

      let inserted = 0;

      if (target.table === "sales_data") {
        for (let i = 0; i < rows.length; i++) {
          const raw = rows[i] as unknown as SalesDataRow;
          const date = typeof raw.date === "string" ? raw.date : null;
          const sku = typeof raw.sku === "string" ? raw.sku : null;
          const volume = typeof raw.volume === "number" ? raw.volume : null;
          const revenueEuros =
            typeof raw.revenueEuros === "number" ? raw.revenueEuros : null;
          const channelRaw =
            typeof raw.channel === "string" ? raw.channel.toLowerCase() : null;
          const brandName =
            typeof raw.brandName === "string" ? raw.brandName : null;

          if (!date || !sku || volume == null || revenueEuros == null) {
            skippedRows.push({
              rowIndex: i,
              reason: "sales_data: missing required field (date/sku/volume/revenueEuros)",
            });
            continue;
          }
          const ts = new Date(date).getTime();
          if (Number.isNaN(ts)) {
            skippedRows.push({
              rowIndex: i,
              reason: `sales_data: unparseable date "${date}"`,
            });
            continue;
          }

          let channel: string = "b2b_wholesale";
          if (channelRaw === "d2c" || channelRaw === "retail") channel = "d2c";
          else if (
            channelRaw === "b2b_wholesale" ||
            channelRaw === "wholesale" ||
            channelRaw === "b2b"
          )
            channel = "b2b_wholesale";

          let brandId = findBrandId(brands, brandName);
          if (!brandId) brandId = fallbackBrandId ?? null;
          if (!brandId) {
            skippedRows.push({
              rowIndex: i,
              reason: "sales_data: no brand resolved and no fallback brand exists",
            });
            continue;
          }

          await ctx.runMutation(anyApi.salesData.insert, {
            source: "manual",
            channel,
            brandId,
            sku,
            volume,
            revenueCents: Math.round(revenueEuros * 100),
            date: ts,
            uploadId: args.uploadId,
          });
          inserted++;
        }
      } else if (target.table === "activities") {
        for (let i = 0; i < rows.length; i++) {
          const raw = rows[i] as unknown as ActivityRow;
          const brandName =
            typeof raw.brandName === "string" ? raw.brandName : null;
          const accountManagerName =
            typeof raw.accountManagerName === "string"
              ? raw.accountManagerName
              : null;
          const type = raw.type;
          const weekStartDate =
            typeof raw.weekStartDate === "string" ? raw.weekStartDate : null;
          const count =
            typeof raw.count === "number" && raw.count > 0 ? raw.count : 1;

          if (
            type !== "call" &&
            type !== "tasting" &&
            type !== "event" &&
            type !== "bartender_training"
          ) {
            skippedRows.push({
              rowIndex: i,
              reason: `activities: unrecognised type "${String(type)}"`,
            });
            continue;
          }
          const brandId = findBrandId(brands, brandName);
          if (!brandId) {
            skippedRows.push({
              rowIndex: i,
              reason: `activities: brand "${brandName ?? "(none)"}" not found`,
            });
            continue;
          }
          const accountManagerId = findUserId(users, accountManagerName);
          if (!accountManagerId) {
            skippedRows.push({
              rowIndex: i,
              reason: `activities: account manager "${accountManagerName ?? "(none)"}" not found`,
            });
            continue;
          }
          if (!weekStartDate) {
            skippedRows.push({
              rowIndex: i,
              reason: "activities: missing weekStartDate",
            });
            continue;
          }
          const weekStart = new Date(weekStartDate).getTime();
          if (Number.isNaN(weekStart)) {
            skippedRows.push({
              rowIndex: i,
              reason: `activities: unparseable weekStartDate "${weekStartDate}"`,
            });
            continue;
          }

          await ctx.runMutation(anyApi.activities.insert, {
            brandId,
            accountManagerId,
            type,
            count,
            weekStart,
          });
          inserted++;
        }
      } else if (target.table === "deals") {
        for (let i = 0; i < rows.length; i++) {
          const raw = rows[i] as unknown as DealRow;
          const brandName =
            typeof raw.brandName === "string" ? raw.brandName : null;
          const stage = typeof raw.stage === "string" ? raw.stage : null;
          const valueEuros =
            typeof raw.valueEuros === "number" ? raw.valueEuros : null;
          const date = typeof raw.date === "string" ? raw.date : null;
          const probability =
            typeof raw.probability === "number" ? raw.probability : null;

          const brandId = findBrandId(brands, brandName);
          if (!brandId) {
            skippedRows.push({
              rowIndex: i,
              reason: `deals: brand "${brandName ?? "(none)"}" not found`,
            });
            continue;
          }
          if (!stage || valueEuros == null || !date) {
            skippedRows.push({
              rowIndex: i,
              reason: "deals: missing required field (stage/valueEuros/date)",
            });
            continue;
          }
          const ts = new Date(date).getTime();
          if (Number.isNaN(ts)) {
            skippedRows.push({
              rowIndex: i,
              reason: `deals: unparseable date "${date}"`,
            });
            continue;
          }

          const dealArgs: {
            brandId: string;
            stage: string;
            valueCents: number;
            date: number;
            probability?: number;
          } = {
            brandId,
            stage,
            valueCents: Math.round(valueEuros * 100),
            date: ts,
          };
          if (probability != null) dealArgs.probability = probability;

          await ctx.runMutation(anyApi.deals.insert, dealArgs);
          inserted++;
        }
      }

      if (inserted > 0) {
        tablesWritten.push(target.table);
        rowsInsertedPerTable[target.table] = inserted;
      } else {
        rowsInsertedPerTable[target.table] = 0;
      }
    }

    // 6. Mark upload done. (Ingestion router also marks done on success, but we do it
    //    explicitly here so the agentUsed string is recorded even if the caller forgets.)
    await ctx.runMutation(anyApi.ingestion.updateUploadStatus, {
      uploadId: args.uploadId,
      status: "done",
      agentUsed: "manualAgent",
    });

    return {
      tablesWritten,
      rowsInsertedPerTable,
      unmappedColumns: Array.from(aggUnmapped),
      confidencePerTable,
      overallConfidence,
      explanation,
      skippedRows,
    };
  },
});
