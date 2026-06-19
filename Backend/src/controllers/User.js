import httpStatus from "http-status";
import { User } from "../models/Users.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { wrapAsync } from "../utils/wrapAsync.js";

const login = wrapAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: "Please provide email and password"
        });
    }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Invalid password"
            });
        }

        const payload = {
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || "fallback_secret", {
            expiresIn: "10h"
        });
        
        user.token = token;
        await user.save();

        return res.status(httpStatus.OK).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                avatar: user.avatar
            }
        });
});

const register = wrapAsync(async (req, res, next) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: "Please provide fullName, email and password"
        });
    }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({
                message: "User with this email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword
        });

        await newUser.save();

        return res.status(httpStatus.CREATED).json({
            message: "User registered successfully"
        });
});

const updateProfile = wrapAsync(async (req, res, next) => {
        const { fullName, avatar } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        if (fullName) user.fullName = fullName;
        if (avatar) user.avatar = avatar;

        await user.save();

        return res.status(httpStatus.OK).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                avatar: user.avatar
            }
        });
});

const getUserProfile = wrapAsync(async (req, res, next) => {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }
    res.json({
        message: "Profile data",
        user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            avatar: user.avatar
        }
    });
});

const forgotPassword = wrapAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide an email" });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }

    // Generate token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Set token and expiration (1 hour)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    // Since we don't have an email service, return the token in the response so the frontend can display it.
    res.status(httpStatus.OK).json({ 
        success: true, 
        message: "Reset link generated", 
        resetToken 
    });
});

const resetPassword = wrapAsync(async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Please provide a new password" });
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Password reset token is invalid or has expired" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(httpStatus.OK).json({ success: true, message: "Password has been reset successfully" });
});

export { login, register, updateProfile, getUserProfile, forgotPassword, resetPassword };