import { sql } from "drizzle-orm";
import { customTimestamp } from "./custom";

export const timestampColumns = {
	createdAt: customTimestamp("created_at", { precision: 3 }).default(sql`now()`).notNull(),
	updatedAt: customTimestamp("updated_at", { precision: 3 }),
};

// You'll also need to decide on a standard for nullable/mode-specific timestamps
export const expiresAtTimestamp = customTimestamp("expires_at", {
	precision: 3,
});
