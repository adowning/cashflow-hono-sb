import authMiddleware from "../middlewares/auth.middleware";
import type { AppBindings } from "../../shared/types";
import { Hono } from "hono";
import { appLogger, createOperationContext } from "@/core/logger/app-logger";

const meRoutes = new Hono<{ Variables: AppBindings }>()
	.get("/test", async (c) => {
		const user = {
			id: "1",
			email: "test@gmail.com",
		};

		return c.json(user);
	})
	.use("*", authMiddleware)
	.get("/", async (c) => {
		const user = c.get("user");
		appLogger.info("GET /me", createOperationContext({ domain: 'api', userId: user?.id, operation: '/me' }));
		return c.json(user);
	});

export default meRoutes;
