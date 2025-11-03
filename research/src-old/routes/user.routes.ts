import { db } from "@/libs/database/db";
import { userTable } from "@/libs/database/schema/user";
import authMiddleware from "@/middlewares/auth.middleware";
import type {
    AppBindings,
    PaginatedResponse,
    PaginationMeta,
    PaginationParams,
} from "@/shared/types";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";

// Pagination helper functions
const parsePaginationParams = (params: URLSearchParams): PaginationParams =>
{
    const pageNum = parseInt(params.get("page") || "1");
    const perPageNum = parseInt(params.get("perPage") || "10");

    const page = Number.isNaN(pageNum) ? 1 : Math.max(1, pageNum);
    const perPage = Number.isNaN(perPageNum)
        ? 10
        : Math.min(100, Math.max(1, perPageNum));

    return { page, perPage };
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

const userRoutes = new Hono<{ Variables: AppBindings }>()
    .use("*", authMiddleware)
    .get("/", async (c) =>
    {
        try {
            const currentUser = c.get("user");

            if (!currentUser) {
                return c.json({ error: "User not authenticated" }, 401);
            }

            // Ensure currentUser has operatorId
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

            const { page, perPage } = paginationParams;
            const offset = (paginationParams.page! - 1) * paginationParams.perPage!;

            // Get total count for pagination metadata
            const [totalResult] = await db
                .select({ count: count() })
                .from(userTable)
                .where(eq(userTable.operatorId, currentUser.operatorId));

            const totalCount = totalResult?.count || 0;

            // Get paginated users with the same operatorId as the requesting user
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
                .where(eq(userTable.operatorId, currentUser.operatorId))
                .limit(paginationParams.perPage!)
                .offset(offset);

            const paginationMeta = createPaginationMeta(
                paginationParams.page!,
                paginationParams.perPage!,
                totalCount,
            );

            const response: PaginatedResponse<typeof users[0]> = {
                data: users,
                pagination: paginationMeta,
            };

            return c.json(response);
        } catch (error) {
            console.error("Error fetching users:", error);
            return c.json({ error: "Failed to fetch users" }, 500);
        }
    })
    // *** FIX: Moved this route before /:id ***
    .get("/balances", async (c) =>
    {
        try {
            const currentUser = c.get("user");

            if (!currentUser) {
                return c.json({ error: "User not authenticated" }, 401);
            }

            // Ensure currentUser has operatorId
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

            const { page, perPage } = paginationParams;
            const offset = (paginationParams.page! - 1) * paginationParams.perPage!;

            // Get total count for pagination metadata
            const [totalResult] = await db
                .select({ count: count() })
                .from(userTable)
                .where(eq(userTable.operatorId, currentUser.operatorId));

            const totalCount = totalResult?.count || 0;
            console.log(currentUser.operatorId);
            // const response = await getUsersWithBalance(currentUser.operatorId, perPage || 20, offset || 0)
            const response = await db.query.userTable.findMany({
                where: eq(userTable.operatorId, currentUser.operatorId),
                with: {
                    userBalances: true,
                    // },
                },
                limit: perPage,
                offset: offset,
            });
            console.log(response);

            const paginationMeta = createPaginationMeta(
                paginationParams.page!,
                paginationParams.perPage!,
                totalCount,
            );

            const paginatedResponse: PaginatedResponse<typeof response[0]> = {
                data: response,
                pagination: paginationMeta,
            };

            return c.json(paginatedResponse);
        } catch (error) {
            console.error("Error fetching users with balances:", error);
            return c.json({ error: "Failed to fetch users with balances" }, 500);
        }
    })
    // *** This dynamic route now comes AFTER /balances ***
    .get("/:id", async (c) =>
    {
        try {
            const currentUser = c.get("user");
            const userId = c.req.param("id");

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
                .where(
                    and(
                        eq(userTable.id, userId),
                        eq(userTable.operatorId, currentUser.operatorId),
                    ),
                );

            if (users.length === 0) {
                return c.json({ error: "User not found" }, 404);
            }

            return c.json({ data: users[0] });
        } catch (error) {
            console.error("Error fetching user:", error);
            return c.json({ error: "Failed to fetch user" }, 500);
        }
    });

export default userRoutes;