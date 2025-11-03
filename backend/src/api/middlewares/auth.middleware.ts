import { getUserWithBalance } from "@/core/database/db";
import { supabase } from "@/core/supabase/client";
import { type MiddlewareHandler } from "hono";

const authMiddleware: MiddlewareHandler = async (c, next) =>
{
  const accessToken = c.req.raw.headers.get("Authorization")?.replace("Bearer ", "");

  if (!accessToken) {
    return await next();
  }

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return await next();
  }

  const sessionCache = c.get("sessionCache");
  let user = await sessionCache?.get(data.user.id);

  if (!user) {
    user = await getUserWithBalance(data.user.id);
    sessionCache?.set(data.user.id, user);
  }

  if (user) {
    c.set("user", user);
  }

  await next();
};

export default authMiddleware;
