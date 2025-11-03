import authMiddleware from "@/middlewares/auth.middleware";
import type { AppBindings } from "@/shared/types";
import { Hono } from "hono";

const meRoutes = new Hono<{ Variables: AppBindings }>()
  .get("/test", async (c) =>
  {
    const user = {
      id: "1",
      email: "test@gmail.com",
    };

    return c.json(user);
  })
  .use("*", authMiddleware)
  .get("/", async (c) =>
  {
    console.log('herer')
    const user = c.get("user");
    return c.json(user);
  });

export default meRoutes;
