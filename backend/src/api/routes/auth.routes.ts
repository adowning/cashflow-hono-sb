import { zValidator } from "../middlewares/zodValidator.middleware";
import { supabase } from "../../core/supabase/client";

import authMiddleware from "../middlewares/auth.middleware";
import { type AppBindings } from "../../shared/types";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { endTime, startTime } from "hono/timing";
import { z } from "zod";

const CREATING_BOTS = false;

const authRoutes = new Hono<{ Variables: AppBindings }>()
	.post(
		"/sign-up",
		zValidator(
			"json",
			z.object({
				username: z.string(),
				password: z.string().min(8),
			}),
		),
		async (c) => {
			const logger = c.get("logger");

			const { username, password } = c.req.valid("json");
			const { data, error } = await supabase.auth.signUp({
				email: `${username}-${new Date().getTime()}@cashflowcasino.com`,
				password,
				options: {
					data: {
						username,
						bot: CREATING_BOTS,
					},
				},
			});

			if (error || !data?.user?.email) {
				logger.info(error as any);
				throw new Error(error?.message || "Error while signing up", {
					cause: error,
				});
			}

			// const user = await db.insert(userTable).values(dbUser).returning();
			if (error || !data || !data.session) {
				logger.error("Error while signing in", error as any);
				throw new HTTPException(401, {
					message: (error as any)?.message || "Authentication failed",
				});
			}

			setCookie(c, "access_token", data?.session.access_token, {
				...(data?.session.expires_at && {
					expires: new Date(data.session.expires_at),
				}),
				httpOnly: true,
				path: "/",
				secure: true,
			});

			setCookie(c, "refresh_token", data?.session.refresh_token, {
				...(data?.session.expires_at && {
					expires: new Date(data.session.expires_at),
				}),
				httpOnly: true,
				path: "/",
				secure: true,
			});

			return c.json(data.user);
		},
	)
	.post(
		"/sign-in",
		zValidator(
			"json",
			z.object({
				email: z.string(),
				password: z.string().min(8),
			}),
		),
		async (c) => {
			const logger = c.get("logger");
			const { email, password } = c.req.valid("json");

			const response = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (response.error || !response.data || !response.data.session) {
				logger.error("Error while signing in", response.error as any);
				throw new HTTPException(401, {
					message: response.error?.message || "Authentication failed",
				});
			}

			setCookie(c, "access_token", response.data?.session.access_token, {
				...(response.data?.session.expires_at && {
					expires: new Date(response.data.session.expires_at),
				}),
				httpOnly: true,
				path: "/",
				secure: true,
			});

			setCookie(c, "refresh_token", response.data?.session.refresh_token, {
				...(response.data?.session.expires_at && {
					expires: new Date(response.data.session.expires_at),
				}),
				httpOnly: true,
				path: "/",
				secure: true,
			});

			return c.json(response.data.user);
		},
	)
	.post(
		"/sign-in-with-provider",
		zValidator(
			"json",
			z.object({
				provider: z.enum(["google", "apple"]),
				token: z.string().min(8),
				accessToken: z.string().optional(),
			}),
		),
		async (c) => {
			const logger = c.get("logger");
			const { token, provider, accessToken } = c.req.valid("json");
			// start a new timer
			startTime(c, "supabase.auth.signInWithProvider");
			const { data, error } = await supabase.auth.signInWithIdToken({
				provider,
				token,
				access_token: accessToken,
			});
			// end the timer
			endTime(c, "supabase.auth.signInWithProvider");

			if (error as any) {
				logger.error("Error while signing in with Provider ", error as any);
				throw new HTTPException(401, { message: error?.message });
			}

			setCookie(c, "access_token", data?.session?.access_token as string, {
				...(data?.session?.expires_at && {
					expires: new Date(data.session.expires_at),
				}),
				httpOnly: true,
				path: "/",
				secure: true,
			});

			setCookie(c, "refresh_token", data?.session?.refresh_token as string, {
				...(data?.session?.expires_at && {
					expires: new Date(data.session.expires_at),
				}),
				httpOnly: true,
				path: "/",
				secure: true,
			});

			return c.json(data.user);
		},
	)
	.get("/refresh", async (c) => {
		const logger = c.get("logger");
		const refresh_token = getCookie(c, "refresh_token");
		if (!refresh_token) {
			throw new HTTPException(403, { message: "No refresh token" });
		}

		const { data, error } = await supabase.auth.refreshSession({
			refresh_token,
		});

		if (error as any) {
			logger.error("Error while refreshing token", error as any);
			throw new HTTPException(403, {
				message: error?.message || "Token refresh failed",
			});
		}

		if (data?.session) {
			setCookie(c, "refresh_token", data.session.refresh_token, {
				...(data.session.expires_at && {
					expires: new Date(data.session.expires_at),
				}),
				// httpOnly: true,
				// path: "/",
				// secure: true,
			});
		}

		return c.json(data.user);
	})
	.get("/get-user", authMiddleware, async (c) => {
		const logger = c.get("logger");
		const user = c.get("user");
		// const sessionCache = c.get('sessionCache')
		if (!user) {
			throw new HTTPException(403, { message: "No user" });
		}

		const refresh_token = getCookie(c, "refresh_token");
		if (!refresh_token) {
			throw new HTTPException(403, { message: "No refresh token" });
		}

		const { data, error } = await supabase.auth.refreshSession({
			refresh_token,
		});

		if (error as any) {
			logger.error("Error while refreshing token", error as any);
			throw new HTTPException(403, {
				message: error?.message || "Token refresh failed",
			});
		}

		if (data?.session) {
			setCookie(c, "refresh_token", data.session.refresh_token, {
				...(data.session.expires_at && {
					expires: new Date(data.session.expires_at),
				}),
				// httpOnly: true,
				// path: "/",
				// secure: true,
			});
		}

		return c.json(data.user);
	});

export default authRoutes;
