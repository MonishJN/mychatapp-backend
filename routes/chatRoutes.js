import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../backUtils/tokenFunctions.js";

const router = express.Router();

router.get("/:chatid",verifyToken,async (req,res)=>{

    const userid = req.userId;
    const chatid = req.params.chatid;

    try{
        const [result] = await pool.query(`SELECT message_id,sender_id,
                                    CASE WHEN sender_id = ? THEN TRUE ELSE FALSE END AS sent,
                                    TIME(created_at) AS time,message
                                    FROM message WHERE chat_id = ?
                                    ORDER BY message_id`, [userid, chatid]);
        if(result.length>0){
            return res.status(200).json({ message: "messages retrived",data:result });
        }
        else{
             return res.status(204).json({ message: "messages not found",data:[]});
        }
    }catch(err){
        console.error("❌ Query error in chatRoutes:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
    
})

export default router;