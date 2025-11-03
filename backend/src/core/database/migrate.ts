import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";

const client = new SQL(
	"postgresql://postgres.crqbazcsrncvbnapuxcp:crqbazcsrncvbnapuxcp@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
);
const db = drizzle({ client, schema });

export const migrateDB = async () =>
{
	console.log("migrating db");
	await migrate(db, { migrationsFolder: "drizzle" });
	console.log("db migrated");
};
