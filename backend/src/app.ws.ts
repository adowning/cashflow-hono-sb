/* eslint-disable @stylistic/indent */
import { z } from "zod";
import {
  WebSocketRouter,
  createMessageSchema,
  publish,
} from "bun-ws-router/zod";
import * as jwt from "jsonwebtoken";
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
const AuthMessage = messageSchema("AUTH", {
  token: z.string(),
});

const AuthSuccessMessage = messageSchema("AUTH_SUCCESS", {
  userId: z.string(),
  username: z.string(),
  roles: z.array(z.enum(Role)),
});

const AdminActionMessage = messageSchema("ADMIN_ACTION", {
  action: z.enum(["kick", "ban", "mute"]),
  targetUserId: z.string(),
  reason: z.string().optional(),
});

const KickedMessage = messageSchema("KICKED", { reason: z.string() });
const MutedMessage = messageSchema("MUTED", { reason: z.string() });

interface JwtPayload {
  userId: string;
  username: string;
  roles: Role[];
}
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
  .onOpen((ctx) => {
    //     ctx.ws.send('ok');
    console.log(`Client ${ctx.ws.data.clientId} connected`);
    //         console.log(ctx.ws.data);
    // Initialize as unauthenticated
    ctx.ws.data.userId = "";
    ctx.ws.data.username = "";
    ctx.ws.data.roles = [];
    ctx.ws.data.authenticated = false;

    //  const protocols = ctx.req.headers.get('sec-websocket-protocol');
    // const token = protocols
    //   ?.split(',')
    //   .map((p) => p.trim())
    //   .find((p) => p.startsWith('bearer.'))
    //   ?.slice(7); // Remove "bearer." prefix

    if (!ctx.ws.data.token || getSessionFromToken(ctx.ws.data.token) == null) {
      console.log("seting up for tha kill");
      setTimeout(() => {
        console.log("killin it...");
        if (!ctx.ws.data.authenticated) {
          console.log("dead");
          ctx.ws.close(1008, "Authentication required");
        }
      }, 7000);
    }
    console.log("here");
  })

  .onMessage(AuthMessage, async (ctx) => {
    try {
      // Verify JWT token
      const decoded = jwt.verify(
        ctx.payload.token,
        process.env.JWT_SECRET!
      ) as JwtPayload;

      // Store user data in connection
      ctx.ws.data.userId = decoded.userId;
      ctx.ws.data.username = decoded.username;
      ctx.ws.data.roles = decoded.roles || [Role.USER];
      ctx.ws.data.authenticated = true;

      // Subscribe to user-specific channel
      ctx.ws.subscribe(`user:${decoded.userId}`);

      // Subscribe to role channels
      for (const role of decoded.roles) {
        ctx.ws.subscribe(`role:${role}`);
      }

      // Send success
      ctx.send(AuthSuccessMessage, {
        userId: decoded.userId,
        username: decoded.username,
        roles: decoded.roles,
      });
    } catch (_error) {
      ctx.send(ErrorMessage, {
        code: "AUTHENTICATION_FAILED",
        message: "Invalid token",
        context: undefined,
      });

      // Close connection
      ctx.ws.close(1008, "Invalid token");
    }
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
