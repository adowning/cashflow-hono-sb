import { startManufacturedGameplay } from "@/modules/bot/bot.service";
import { showRoutes } from "hono/dev";
import app from "./app";
import { updateWithAllGameSessionsToCompleted } from "./core/database/db";

const port = 3000;

// serve({
// 	fetch: app.fetch,
// 	port,
// });
export const CORS_HEADERS = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  },
};
// const server = Bun.serve({
//   port,
//   async fetch(req, server) {
//     console.log(req.url);
//     return app.fetch(req, server);
//   },
//   //   websocket: wsRouter.websocket,
// });

// const server = Bun.serve<Client, Record<`/${string}`, Response>>({
const server = Bun.serve({
  port,
  websocket: wsRouter.websocket,
  //  {
  //   async message(ws, msg) {
  //     ctx.server = server;
  //     onMessage(ws, msg, ctx);
  //   },
  //   async open(ws) {
  //     ctx.server = server;
  //     onOpen(ws, ctx, broadcastTopic);
  //   },
  //   async close(ws) {
  //     ctx.server = server;
  //     onClose(ws, ctx);
  //   },
  // },
  async fetch(req, server) {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      const res = new Response("Departed", CORS_HEADERS);
      return res;
    }
    if (req.url == "/ws") {
      // WS Upgrade
      // server.upgrade(req, websocketUpgrade());

      // fallback
      return new Response("404!");
    }
    app.fetch(req, server);
  },
});
showRoutes(app);
console.log(`Server is running on port - ${server.port}`);
console.log(`Running on http://localhost:${server.port}`);

process.on("SIGINT", () => {
  console.log("\nReceived SIGINT\nrunning cleanup...");
  // TODO: ctx cleanup?
  server.stop(true);
  console.log("all done.");
  process.exit();
});

await updateWithAllGameSessionsToCompleted();
startManufacturedGameplay();
