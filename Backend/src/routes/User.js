import { Router } from "express";
import { login, register, updateProfile, getUserProfile, forgotPassword, resetPassword } from "../controllers/User.js";
import { authenticateUser } from "../middlewares/auth.js";

const router = Router();

router.route("/login").post(login);
router.route("/register").post(register);

// Password Reset Routes
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password/:token").post(resetPassword);

// Protected routes
router.route("/profile").get(authenticateUser, getUserProfile);
router.route("/profile").put(authenticateUser, updateProfile);

export default router;