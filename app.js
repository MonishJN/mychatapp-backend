import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";


const app = express();

app.use(cors({
  origin: "https://mychatapp-two.vercel.app",
  methods: ["GET","POST"],
  credentials: true
}));



app.use(express.json());


//Routes
app.get('/', (req, res) => {
    res.status(200).send('Server Healthy');
});
app.use("/api",authRoutes);
app.use("/api/friends",friendRoutes);
app.use("/api",searchRoutes);
app.use("/api",profileRoutes);
app.use("/api/chat",chatRoutes);
app.use("/api/notifications",notificationRoutes);


export default app;