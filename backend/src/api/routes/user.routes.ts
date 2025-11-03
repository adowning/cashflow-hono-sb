import { db } from "../../core/database/db";
import { userTable } from "../../core/database/schema/user";
import authMiddleware from "../middlewares/auth.middleware";
import type { AppBindings, PaginatedResponse, PaginationMeta, PaginationParams } from "../../shared/types";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createPaginatedQuery, getPaginationParams } from "../utils/pagination";
import { appLogger, createOperationContext } from "@/core/logger/app-logger";

const userRoutes = new Hono<{ Variables: AppBindings }>()
	.use("*", authMiddleware)
	.get("/", async (c) => {
		const currentUser = c.get("user");
		const context = createOperationContext({ domain: 'api', operation: 'getUsers', userId: currentUser?.id });

		try {
			if (!currentUser) {
				return c.json({ error: "User not authenticated" }, 401);
			}

			// Ensure currentUser has operatorId
			if (!currentUser.operatorId) {
				return c.json({ error: "User operatorId not found" }, 400);
			}

			// Parse and validate pagination parameters
			const { error, params: paginationParams } = getPaginationParams(c);
			if (error) {
				return error;
			}

			const whereConditions = eq(userTable.operatorId, currentUser.operatorId);

			const dataFetcher = (limit: number, offset: number) => {
				return db
					.select({
						id: userTable.id,
						username: userTable.username,
						avatarUrl: userTable.avatarUrl,
						role: userTable.role,
						banned: userTable.banned,
						authEmail: userTable.authEmail,
						phone: userTable.phone,
						operatorId: userTable.operatorId,
						createdAt: userTable.createdAt,
						updatedAt: userTable.updatedAt,
					})
					.from(userTable)
					.where(whereConditions)
					.limit(limit)
					.offset(offset);
			};

			const paginatedResult = await createPaginatedQuery(userTable, dataFetcher, paginationParams, whereConditions);

			const response: PaginatedResponse<(typeof paginatedResult.data)[0]> = {
				data: paginatedResult.data,
				pagination: paginatedResult.pagination,
			};

			return c.json(response);
		} catch (error) {
			appLogger.error("Error fetching users:", context, error as Error);
			return c.json({ error: "Failed to fetch users" }, 500);
		}
	})
	// *** FIX: Moved this route before /:id ***
	.get("/balances", async (c) => {
		const currentUser = c.get("user");
		const context = createOperationContext({ domain: 'api', operation: 'getUserBalances', userId: currentUser?.id });

		try {
			if (!currentUser) {
				return c.json({ error: "User not authenticated" }, 401);
			}

			// Ensure currentUser has operatorId
			if (!currentUser.operatorId) {
				return c.json({ error: "User operatorId not found" }, 400);
			}

			// Parse and validate pagination parameters
			const { error, params: paginationParams } = getPaginationParams(c);
			if (error) {
				return error;
			}

			const whereConditions = eq(userTable.operatorId, currentUser.operatorId);

			const dataFetcher = (limit: number, offset: number) => {
				return db.query.userTable.findMany({
					where: whereConditions,
					with: {
						userBalances: true,
					},
					limit: limit,
					offset: offset,
				});
			};

			const paginatedResult = await createPaginatedQuery(userTable, dataFetcher, paginationParams, whereConditions);

			const paginatedResponse: PaginatedResponse<(typeof paginatedResult.data)[0]> = {
				data: paginatedResult.data,
				pagination: paginatedResult.pagination,
			};

			return c.json(paginatedResponse);
		} catch (error) {
			appLogger.error("Error fetching users with balances:", context, error as Error);
			return c.json({ error: "Failed to fetch users with balances" }, 500);
		}
	})
	// *** This dynamic route now comes AFTER /balances ***
	.get("/:id", async (c) => {
		const currentUser = c.get("user");
		const userId = c.req.param("id");
		const context = createOperationContext({ domain: 'api', operation: 'getUserById', userId: currentUser?.id, requestedId: userId });

		try {
			if (!currentUser) {
				return c.json({ error: "User not authenticated" }, 401);
			}

			// Ensure currentUser has operatorId
			if (!currentUser.operatorId) {
				return c.json({ error: "User operatorId not found" }, 400);
			}

			// Get the requested user and verify they belong to the same operator
			const users = await db
				.select({
					id: userTable.id,
					username: userTable.username,
					avatarUrl: userTable.avatarUrl,
					role: userTable.role,
					banned: userTable.banned,
					authEmail: userTable.authEmail,
					phone: userTable.phone,
					operatorId: userTable.operatorId,
					createdAt: userTable.createdAt,
					updatedAt: userTable.updatedAt,
				})
				.from(userTable)
				.where(and(eq(userTable.id, userId), eq(userTable.operatorId, currentUser.operatorId)));

			if (users.length === 0) {
				return c.json({ error: "User not found" }, 404);
			}

			return c.json({ data: users[0] });
		} catch (error) {
			appLogger.error("Error fetching user:", context, error as Error);
			return c.json({ error: "Failed to fetch user" }, 500);
		}
	});

export default userRoutes;
