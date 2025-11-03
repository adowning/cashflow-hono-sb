import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = Bun.env;

export const supabase = createClient(Bun.env.SUPABASE_URL as string, Bun.env.SUPABASE_SERVICE_ROLE as string);
