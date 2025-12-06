import express from "express";
import pool from "../config/db.js";
import {redis} from"../server.js"
import {users} from "../websocket/chatSocket.js"
import { verifyToken } from "../backUtils/tokenFunctions.js";


const router = express.Router();

//friendStatusFunction:
async function friendStatus(userid,friends) {
  const chatMap = `chats:${userid}`;
  const friendMap = `friends:${userid}`;

  for (const friend of friends) {
    if(friend.bond ==="friends"){
      const chatKey = friend.chat_id.toString();
      const friendId = friend.friend_id.toString();
      const statusKey = `friends:${friendId}`;

      await redis.sAdd(chatMap,chatKey);
      await redis.sAdd(friendMap,friendId);

      const isOnline = await redis.exists(statusKey);
      
      friend.status = isOnline ? "online" : "offline";


        if(isOnline){

          const sockets = users.get(friend.friend_id);
          if (sockets) {
            for (const ws of sockets) {
              ws.send(JSON.stringify({ type: 'online',friend_id : userid }));
            }
          }
        }
    }
  }
}


//retreiving friends list
router.get("/",verifyToken ,async (req, res) => {
  const userid = req.userId;
  try {
    const [result] = await pool.query(
      `SELECT users.username AS friendname, friendship.chat_id AS chat_id, 
      friendship.friend_id AS friend_id,status as bond,'' as status
      FROM friendship JOIN users ON friendship.friend_id = users.user_id 
      WHERE friendship.user_id = ? and friendship.status in ('friends','blocked')`,
      [userid]
    );

    if (result.length === 0) {
      return res.status(204).json({ message: 'You are socially awkward!', data: [] });
    }
    try{
      await friendStatus(userid,result);
    }catch(err){
      console.error(err);
    }
    return res.status(200).json({ message: "Friends list", data: result });
  } catch (err) {
    console.error("❌ Query error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;






