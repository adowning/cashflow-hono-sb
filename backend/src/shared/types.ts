import type { PinoLogger } from "hono-pino";

import { z } from "zod";

import type { User, UserBalance } from "@/core/database/schema";
import { SupabaseClient, type User as AuthUser } from "@supabase/supabase-js";
import type { AppType } from "../app";
import type { UserWithBalance } from "@/core/database/db";
import type { RedisClient } from "bun";
// import { CourseTagSchema } from "../prisma/generated/types";

export interface AppBindings {
	// Variables: {
	user: UserWithBalance;
	authUser: AuthUser;
	sessionCache: RedisClient;
	gameSessionCache: RedisClient;
	supabase: SupabaseClient;
	// };
}

export { type AppType };

/**
 * Zod schema for validating the response of the GET user route.
 * Validates essential user fields: id (UUID), name, email (email format), createdAt, updatedAt.
 * Includes optional fields for completeness.
 */
export const ZGetUserSchema = z.object({
	id: z.string(),
});
export const ZGetAllUsersSchema = z.object({
	query: z.string().optional(),
	page: z.coerce.number().min(1).optional().default(1),
	perPage: z.coerce.number().min(1).optional().default(4),
});
export type TGetUserType = z.infer<typeof ZGetUserSchema>;
export type TGetAllUsersType = z.infer<typeof ZGetAllUsersSchema>;

// Pagination interfaces and types
export interface PaginationMeta {
	page: number;
	perPage: number;
	total: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: PaginationMeta;
}

export interface PaginationParams {
	page?: number;
	perPage?: number;
}

// export const ZGetUserSchema = z.object({
//   id: z.string().uuid().openapi({
//     description: 'Unique identifier of the user (UUID)',
//     example: '550e8400-e29b-41d4-a716-446655440000',
//   }),
//   name: z.string().openapi({
//     description: 'Name of the user',
//     example: 'John Doe',
//   }),
//   email: z.string().email().openapi({
//     description: 'Email address of the user',
//     example: 'john.doe@example.com',
//   }),
//   emailVerified: z.boolean().optional().openapi({
//     description: 'Whether the email is verified',
//     example: true,
//   }),
//   image: z.string().optional().openapi({
//     description: 'Profile image URL',
//     example: 'https://example.com/avatar.jpg',
//   }),
//   createdAt: z.string().openapi({
//     description: 'Creation timestamp',
//     example: '2023-10-01T12:00:00Z',
//   }),
//   updatedAt: z.string().openapi({
//     description: 'Last update timestamp',
//     example: '2023-10-01T12:00:00Z',
//   }),
//   role: z.string().optional().openapi({
//     description: 'Role of the user',
//     example: 'USER',
//   }),
//   banned: z.boolean().optional().openapi({
//     description: 'Whether the user is banned',
//     example: false,
//   }),
//   banReason: z.string().optional().openapi({
//     description: 'Reason for ban',
//     example: 'Violation of terms',
//   }),
//   banExpires: z.string().optional().openapi({
//     description: 'Ban expiration timestamp',
//     example: '2023-12-01T12:00:00Z',
//   }),
// }).openapi('GetUserResponse');
