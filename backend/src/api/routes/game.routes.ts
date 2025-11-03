import { db } from "../../core/database/db";
import { gameTable } from "../../core/database/schema/game";
import authMiddleware from "../middlewares/auth.middleware";
import type { AppBindings, PaginatedResponse, PaginationMeta, PaginationParams } from "../../shared/types";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createPaginatedQuery, getPaginationParams } from "../utils/pagination";

const gameRoutes = new Hono<{ Variables: AppBindings }>()
	.use("*", authMiddleware)
	.get("/", async (c) => {
		const logger = c.get("logger");

		try {
			const currentUser = c.get("user");

			if (!currentUser) {
				return c.json({ error: "User not authenticated" }, 401);
			}

			// Ensure currentGame has operatorId
			if (!currentUser.operatorId) {
				return c.json({ error: "User operatorId not found" }, 400);
			}

			// Parse and validate pagination parameters
			const { error, params: paginationParams } = getPaginationParams(c);
			if (error) {
				return error;
			}

			const { category } = paginationParams;

			// Build where conditions
			const where = [];
			if (category) {
				where.push(eq(gameTable.category, category as any));
			}
			const whereConditions = where.length > 0 ? and(...where) : undefined;

			const dataFetcher = (limit: number, offset: number) => {
				return db
					.select({
						id: gameTable.id,
						name: gameTable.name,
						isActive: gameTable.isActive,
						title: gameTable.title,
						developer: gameTable.developer,
						isFeatured: gameTable.isFeatured,
						category: gameTable.category,
						volatility: gameTable.volatility,
						currentRtp: gameTable.currentRtp,
						thumbnailUrl: gameTable.thumbnailUrl,
						totalBetAmount: gameTable.totalBetAmount,
						totalWonAmount: gameTable.totalWonAmount,
						targetRtp: gameTable.targetRtp,
						createdAt: gameTable.createdAt,
						updatedAt: gameTable.updatedAt,
					})
					.from(gameTable)
					.where(whereConditions)
					.limit(limit)
					.offset(offset);
			};

			const paginatedResult = await createPaginatedQuery(gameTable, dataFetcher, paginationParams, whereConditions);

			logger.info(`Filtered games by category: ${category}, found: ${paginatedResult.data.length} games`);

			const response: PaginatedResponse<(typeof paginatedResult.data)[0]> = {
				data: paginatedResult.data,
				pagination: paginatedResult.pagination,
			};

			return c.json(response);
		} catch (error) {
			logger.error("Error fetching games:", error as any);
			return c.json({ error: "Failed to fetch games" }, 500);
		}
	})
	// *** FIX: Moved this route before /:id ***

	// *** This dynamic route now comes AFTER /balances ***
	.get("/:id", async (c) => {
		const logger = c.get("logger");

		try {
			const currentUser = c.get("user");
			const gameId = c.req.param("id");

			if (!currentUser) {
				return c.json({ error: "Game not authenticated" }, 401);
			}

			// Ensure currentGame has operatorId
			if (!currentUser.operatorId) {
				return c.json({ error: "Game operatorId not found" }, 400);
			}

			// Get the requested game and verify they belong to the same operator
			const games = await db
				.select({
					id: gameTable.id,
					name: gameTable.name,
					title: gameTable.title,
					developer: gameTable.developer,
					category: gameTable.category,
					thumbnailUrl: gameTable.thumbnailUrl,
					operatorId: gameTable.operatorId,
					createdAt: gameTable.createdAt,
					updatedAt: gameTable.updatedAt,
				})
				.from(gameTable)
				.where(and(eq(gameTable.id, gameId)));

			if (games.length === 0) {
				return c.json({ error: "Game not found" }, 404);
			}

			return c.json({ data: games[0] });
		} catch (error) {
			logger.error("Error fetching game:", error as any);
			return c.json({ error: "Failed to fetch game" }, 500);
		}
	});

export default gameRoutes;
