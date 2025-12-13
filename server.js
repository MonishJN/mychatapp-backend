import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
// import https from "https";
// import fs from "fs";
import app from "./app.js";
import { initWebSocket,startQueueProcessor } from "./websocket/chatSocket.js";
import { createClient } from "redis";



const PORT = process.env.PORT || 5000;

// Load the certificate files (change paths/names if needed)
// const options = {
//   key: fs.readFileSync('localhost-key.pem'), 
//   cert: fs.readFileSync('localhost.pem')
// };

const server = createServer(app);
// const server = https.createServer(options, app);


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
  console.log(`🚀 Server running on ${PORT}`);
});
