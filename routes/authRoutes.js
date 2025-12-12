import express from "express";
import sharp from "sharp";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken, verifyToken } from "../backUtils/tokenFunctions.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import {redis} from "../server.js"
import {v4 as uuid} from 'uuid';




const router = express.Router();

// Registration route
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const userid = uuid();

  try {
    const defaultPic = await sharp('./public/assets/default.jpg')
      .resize(128, 128)
      .jpeg({ quality: 80 })
      .toBuffer();

    const [existingUser] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already in use", data: false });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (user_id,username, email, password, profile_pic) VALUES (?,?, ?, ?, ?)",
      [userid,username, email, hashedPassword, defaultPic]
    );

    return res.status(200).json({ message: "User registered successfully", data: true });
  } catch (err) {
    console.error("❌ Registration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});


// Login route
router.post("/login",async (req, res) => {
  console.log("LOGIN HIT")
  const { email, password } = req.body;
  try{
    const [rows] = await pool.query("SELECT password as hp,user_id FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password/no such user", success: false });
    }
    const passwordMatch = await bcrypt.compare(password, rows[0].hp);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password", success: false });
    }
    const userid = rows[0].user_id;
    generateToken(rows[0].user_id,res);

    return res.status(200).json({ message: "Login successful", userid: userid, success: true });
  }catch(err){
    console.error("❌ Query error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
  
});

// Auto Login route
router.get("/autologin",verifyToken ,async (req, res) => {

  const userid = req.userId;
;
  if(userid === null || userid === undefined){
    return res.status(401).json({ message: "Unauthenticated user" });
  }
  return res.status(200).json({ message: "Auto login successful", userid: userid});
 
});

router.get("/refreshtoken", async (req, res) => {

      let userid;
      try{
          const cookies = cookie.parse(req.headers.cookie || '');
          const refreshToken = cookies.refreshToken;
          if (!refreshToken) {
            return res.status(401).json({ message: "No token provided" });
          }
          const decoded = jwt.verify(refreshToken, process.env.refreshTokenSecretKey);
          userid = decoded.userId;
          const storedRefreshToken = await redis.get(`refreshToken:${userid}`);
          if(refreshToken === storedRefreshToken){
              generateToken(userid,res);
              return res.status(200).json({ message: "Token refreshed successfully" });
          }else{
              if (storedRefreshToken) {
                  await redis.del(`refreshToken:${userid}`);
              }
              return res.status(403).json({ message: "Unauthorised User" });
          }
      }catch(err){
          console.error("❌ Token refresh error:", err);
          if (userid) {
               await redis.del(`refreshToken:${userid}`);
          }
          return res.status(500).json({ message: "Internal server error" });
      }
  }
);

router.post("/offline",async (req,res)=>{
  const userid = req.body.userid;
  try{
    const deleteAccessCookie = cookie.serialize("accessToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      expires: new Date(0),
    });
    const deleteRefreshCookie = cookie.serialize("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      expires: new Date(0),
    });

    res.setHeader("Set-Cookie", [deleteAccessCookie, deleteRefreshCookie]);
    return res.status(200).json({ message: "Logged out" });

  }catch(err){
    return res.status(500).json({message : "Internal server Error!"});
  }
  })

export default router;