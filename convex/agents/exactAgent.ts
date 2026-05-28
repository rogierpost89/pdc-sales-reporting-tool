import { actionGeneric as action, anyApi } from "convex/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

type ParsedRow = {
  date: string | null;
  account: string | null;
  sku: string | null;
  volume: number | null;
  revenueEuros: number | null;
  unmappedColumns?: string[];
};

const SYSTEM_PROMPT = `You are a data extraction agent specialising in Exact Online ERP export files.

Exact Online typically exports wholesale invoice data as CSV. Column headers vary by
configuration and language (Dutch / English) but commonly include variants like:
- Date / Invoice Date / Datum / Factuurdatum
- Account / Customer / Klant / Debiteur / Relatie
- Item / SKU / Article / Artikel / Artikelcode
- Quantity / Cases / Bottles / Aantal
- Amount / Revenue / Net Amount / Bedrag / Netto bedrag (in EUR or local currency)
- Description / Omschrijving

Your task: extract every line item from the CSV and return a JSON array. Each item should have:
{
  "date": "YYYY-MM-DD",
  "account": "string",
  "sku": "string",
  "volume": number,
  "revenueEuros": number,
  "unmappedColumns": ["col1", "col2"]
}

Rules:
- Infer column mappings from the CSV headers — do NOT hardcode column names.
- Convert revenue to a number (strip currency symbols, thousands separators, normalise decimal separator).
- If a required field cannot be mapped from the headers, set it to null on every row and list the
  source column name(s) you could not map in the unmappedColumns array.
- "unmappedColumns" should include any header you saw in the CSV but could not confidently map to
  one of the target fields (date, account, sku, volume, revenueEuros).
- Skip header rows, totals/subtotals, and obviously empty rows.
- Return ONLY valid JSON — a single JSON array, no markdown fences, no explanation, no preamble.`;

export const runExactAgent = action({
  args: {
    uploadId: v.id("uploads"),
    storageId: v.id("_storage"),
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
          content: `Parse this Exact Online CSV export and return the JSON array:\n\n${fileContent}`,
        },
      ],
    });

    const firstBlock = response.content[0];
    const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    // 3. Parse response — Claude may wrap JSON in markdown despite the prompt.
    let parsed: ParsedRow[] = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as ParsedRow[];
      }
    } catch {
      throw new Error(
        `Failed to parse agent response: ${text.substring(0, 200)}`
      );
    }

    // 4. Resolve a brandId. Exact Online exports don't carry brand context; the
    //    admin selects the brand when uploading. For now we attach to the first
    //    brand as a placeholder — a future ticket will pass brandId via args.
    const brands = (await ctx.runQuery(anyApi.brands.list, {})) as Array<{
      _id: string;
    }>;
    const brandId = brands[0]?._id;
    if (!brandId) {
      throw new Error("No brands found — create a brand first");
    }

    // 5. Write records
    let rowsProcessed = 0;
    let rowsSkipped = 0;
    const unmappedCols = new Set<string>();

    for (const row of parsed) {
      if (Array.isArray(row.unmappedColumns)) {
        for (const c of row.unmappedColumns) unmappedCols.add(c);
      }

      if (
        !row.date ||
        !row.sku ||
        row.volume == null ||
        row.revenueEuros == null
      ) {
        rowsSkipped++;
        continue;
      }

      const parsedDate = new Date(row.date).getTime();
      if (Number.isNaN(parsedDate)) {
        rowsSkipped++;
        continue;
      }

      await ctx.runMutation(anyApi.salesData.insert, {
        source: "exact",
        channel: "wholesale",
        brandId,
        sku: row.sku,
        volume: row.volume,
        revenueCents: Math.round(row.revenueEuros * 100),
        date: parsedDate,
        uploadId: args.uploadId,
      });

      rowsProcessed++;
    }

    return {
      rowsProcessed,
      rowsSkipped,
      unmappedColumns: Array.from(unmappedCols),
    };
  },
});
