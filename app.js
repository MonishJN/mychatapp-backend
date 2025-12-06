import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";


const app = express();


// Middleware
app.use(express.json());
app.use(cors({
   origin: process.env.NODE_ENV === "production" 
            ? "https://mchatapp.com"
            : "http://localhost:4000",
  methods: ["GET", "POST"],        // allowed methods
  credentials: true               // allow cookies/auth headers if needed

}));



// Routes
app.use("/api",authRoutes);
app.use("/api/friends",friendRoutes);
app.use("/api",searchRoutes);
app.use("/api",profileRoutes);
app.use("/api/chat",chatRoutes);
app.use("/api/notifications",notificationRoutes);


export default app;