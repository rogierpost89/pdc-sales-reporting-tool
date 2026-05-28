import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";

export const getMyActivities = query({
  args: {
    userId: v.string(),    // Clerk userId
    weekStart: v.number(), // Unix ms for Monday 00:00 UTC
  },
  handler: async (ctx, args) => {
    // Filter by accountManagerId = userId AND weekStart = args.weekStart
    const records = await ctx.db
      .query("activities")
      .filter((q) =>
        q.and(
          q.eq(q.field("accountManagerId"), args.userId),
          q.eq(q.field("weekStart"), args.weekStart)
        )
      )
      .collect();

    // Get all brand names
    const brands = await ctx.db.query("brands").collect();
    const brandMap = Object.fromEntries(brands.map((b) => [b._id, b.name]));

    // Group by brand
    const grouped: Record<
      string,
      {
        brandName: string;
        call: number;
        tasting: number;
        event: number;
        bartender_training: number;
      }
    > = {};

    for (const r of records) {
      const key = r.brandId as string;
      if (!grouped[key]) {
        grouped[key] = {
          brandName: brandMap[key] ?? key,
          call: 0,
          tasting: 0,
          event: 0,
          bartender_training: 0,
        };
      }
      const entry = grouped[key];
      const activityType = r.type as keyof Omit<typeof entry, "brandName">;
      entry[activityType] += r.count;
    }

    return Object.values(grouped);
  },
});
