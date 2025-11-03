import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

const client = new SQL(
	// process.env.DATABASE_URL || "postgresql://postgres.crqbazcsrncvbnapuxcp:crqbazcsrncvbnapuxcp@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
	process.env.DATABASE_URL || "postgresql://user:asdfasdf@localhost:5439/sugarlips",
);

export const db = drizzle({ client, schema });

// Export table references for direct usage in db.query.tableName.* patterns
export const {
	userTable,
	userBalanceTable,
	gameTable,
	gameSessionTable,
	transactionLogTable,
	// ... other tables as needed
} = schema;

export const getUserWithBalance = async (userId: string) => {
	return await db.query.userTable.findFirst({
		where: (userTable, { eq }) => eq(userTable.id, userId),
		with: {
			userBalances: true,
		},
	});
};

// Inferring the type of the result
export type UserWithBalance = NonNullable<Awaited<ReturnType<typeof getUserWithBalance>>>;
