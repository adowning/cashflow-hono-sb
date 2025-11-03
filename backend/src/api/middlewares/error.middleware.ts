import { type ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

const errorHandler: ErrorHandler = (err, c) => {
	const logger = c.get("logger");
	logger.error(`Error on ${c.req.method} ${c.req.url}`);
	logger.error(err?.message);
	logger.error(err?.stack);
	if (err instanceof HTTPException) {
		return err.getResponse();
	}

	return new Response("Internal Error", {
		status: 500,
		statusText: err?.message || "Internal Error",
	});
};

export default errorHandler;
