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

// app.use(cors({
//   origin: process.env.NODE_ENV === "production" ? 
//     "https://mychatapp-two.vercel.app" : "http://localhost:4000",
//   methods: ["GET", "POST"],
//   credentials: true
// }));

// app.js

export const allowedOrigins = [
  "https://mychatapp-two.vercel.app",
  "https://mychatapp-git-main-monishjns-projects.vercel.app",
  "https://mychatapp-9c736ojtx-monishjns-projects.vercel.app",
  // Add your local port here, which the Vercel app will be connecting to
  "http://localhost:5000", 
  "http://localhost:4000" // Keep this if you also run your frontend locally
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // mobile apps, curl, etc.

    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/mychatapp-.*\.vercel\.app$/.test(origin)  // Allow all Vercel previews
    ) {
      callback(null, true);
    } else {
      console.log("HTTP CORS BLOCKED:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));



// Routes
app.use("/api",authRoutes);
app.use("/api/friends",friendRoutes);
app.use("/api",searchRoutes);
app.use("/api",profileRoutes);
app.use("/api/chat",chatRoutes);
app.use("/api/notifications",notificationRoutes);


export default app;