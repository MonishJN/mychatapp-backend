
import {redis} from "../server.js"
import jwt from "jsonwebtoken";
import cookie from "cookie";


export async function generateToken(userid,res) {
    const accessToken = jwt.sign({ userId: userid }, process.env.accessTokenSecretKey, { expiresIn: "1h" });
    const refreshToken = jwt.sign({ userId: userid }, process.env.refreshTokenSecretKey, { expiresIn: "7d" });
    const accessCookie = cookie.serialize("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60, // 1 hour
        });

    const refreshCookie = cookie.serialize("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
        });

    res.setHeader("Set-Cookie", [accessCookie, refreshCookie]);

    await redis.set(`refreshToken:${userid}`, refreshToken ,'EX', 7 * 24 * 60 * 60); // 7 days expiration 'EX', 7 * 24 * 60 * 60

}


export function verifyToken(req,res,next) {
    try{
        const cookies = cookie.parse(req.headers.cookie || '');
        const accessToken = cookies.accessToken;
        if (!accessToken) {
            return res.status(401).json({ code:"no token" });
        }
        jwt.verify(accessToken, process.env.accessTokenSecretKey, (err, decoded) => {
        if (err) { 
            return res.status(401).json({ code:"exp token" }); 
        }
        req.userId = decoded.userId;
        next();
        });
    }catch(err){
        console.error("❌ Token verification error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
}

