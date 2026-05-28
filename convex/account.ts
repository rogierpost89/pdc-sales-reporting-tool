import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";

export const getMyActivities = query({
  args: {
    weekStart: v.number(),
  },
  handler: async (ctx, args) => {
    // Derive identity from auth — never trust client-supplied userId
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Resolve Convex users row from Clerk subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const records = await ctx.db
      .query("activities")
      .filter((q) =>
        q.and(
          q.eq(q.field("accountManagerId"), user._id as unknown as string),
          q.eq(q.field("weekStart"), args.weekStart)
        )
      )
      .collect();

    const brands = await ctx.db.query("brands").collect();
    const brandMap = Object.fromEntries(brands.map((b) => [b._id, b.name]));

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
        grouped[key] = { brandName: brandMap[key] ?? key, call: 0, tasting: 0, event: 0, bartender_training: 0 };
      }
      const entry = grouped[key];
      const activityType = r.type as keyof Omit<typeof entry, "brandName">;
      entry[activityType] += r.count;
    }

    return Object.values(grouped);
  },
});
