import type { PaginationMeta, PaginationParams } from "../../shared/types";
import { count, type SQL } from "drizzle-orm";
import { db } from "@/core/database/db";

// Pagination helper functions
export const parsePaginationParams = (
	params: URLSearchParams,
): PaginationParams & { category?: string; query?: string } => {
	const pageNum = parseInt(params.get("page") || "1");
	const perPageNum = parseInt(params.get("perPage") || "10");
	const category = params.get("category") || undefined;
	const query = params.get("query") || undefined;

	const page = Number.isNaN(pageNum) ? 1 : Math.max(1, pageNum);
	const perPage = Number.isNaN(perPageNum) ? 10 : Math.min(100, Math.max(1, perPageNum));

	return { page, perPage, category, query };
};

export const validatePaginationParams = (params: PaginationParams): { isValid: boolean; error?: string } => {
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

export const createPaginationMeta = (page: number, perPage: number, total: number): PaginationMeta => {
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

export const createPaginatedQuery = async <T>(
	countTable: any,
	dataFetcher: (limit: number, offset: number) => Promise<T[]>,
	paginationParams: PaginationParams,
	whereConditions?: SQL<unknown> | undefined,
) => {
	const { page = 1, perPage = 10 } = paginationParams;
	const offset = (page - 1) * perPage;

	// Get total count for pagination metadata
	const [totalResult] = await db.select({ count: count() }).from(countTable).where(whereConditions);

	const totalCount = totalResult?.count || 0;

	// Get paginated data
	const data = await dataFetcher(perPage, offset);

	const paginationMeta = createPaginationMeta(page, perPage, totalCount);

	return {
		data,
		pagination: paginationMeta,
	};
};
