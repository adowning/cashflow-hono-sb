/* eslint-disable @stylistic/indent */
import { z } from "zod";
import { WebSocketRouter, createMessageSchema, publish } from "bun-ws-router/zod";
import { getSessionFromToken } from "@/api/middlewares/auth-ws.middleware";

// Create factory
const { messageSchema, ErrorMessage } = createMessageSchema(z);

// User roles
enum Role {
	USER = "user",
	ADMIN = "admin",
	MODERATOR = "moderator",
}

// Message schemas
const AuthSuccessMessage = messageSchema("AUTH_SUCCESS", {
	userId: z.string(),
	username: z.string(),
	roles: z.array(z.enum(Object.values(Role) as [Role, ...Role[]])),
});

const AdminActionMessage = messageSchema("ADMIN_ACTION", {
	action: z.enum(["kick", "ban", "mute"]),
	targetUserId: z.string(),
	reason: z.string().optional(),
});

const KickedMessage = messageSchema("KICKED", { reason: z.string() });
const MutedMessage = messageSchema("MUTED", { reason: z.string() });

// User data interface
export interface UserData extends Record<string, unknown> {
	userId: string;
	username: string;
	roles: Role[];
	authenticated: boolean;
	token?: string;
}

// Create router
export const wsRouter = new WebSocketRouter<UserData>()
	.onOpen(async (ctx) => {
		console.log(`Client ${ctx.ws.data.clientId} connected`);

		const protocols = ctx.req.headers.get("sec-websocket-protocol");
		const token = protocols
			?.split(",")
			.map((p) => p.trim())
			.find((p) => p.startsWith("bearer."))
			?.slice(7); // Remove "bearer." prefix

		if (!token) {
			ctx.ws.close(1008, "Authentication token required");
			return;
		}

		const session = await getSessionFromToken(token);

		if (!session || !session.user) {
			ctx.ws.close(1008, "Invalid authentication token");
			return;
		}

		const { user } = session;
		// NOTE: assuming roles are in user metadata
		const roles = (user.app_metadata.roles as Role[]) || [Role.USER];

		// Store user data in connection
		ctx.ws.data.userId = user.id;
		ctx.ws.data.username = user.email || "";
		ctx.ws.data.roles = roles;
		ctx.ws.data.authenticated = true;
		ctx.ws.data.token = token;

		// Subscribe to user-specific channel
		ctx.ws.subscribe(`user:${user.id}`);

		// Subscribe to role channels
		for (const role of roles) {
			ctx.ws.subscribe(`role:${role}`);
		}

		// Send success
		ctx.send(AuthSuccessMessage, {
			userId: user.id,
			username: user.email || "",
			roles,
		});
	})

	.onMessage(AdminActionMessage, (ctx) => {
		// Check authentication
		if (!ctx.ws.data.authenticated) {
			ctx.send(ErrorMessage, {
				code: "AUTHENTICATION_FAILED",
				message: "Not authenticated",
				context: undefined,
			});
			return;
		}

		// Check authorization
		if (!ctx.ws.data.roles?.includes(Role.ADMIN)) {
			ctx.send(ErrorMessage, {
				code: "AUTHORIZATION_FAILED",
				message: "Admin access required",
				context: undefined,
			});
			return;
		}

		// Perform admin action
		const { action, targetUserId, reason } = ctx.payload;

		switch (action) {
			case "kick":
				// Send kick message to target user
				publish(ctx.ws, `user:${targetUserId}`, KickedMessage, {
					reason: reason || "No reason provided",
				});
				break;

			case "ban":
				// Add to ban list (implement your logic)
				console.log(`Banning user ${targetUserId}`);
				break;

			case "mute":
				// Send mute notification
				publish(ctx.ws, `user:${targetUserId}`, MutedMessage, {
					reason: reason || "No reason provided",
				});
				break;
		}
	});
