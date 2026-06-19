import { Router } from "express";
import { getMeetingHistory, addToHistory, deleteMeetingHistory } from "../controllers/Meeting.js";
import { authenticateUser } from "../middlewares/auth.js";

const router = Router();

router.get("/history", authenticateUser, getMeetingHistory);
router.post("/history", authenticateUser, addToHistory);
router.delete("/history/:meetingCode", authenticateUser, deleteMeetingHistory);

export default router;
