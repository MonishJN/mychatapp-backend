import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import app from "./app.js";
// import { initWebSocket,startQueueProcessor } from "./websocket/chatSocket.js";
// import { createClient } from "redis";

const PORT = process.env.PORT;
if (!PORT) {
  throw new Error("PORT not provided by Railway");
}

const server = createServer(app);

// server.listen(PORT,"0.0.0.0", () => {
//   console.log(`🚀 Server running on ${PORT}`);
// });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on ${PORT}`);
});

// Init WebSocket
// initWebSocket(server);

// Declare Redis clients
// export const redisQueue = createClient({ url: process.env.REDIS_URL });
// export const redis = createClient({ url: process.env.REDIS_URL });

// // Async init function to connect them
// async function initRedis() {
//   try {
//     redisQueue.on("error", (err) =>
//       console.error("RedisQueue Client Error", err)
//     );
//     redis.on("error", (err) =>
//       console.error("Redis Client Error", err)
//     );

//     await Promise.all([
//       redisQueue.connect(),
//       redis.connect()
//     ]);

//     startQueueProcessor(redisQueue);
//     console.log("✅ Redis connected");
//   }catch(err){
//     console.error("Redis connection error:", err);
//   }
// }

// // Kick off Redis init
// initRedis();




