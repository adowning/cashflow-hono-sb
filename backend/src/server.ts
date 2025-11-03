import { startManufacturedGameplay } from "./modules/bot/bot.service";
import { showRoutes } from "hono/dev";
import app from "./app";
import { db, gameSessionTable } from "./core/database/db";
import { eq } from "drizzle-orm";
import { wsRouter } from "./app.ws";

const port = 3000;

export const CORS_HEADERS = {
	headers: {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "OPTIONS, POST",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	},
};

const server = Bun.serve({
	port,
	websocket: wsRouter.websocket,
	async fetch(req, server) {
		const url = new URL(req.url);
		// Handle CORS preflight requests
		if (req.method === "OPTIONS") {
			const res = new Response("Departed", CORS_HEADERS);
			return res;
		}
		if (url.pathname == "/ws") {
			// WS Upgrade
			// server.upgrade(req, upgrade());
			// fallback
		}
		return app.fetch(req, server);
	},
});
showRoutes(app);
console.log(`Server is running on port - ${server.port}`);
console.log(`Running on http://localhost:${server.port}`);

process.on("SIGINT", () => {
	console.log("\nReceived SIGINT\nrunning cleanup...");
	// TODO: ctx cleanup?
	server.stop(true);
	console.log("all done.");
	process.exit();
});

// Initialize the application
// Use Drizzle ORM to update all game sessions to completed
(async () => {
	try {
		await db
			.update(gameSessionTable)
			.set({
				status: "COMPLETED",
				isActive: false,
				updatedAt: new Date(),
			})
			.where(eq(gameSessionTable.isActive, true));

		console.log("Successfully updated all active game sessions to COMPLETED status");
		startManufacturedGameplay();
	} catch (error) {
		console.error("Failed to update game sessions:", error);
		startManufacturedGameplay(); // Continue with startup even if this fails
	}
})();
