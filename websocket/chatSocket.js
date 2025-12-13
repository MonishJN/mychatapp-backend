import { WebSocketServer } from "ws";
import pool from "../config/db.js";
// import { allowedOrigins } from "../app.js";
import { redis,redisQueue } from "../server.js";
import { markOnline,markOffline } from "../backUtils/redisFunctions.js";





//  3. process Redis queue in same process
export function startQueueProcessor(redisQueue) {
  (async function processQueue() {
    while (true) {
      const data = await redisQueue.brPop("chat:saveQueue", 0);
      if(data){
        const {element} = data;
        const msg = JSON.parse(element);

        const [result] = await pool.query(
          "INSERT INTO message (chat_id, sender_id, message) VALUES (?, ?, ?)",
          [msg.to, msg.from, msg.message]
        );
        const messageId = result.insertId;
         // 4. send ack back to sender directly via wss
        for (let client of chatRoom.get(msg.to) || []) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "msgAckn",
              tempId: msg.tempId,
              message_id: messageId,
              status: "saved"
            }));
          }
        
        }
     }
    }
  })();
}




const chatRoom = new Map();              //- (chatid → Set<ws>)
export const users = new Map();         //- (userid → Set<ws>)
const socketSet = new Map();          //- (ws → Set<chatid>)




export function initWebSocket(server) {
  // const wss = new WebSocketServer({ server,
  //   verifyClient: function (info, callback) {
  //       // 'info.origin' contains the domain of the client attempting to connect
  //       const origin = info.origin;

  //      if (allowedOrigins.includes(origin) || /^https:\/\/mychatapp-.*\.vercel\.app$/.test(origin)) {
  //           // Origin is allowed
  //           callback(true);
  //       } else {
  //           // Origin is NOT allowed
  //           console.log(`Blocked WebSocket connection attempt from unauthorized origin: ${origin}`);
  //           callback(false, 403, 'Forbidden');
  //       }
  //   }
  //  });
  const wss = new WebSocketServer({ 
        server,
        // TEMPORARILY REPLACE YOUR COMPLEX LOGIC WITH A SIMPLE ACCEPT FUNCTION
        verifyClient: function (info, callback) {
            // WARNING: This allows ALL origins for debugging purposes.
            // We will revert this after the test.
            
            // Log the origin for verification in Railway logs
            console.log(`[WS DEBUG] Allowing connection from origin: ${info.origin}`);
            
            // Force acceptance for all origins
            callback(true);
        }
    });
  wss.on("connection", (ws) => {
    ws.userid=null;
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);
        // Handle user registration
        if (data.type === "register") {
          ws.userid = data.userid;
          if (!users.has(data.userid)) {
            users.set(data.userid, new Set());
          }
          users.get(data.userid).add(ws);
          const Uid = data.userid;
          await markOnline(redis, Uid);

        }
        // Handle chat room
        else if (data.type === "join") {
          const chatid = data.chatid;
          const userid = ws.userid;
          if (!chatRoom.has(chatid)) {
            chatRoom.set(chatid, new Set());
          }
          chatRoom.get(chatid).add(ws);
          
          if (!socketSet.has(ws)) {
            socketSet.set(ws, new Set());
          }
          socketSet.get(ws).add(chatid);
        }
        //Handle chat message
        else if (data.type === "chat") {
          const senderid = data.from;
          const from  = data.from;
          const { chatid, message } = data;
          const tempId = `${chatid}_${from}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

          try {
            // Check friendship in Redis
            const isFriend = await redis.sIsMember(`chats:${from}`, chatid.toString());
            if (!isFriend) {
              for (let client of chatRoom.get(chatid)) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ type:"error",error: "Can't send messages!" }));
                }
              }
              return;
            }
            const clients = chatRoom.get(chatid);
            if (!clients) {
              console.error("No clients found for chatid:", chatid);
            } else if (typeof clients[Symbol.iterator] !== 'function') {
              console.error("chatRoom.get(chatid) is not iterable:", clients);
            }

            // Send message instantly (real-time)
            for (let client of chatRoom.get(chatid)) {
              if (client.readyState === WebSocket.OPEN) {
               client.send(JSON.stringify({
                  type: "chat",
                  msg: {
                    tempId,
                    message_id: null,
                    sender_id: senderid,
                    time: new Date().toTimeString().split(" ")[0],
                    message,
                    status: "pending",
                  },
                  notifyid: chatid
                }));
                
              }
            }

            // Push to Redis queue for DB save
            await redis.lPush(
              "chat:saveQueue",
              JSON.stringify({ from, to: chatid, message, tempId })
            );
           
          } catch (err) {
              console.error("Error sending message:", err);
            }
        }
        else if (data.type === 'offline' || data.type === 'closetab') {
          const userid = data.userid;

          // If user still has multiple tabs open → ignore
          if (users.get(userid)?.size > 1) return;

          if(data.type === 'offline'){
            await redis.del(`refreshToken:${userid}`);
          }

          // Notify friends
          const flists = await redis.sMembers(`friends:${userid}`);
          for (const flist of flists) {
            const sockets = users.get(flist);
            if (sockets) {
              for (const socket of sockets) {
                socket.send(JSON.stringify({
                  type: "offline",
                  friend_id: userid
                }));
              }
            }
          }
          // Mark offline
          await markOffline(redis, userid);
        }



      } catch (error) {
        console.error("Error processing message:", error);
      }
  });
  // Handle client disconnectionq
  ws.on("close", async () => {
  const userid = ws.userid;

  // 1) remove from chat rooms
  if (socketSet.has(ws)) {
    for (const chatid of socketSet.get(ws)) {
      const room = chatRoom.get(chatid);
      if (room) {
        room.delete(ws);
        if (room.size === 0) chatRoom.delete(chatid);
      }
    }
    socketSet.delete(ws);
  }

  // 2) remove from users map
  if (userid && users.has(userid)) {
    users.get(userid).delete(ws);

    // If user still has other tabs open → do not send offline
    if (users.get(userid).size > 0) return;

    // No sockets left → user is OFFLINE
    users.delete(userid);



    // Notify all friends
    const flists = await redis.sMembers(`friends:${userid}`);
    for (const flist of flists) {
      const sockets = users.get(flist);
      if (sockets) {
        for (const socket of sockets) {
          socket.send(JSON.stringify({
            type: "offline",
            friend_id: userid
          }));
        }
      }
    }
     // Update Redis
    await markOffline(redis, userid);

    console.log(`User ${userid} is fully offline. from websocket onclose`);
  }
});
 

});
}



