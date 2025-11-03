import { db } from "@/core/database/db";
import { supabase } from "@/core/supabase/client";
import { type MiddlewareHandler } from "hono";

const authMiddleware: MiddlewareHandler = async (c, next) => {
	const accessToken = c.req.raw.headers.get("Authorization")?.replace("Bearer ", "");

	if (!accessToken) {
		return await next();
	}

	const { data, error } = await supabase.auth.getUser(accessToken);

	if (error || !data.user) {
		return await next();
	}

	const sessionCache = c.get("sessionCache");
	let user = await sessionCache?.get(data.user.id);

	if (!user) {
		// Use Drizzle ORM to get user with balance using joins
		const result = await db.query.userTable.findFirst({
			where: (userTable, { eq }) => eq(userTable.id, data.user.id),
			with: {
				userBalances: true,
			},
		});

		// Clean null values from the result
		if (result) {
			user = Object.fromEntries(Object.entries(result).filter(([_, value]) => value !== null));
		}

		sessionCache?.set(data.user.id, user);
	}

	if (user) {
		c.set("user", user);
	}

	await next();
};

export default authMiddleware;
