import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { env } from "./config/env";
import cache, { initializeDataCache } from "./middlewares/cache.middleware";
import errorHandler from "./middlewares/error.middleware";
import swaggerApp from "./middlewares/swagger.middleware";
import authRoutes from "./routes/auth.routes";
import gameRoutes from "./routes/game.routes";
import meRoutes from "./routes/me.routes";
import userRoutes from "./routes/user.routes";

// type AuthContext = {
//   authUser?: AuthUser;
//   appUser?: User;
// };
initializeDataCache();

// const app = new Hono<{ Variables: AppBindings }>()
const app = new Hono()
  .basePath("/api")
  // Middlewares
  .use("*", cache)
  // .use("*", supabase())
  .use("*", logger())
  .use("*", cors())
  .use("*", csrf())
  .use("*", prettyJSON())
  .use("*", secureHeaders())
  .use("*", timing())
  .use("*", sentry({ dsn: env.SENTRY_DSN, tracesSampleRate: 0.2 }))
  .use("*")
  // Routes
  .route("/ui", swaggerApp)
  .route("/auth", authRoutes)
  .route("/me", meRoutes)
  .route("/users", userRoutes)
  .route("/games", gameRoutes)
  .onError(errorHandler);

// Export the app TYPE
export type AppType = typeof app;

export default app;
