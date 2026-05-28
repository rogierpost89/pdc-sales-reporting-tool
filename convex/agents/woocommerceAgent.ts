import { actionGeneric as action } from "convex/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

type Channel = "d2c" | "b2b_wholesale";

type ParsedRow = {
  date: string | null;
  orderId: string | null;
  sku: string | null;
  productName: string | null;
  quantity: number | null;
  revenueEuros: number | null;
  channel: Channel;
  channelDefaulted: boolean;
  unmappedColumns?: string[];
};

const SYSTEM_PROMPT = `You are a data extraction agent specialising in WooCommerce order export files.

WooCommerce typically exports order line items as CSV. Column headers vary by store
configuration and plugins, but commonly include variants like:
- Order ID / order_id / ID / Order Number
- Date / order_date / Date Created / Order Date
- Product / Item / Product Name / Line Item
- SKU / product_sku / Item SKU
- Quantity / qty / Quantity Ordered / Line Item Quantity
- Line Total / revenue / item_total / Line Item Total / Order Total
- Customer Role / User Role / customer_type / order_type (signals wholesale vs retail)
- Order Tags / Categories / Product Categories

Your task: extract every order line item from the CSV and return a JSON array. Each item should have:
{
  "date": "YYYY-MM-DD",
  "orderId": "string",
  "sku": "string",
  "productName": "string",
  "quantity": number,
  "revenueEuros": number,
  "channel": "d2c" | "b2b_wholesale",
  "channelDefaulted": boolean,
  "unmappedColumns": ["col1", "col2"]
}

Channel inference rules (in priority order):
1. If a customer role / user role column indicates "wholesale", "b2b", "trade", "distributor",
   or similar, set channel = "b2b_wholesale" and channelDefaulted = false.
2. If a customer role / user role column indicates "customer", "retail", "consumer", "subscriber",
   or similar, set channel = "d2c" and channelDefaulted = false.
3. If an order tag, category, or order_type column contains "wholesale" / "b2b" / "trade",
   set channel = "b2b_wholesale" and channelDefaulted = false.
4. If an order tag, category, or order_type column contains "retail" / "d2c" / "consumer",
   set channel = "d2c" and channelDefaulted = false.
5. If no reliable channel signal exists, default to channel = "d2c" and channelDefaulted = true.

Other rules:
- Infer column mappings from the CSV headers — do NOT hardcode column names.
- Convert revenue to a number (strip currency symbols, thousands separators, normalise decimal separator).
- Convert quantity to a number.
- If a required field cannot be mapped from the headers, set it to null on every row and list the
  source column name(s) you could not map in the unmappedColumns array.
- "unmappedColumns" should include any header you saw in the CSV but could not confidently map
  to one of the target fields (date, orderId, sku, productName, quantity, revenueEuros, channel).
- Skip header rows, totals/subtotals, refunds, and obviously empty rows.
- Each order may have multiple line items — emit one JSON object per line item, repeating the
  orderId and date as needed.
- Return ONLY valid JSON — a single JSON array, no markdown fences, no explanation, no preamble.`;

export const runWoocommerceAgent = action({
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
          content: `Parse this WooCommerce order export CSV and return the JSON array:\n\n${fileContent}`,
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

    // 4. Use the brandId passed in from the upload UI.
    const brandId = args.brandId;

    // 5. Write records and tally summary
    let rowsProcessed = 0;
    let rowsSkipped = 0;
    let d2cCount = 0;
    let b2bCount = 0;
    const defaultedToD2c: string[] = [];
    const unmappedCols = new Set<string>();

    for (const row of parsed) {
      if (Array.isArray(row.unmappedColumns)) {
        for (const c of row.unmappedColumns) unmappedCols.add(c);
      }

      if (
        !row.date ||
        !row.sku ||
        row.quantity == null ||
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

      // Normalise channel — default to d2c if missing or unrecognised.
      let channel: Channel;
      let channelDefaulted = row.channelDefaulted === true;
      if (row.channel === "b2b_wholesale") {
        channel = "b2b_wholesale";
      } else if (row.channel === "d2c") {
        channel = "d2c";
      } else {
        channel = "d2c";
        channelDefaulted = true;
      }

      if (channel === "b2b_wholesale") {
        b2bCount++;
      } else {
        d2cCount++;
      }

      if (channelDefaulted) {
        defaultedToD2c.push(row.orderId ?? `${row.sku}@${row.date}`);
      }

      await ctx.runMutation(internal.salesData.insert, {
        source: "woocommerce",
        channel,
        brandId,
        sku: row.sku,
        volume: row.quantity,
        revenueCents: Math.round(row.revenueEuros * 100),
        date: parsedDate,
        uploadId: args.uploadId,
      });

      rowsProcessed++;
    }

    return {
      rowsProcessed,
      rowsSkipped,
      d2cCount,
      b2bCount,
      defaultedToD2cCount: defaultedToD2c.length,
      defaultedToD2c,
      unmappedColumns: Array.from(unmappedCols),
    };
  },
});
