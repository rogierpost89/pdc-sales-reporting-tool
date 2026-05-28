import { queryGeneric as query } from "convex/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("brands").collect();
  },
});
