import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import app from "./app.js";
import { initWebSocket,startQueueProcessor } from "./websocket/chatSocket.js";
import { createClient } from "redis";



const PORT = process.env.PORT || 5000;
const server = createServer(app);


// Declare Redis clients
export const redisQueue = createClient({ url: process.env.REDIS_URL });
export const redis = createClient({ url: process.env.REDIS_URL });

// Async init function to connect them
async function initRedis() {
  redisQueue.on("error", (err) => console.error("RedisQueue Client Error", err));
  await redisQueue.connect();

  redis.on("error", (err) => console.error("Redis Client Error", err));
  await redis.connect();

  // Start queue processor AFTER Redis is ready
  startQueueProcessor(redisQueue);
}

// Kick off Redis init
initRedis();


// Init WebSocket
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
