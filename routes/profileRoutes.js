import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../backUtils/tokenFunctions.js";
import {v4 as uuid} from 'uuid';
import {users} from "../websocket/chatSocket.js"
import { redis } from "../server.js";

const router = express.Router();

router.get("/profile/:friendid",verifyToken,async (req, res) => {
    try{
        const userid = req.userId;
        let friendid = req.params.friendid;
        try {
            if (!friendid ) throw new Error("Invalid friendid");
        } catch (err) {
            console.error("❌ Decryption failed:", err.message);
            return res.status(400).json({ message: "Invalid friend ID" });
        }
        if(userid === friendid){
            const [result] = await pool.execute(
            "SELECT username FROM users WHERE user_id = ?",
            [userid]
            );
            if (result.length === 0) {
                return res.status(404).json({ message: "User not found", success: false });
            }
            return res.status(200).json({ message: "Self profile", data: result[0], isSelf: true });

        }


        try{
            const sql = `SELECT 
            users.username AS username,
            friendship.status AS status 
        FROM users 
        LEFT JOIN friendship 
            ON friendship.friend_id = users.user_id 
            AND friendship.user_id = ?
        WHERE users.user_id = ?;
        `;
        const [result] = await pool.execute(sql,[userid,friendid]);
        if(result.length === 0){
            return res.status(404).json({ message: "User not found", success: false });
        }
        return res.status(200).json({message:"Profile fetched", data : result[0], isSelf : false});
        }catch(err){
            console.error("❌ Query error:", err);
            return res.status(500).json({ message: "Internal server error" });
        
        }
    }catch(err){
        console.error("Enna prechana na:",err);
    }
});

router.get("/profile/:userid/profile-pic", verifyToken, async (req, res) => {
    const userid = req.params.userid;

  try {
    const sql = `SELECT profile_pic FROM users WHERE user_id = ?`;
    const [result] = await pool.query(sql, [userid]);


    if (result.length === 0 || !result[0].profile_pic) {
      return res.status(404).json({ message: "Profile picture not found!" });
    }

    const imageBuffer = Buffer.from(result[0].profile_pic); // Ensure it's a Buffer
    res.setHeader("Content-Type", "image/jpeg"); //  Explicitly set header
    
    return res.status(200).send(imageBuffer); //  Send buffer directly

  } catch (err) {
    console.error("Internal server error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/update/:userid/profile-pic",express.raw({ type: 'image/*', limit: '5mb' }),verifyToken,async (req,res)=>{
    const userid = req.params.userid;
    const image = req.body;
    try{
        const sql = `update users set profile_pic = ? where user_id = ?`;
        await pool.query(sql,[image,userid]);
        return res.status(200).json({message:"Profile picture is successfully updated!"});

    }catch(err){
        console.error("Error in Update Profile Picture:",err);
        return res.status(500).json({message:"Error in updating profile picture!"});
    }
})



router.post("/addfriend",verifyToken, async(req, res) => {
    const userid = req.userId;
    const  friendid  = req.body.friendid;
    let conn;
    try{
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const insert1 = `INSERT INTO friendship (user_id, friend_id, status) VALUES (?, ?, 'pending') on duplicate key update status='pending'`;
        const insert2 = `INSERT INTO friendship (user_id, friend_id, status) VALUES (?, ?, 'request received') on duplicate key update status='request received'`;
        await conn.query(insert1,[userid,friendid]);
        await conn.query(insert2,[friendid,userid]);
        await conn.commit();
        return res.status(200).json({ message: "Friend request sent", success: true });
    }catch(err){
        if (conn) {
            await conn.rollback();
        }
        console.error("❌ Query error:", err);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        if (conn) {
            conn.release();
        }
    }  
});

router.post("/acceptrequest",verifyToken, async(req, res) => {
    const userid = req.userId;
    const  friendid  = req.body.friendid;
    const chatid= uuid();
    let conn;
    try{
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const chatQuery = `INSERT INTO chat (chat_id) VALUES (?)`;
        await conn.query(chatQuery, [chatid]);
        const updateQuery = `UPDATE friendship SET status = 'friends',chat_id =? WHERE user_id = ? AND friend_id = ?`;
        await conn.query(updateQuery,[chatid,userid,friendid]);
        await conn.query(updateQuery,[chatid,friendid,userid]);
        const [data] = await conn.query(`SELECT users.username AS friendname, friendship.chat_id AS chat_id, 
                            friendship.user_id AS friend_id,status as bond,'' as status
                            FROM friendship JOIN users ON friendship.user_id = users.user_id 
                            WHERE friendship.user_id = ? and friendship.friend_id = ? and friendship.status ='friends'`,
                            [friendid,userid]);
        await conn.commit();
        return res.status(200).json({ message: "Friend request accepted", success: true , data: data[0] });
    }catch(err){
        if (conn) {
            await conn.rollback();
        }
        console.error("❌ Query error:", err);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        if (conn) {
            conn.release();
        }
    }
});

router.post("/unfriend", verifyToken, async (req, res) => {
    const userid = req.userId;
    const { friendid } = req.body;
    let conn;

    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Check if friendship exists
        const [cid] = await conn.query(
            `SELECT chat_id FROM friendship 
             WHERE user_id = ? AND friend_id = ?`,
            [userid, friendid]
        );

        if (!cid.length || !cid[0].chat_id) {
            await conn.rollback();
            return res.status(404).json({ message: "Friendship not found", success: false });
        }

        const chatId = cid[0].chat_id;

        const del1 = `DELETE FROM friendship WHERE user_id = ? AND friend_id = ?`;
        const del2 = `DELETE FROM friendship WHERE user_id = ? AND friend_id = ?`;
        const delMessages = `DELETE FROM message WHERE chat_id = ?`;
        const delChat = `DELETE FROM chat WHERE chat_id = ?`;

        await conn.query(del1, [userid, friendid]);
        await conn.query(del2, [friendid, userid]);
        await conn.query(delMessages, cid[0].chat_id);
        await conn.query(delChat, cid[0].chat_id);

        // Notify friend about unfriending
        const sockets = users.get(friendid);
        if (sockets) {
            for (const ws of sockets) {
                ws.send(JSON.stringify({ type: "ufl", friend_id: userid }));
            }
            await redis.sRem(`chats:${friendid}`, chatId.toString());
        }

        await redis.sRem(`chats:${userid}`, chatId.toString());

        await conn.commit();
        return res.status(200).json({ message: "User unfriended", success: true });

    } catch (err) {
        if (conn) await conn.rollback();
        console.error("❌ Query error:", err);
        return res.status(500).json({ message: "Internal server error" });

    } finally {
        if (conn) conn.release();
    }
});


router.post("/block",verifyToken, async(req, res) => {
    const userid = req.userId;
    const { friendid } = req.body;
    let conn;
    try{
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const update1 = `UPDATE friendship SET status = 'blocked' WHERE user_id = ? AND friend_id = ?`;
        const update2 = `UPDATE friendship SET status = 'been blocked' WHERE user_id = ? AND friend_id = ?`;
        await conn.query(update1,[userid,friendid]);
        await conn.query(update2,[friendid,userid]);
        await conn.commit();
        return res.status(200).json({ message: "User blocked", success: true });
    }catch(err){
        if (conn) {
            await conn.rollback();
        }
        console.error("❌ Query error:", err);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        if (conn) {
            conn.release();
        }
    }  
});

router.post("/unblock",verifyToken, async(req, res) => {
    const userid = req.userId;
    const { friendid } = req.body;
    let conn;
    try{
        conn = await pool.getConnection();
        await conn.beginTransaction();
        const update1 = `UPDATE friendship SET status = 'friends' WHERE user_id = ? AND friend_id = ?`;
        const update2 = `UPDATE friendship SET status = 'friends' WHERE user_id = ? AND friend_id = ?`;
        await conn.query(update1,[userid,friendid]);
        await conn.query(update2,[friendid,userid]);
        await conn.commit();
        return res.status(200).json({ message: "User unblocked", success: true });
    }catch(err){
        if (conn) {
            await conn.rollback();
        }
        console.error("❌ Query error:", err);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        if (conn) {
            conn.release();
        }
    }  
});

    

export default router;
