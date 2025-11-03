import { type ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { appLogger, createOperationContext } from "@/core/logger/app-logger";

const errorHandler: ErrorHandler = (err, c) => {
	appLogger.error("Hono error handler", createOperationContext({ domain: 'api' }), err, { path: c.req.path });
	if (err instanceof HTTPException) {
		return err.getResponse();
	}

	return new Response("Internal Error", {
		status: 500,
		statusText: err?.message || "Internal Error",
	});
};

export default errorHandler;
