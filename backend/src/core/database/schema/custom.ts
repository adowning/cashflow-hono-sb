import { customType } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * Custom Drizzle type for handling timestamps.
 *
 * - In the database, it's stored as 'timestamp with time zone'.
 * - In your application code (Drizzle queries), it's a native JavaScript `Date` object.
 *
 * This avoids the need for `mode: "string"` and manual parsing.
 *
 * @see https://orm.drizzle.team/docs/custom-types
 */
export const customTimestamp = customType<{
	data: Date; // The type in your application code
	driverData: string; // The type in the database driver
	config: { precision: number | undefined };
	zodType: z.ZodDate; // Updated from 'zod' to 'zodType' for drizzle-zod
}>({
	/**
	 * Returns the SQL data type for the column.
	 * We can optionally use config.precision here.
	 */
	dataType(config) {
		const precision = 3;
		return precision ? `timestamp(${precision}) with time zone` : "timestamp with time zone";
	},

	/**
	 * `toDriver`: Called when writing to the database.
	 * Converts a `Date` object from your code into an ISO string for Postgres.
	 */
	toDriver(value: Date): string {
		if (typeof value !== "string") return value.toISOString();
		return value;
	},

	/**
	 * `fromDriver`: Called when reading from the database.
	 * Converts the string from the database driver into a new `Date` object.
	 */
	fromDriver(value: string): Date {
		return new Date(value);
	},

	// The `zod` function is no longer supported in this API.
	// We removed it and added `zodType` to the generic above.
});
