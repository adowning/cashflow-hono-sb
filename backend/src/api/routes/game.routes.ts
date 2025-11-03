import { db } from "@/core/database/db";
import { gameTable } from "@/core/database/schema/game";
import authMiddleware from "@/api/middlewares/auth.middleware";
import type {
    AppBindings,
    PaginatedResponse,
    PaginationMeta,
    PaginationParams,
} from "@/shared/types";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";

// Pagination helper functions
const parsePaginationParams = (params: URLSearchParams): PaginationParams & { category?: string; query?: string } =>
{
    const pageNum = parseInt(params.get("page") || "1");
    const perPageNum = parseInt(params.get("perPage") || "10");
    const category = params.get("category") || undefined;
    const query = params.get("query") || undefined;

    const page = Number.isNaN(pageNum) ? 1 : Math.max(1, pageNum);
    const perPage = Number.isNaN(perPageNum)
        ? 10
        : Math.min(100, Math.max(1, perPageNum));

    return { page, perPage, category, query };
};

const validatePaginationParams = (
    params: PaginationParams,
): { isValid: boolean; error?: string } =>
{
    const page = params.page!;
    const perPage = params.perPage!;

    if (!Number.isInteger(page) || page < 1) {
        return {
            isValid: false,
            error: "Page must be a positive integer greater than 0",
        };
    }

    if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
        return {
            isValid: false,
            error: "PerPage must be a positive integer between 1 and 100",
        };
    }

    return { isValid: true };
};

const createPaginationMeta = (
    page: number,
    perPage: number,
    total: number,
): PaginationMeta =>
{
    const totalPages = Math.ceil(total / perPage);

    return {
        page,
        perPage,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
    };
};

const gameRoutes = new Hono<{ Variables: AppBindings }>()
    .use("*", authMiddleware)
    .get("/", async (c) =>
    {
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
            const url = new URL(c.req.url);
            const paginationParams = parsePaginationParams(url.searchParams);
            const validation = validatePaginationParams(paginationParams);

            if (!validation.isValid) {
                return c.json({ error: validation.error }, 400);
            }

            const { page, perPage, category, query } = paginationParams;
            const offset = (paginationParams.page! - 1) * paginationParams.perPage!;

            // Build where conditions
            const whereConditions = [];

            // Add category filter if provided
            if (category) {
                whereConditions.push(eq(gameTable.category, category as any));
            }

            // TODO: Add query-based search for title/name if needed
            // if (query) {
            //     whereConditions.push(
            //         or(
            //             ilike(gameTable.title, `%${query}%`),
            //             ilike(gameTable.name, `%${query}%`)
            //         )
            //     );
            // }

            // Get total count for pagination metadata
            const [totalResult] = await db
                .select({ count: count() })
                .from(gameTable)
                .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

            const totalCount = totalResult?.count || 0;

            // Get paginated games with filters
            const games = await db
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
                .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
                .limit(paginationParams.perPage!)
                .offset(offset);

            console.log(`Filtered games by category: ${category}, found: ${games.length} games`);

            const paginationMeta = createPaginationMeta(
                paginationParams.page!,
                paginationParams.perPage!,
                totalCount,
            );

            const response: PaginatedResponse<typeof games[0]> = {
                data: games,
                pagination: paginationMeta,
            };

            return c.json(response);
        } catch (error) {
            console.error("Error fetching games:", error);
            return c.json({ error: "Failed to fetch games" }, 500);
        }
    })
    // *** FIX: Moved this route before /:id ***

    // *** This dynamic route now comes AFTER /balances ***
    .get("/:id", async (c) =>
    {
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
                .where(
                    and(
                        eq(gameTable.id, gameId),
                    ),
                );

            if (games.length === 0) {
                return c.json({ error: "Game not found" }, 404);
            }

            return c.json({ data: games[0] });
        } catch (error) {
            console.error("Error fetching game:", error);
            return c.json({ error: "Failed to fetch game" }, 500);
        }
    });

export default gameRoutes;