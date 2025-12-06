import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../backUtils/tokenFunctions.js";

const router = express.Router();


export default router;



router.get("/", verifyToken,async (req, res) => {
  const userid = req.userId;
    try {
    const [notifications] = await pool.query(
      `SELECT users.user_id as userid,users.username as username,friendship.status as status 
      FROM friendship join users on friendship.friend_id=users.user_id WHERE friendship.user_id=?
      AND friendship.status = 'request received'`,
      [userid]
      // do IN ('request received', 'been unfriended', 'been blocked') in the query if u want unfriended & blocked too
    );
    if(notifications.length === 0){
        return res.status(200).json({ notifications: [] });
    }
    res.status(200).json({notifications: notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



router.post("/handlereject", verifyToken, async (req, res) => {
  const  {id}  = req.body;
  const userId = req.userId;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction()
    const del = `DELETE FROM friendship WHERE user_id = ? AND friend_id = ?`;
    await conn.query(del,[id,userId]);
    await conn.query(del,[userId,id]);
    await conn.commit();
    return res.status(200).json({ message: "User rejected", success: true });    
  } catch (error) {
    console.error("Error handling accept:", error);
    res.status(500).json({ message: "Internal server error" });
  }finally{
    if (conn) {
      conn.release();
    }
  }
});