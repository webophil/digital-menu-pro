import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const insert = internalMutation({
  args: {
    fullName: v.string(),
    establishment: v.optional(v.string()),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("contactMessages", { ...args, createdAt: Date.now() });
  },
});

export const countRecent = internalQuery({
  args: { email: v.string(), since: v.number() },
  handler: async (ctx, { email, since }) => {
    const all = await ctx.db
      .query("contactMessages")
      .withIndex("by_created_at", (q) => q.gt("createdAt", since))
      .collect();
    return all.filter((m) => m.email === email).length;
  },
});
