import dotenv from "dotenv";

dotenv.config();

import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import connectToSocket from "./controllers/socketManager.js";
import UserRoutes from "./routes/User.js";
import MeetingRoutes from "./routes/Meeting.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// Validate required environment variables before starting
if (!process.env.MONGO_URL) {
    console.error("FATAL ERROR: MONGO_URL is not defined in environment variables.");
    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    process.exit(1);
}

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", process.env.PORT || 8000);
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

// API Routes
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/meetings", MeetingRoutes);

app.get("/home", (req, res) => {
    res.send("Server is running");
});

// Health check endpoint — used for keep-alive pings to prevent Render free-tier cold starts
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Catch-all 404 Middleware
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

// Global Error Handling Middleware (must be the last use)
app.use(errorHandler);

const start = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("MONGO Connected DB");

        // Drop stale unique username index if it exists in the database
        try {
            await mongoose.connection.db.collection("users").dropIndex("username_1");
            console.log("Dropped stale username_1 index from users collection.");
        } catch (indexErr) {
            // Safe to ignore if index doesn't exist (IndexNotFound = code 27 / codeName IndexNotFound)
            if (indexErr.code !== 27 && indexErr.codeName !== "IndexNotFound") {
                console.warn("Could not drop username_1 index:", indexErr.message);
            }
        }

        server.listen(app.get("port"), () => {
            console.log(`LISTENING ON PORT ${app.get("port")}`);
        });
    } catch (error) {
        console.error("Database Connection Error:", error);
        process.exit(1);
    }
};

start();