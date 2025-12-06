import express from "express";
import pool from "../config/db.js";
import { verifyToken } from "../backUtils/tokenFunctions.js";

const router = express.Router();

router.get("/search",verifyToken,async (req, res) => {
  const query = req.query.name;
    if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
    }
    try{
        const [results] = await pool.query("SELECT user_id, username FROM users WHERE username LIKE ?", [`%${query}%`]);
        if(results.length === 0){
            return res.status(404).json({ message: "No users found" });
        }
        return res.status(200).json({ message: "Search results", results:results });
    }catch(err){
        console.error("❌ Query error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }

});

export default router;