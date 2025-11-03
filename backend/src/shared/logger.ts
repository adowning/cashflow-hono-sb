/**
 * Shared Logger Service
 * Provides a singleton logger instance for all shared services
 */

import pino from "pino";

// Create the shared logger instance
export const logger = pino({
	level: process.env.NODE_ENV === "production" ? "info" : "debug",
	transport:
		process.env.NODE_ENV === "production"
			? undefined
			: {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:standard",
						ignore: "pid,hostname",
					},
				},
});

export default logger;
