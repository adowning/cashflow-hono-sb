import type { Config } from "drizzle-kit";

export default {
  schema: "./src/libs/database/schema/",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // url: env.DATABASE_URL,
    // url: "postgresql://postgres.crqbazcsrncvbnapuxcp:crqbazcsrncvbnapuxcp@aws-1-us-east-1.pooler.supabase.com:5432/postgres",
    url: "postgresql://user:asdfasdf@localhost:5439/sugarlips",
  },
} satisfies Config;
