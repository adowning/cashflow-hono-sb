import type { MiddlewareHandler } from "hono";
import { redis, RedisClient } from "bun";

let sessionCache: RedisClient;
let gameSessionCache: RedisClient;

export const initializeDataCache = () => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  sessionCache = new RedisClient(redisUrl);
  gameSessionCache = new RedisClient(redisUrl);
};

// export const cacheMiddleware = (options?: any): MiddlewareHandler => {
//   return async (c, next) => {
//     const _cache: MiddlewareHandler = async (c, next) => {
//       c.set("sessionCache", sessionCache);
//       c.set("gameSessionCache", gameSessionCache);
//     };
//   };
// };

const cache: MiddlewareHandler = async (c, next) => {
  c.set("sessionCache", sessionCache);
  c.set("gameSessionCache", gameSessionCache);
  await next();
};

export default cache;
