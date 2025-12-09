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
const allowedOrigins = [
  "https://mychatapp-two.vercel.app",
  "https://mychatapp-git-main-monishjns-projects.vercel.app",
  "https://mychatapp-9c736ojtx-monishjns-projects.vercel.app",
  "http://localhost:4000"   // for dev
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(null, false);  // safer than throwing
  },
  methods: ["GET", "POST"],
  credentials: true
}));

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.use("/api",authRoutes);
app.use("/api/friends",friendRoutes);
app.use("/api",searchRoutes);
app.use("/api",profileRoutes);
app.use("/api/chat",chatRoutes);
app.use("/api/notifications",notificationRoutes);


export default app;