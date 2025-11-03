import { BunSqliteKeyValue } from "@/libs/cache";
import type { MiddlewareHandler } from "hono";

let sessionCache: BunSqliteKeyValue;
let gameSessionCache: BunSqliteKeyValue;

export const initializeDataCache = () =>
{
  sessionCache = new BunSqliteKeyValue(":memory:");
  gameSessionCache = new BunSqliteKeyValue(":memory:");
};

// export const cacheMiddleware = (options?: any): MiddlewareHandler => {
//   return async (c, next) => {
//     const _cache: MiddlewareHandler = async (c, next) => {
//       c.set("sessionCache", sessionCache);
//       c.set("gameSessionCache", gameSessionCache);
//     };
//   };
// };

const cache: MiddlewareHandler = async (c, next) =>
{
  c.set("sessionCache", sessionCache);
  c.set("gameSessionCache", gameSessionCache);
  await next();

};

export default cache

