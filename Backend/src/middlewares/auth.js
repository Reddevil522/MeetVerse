import jwt from "jsonwebtoken";
import httpStatus from "http-status";

export const authenticateUser = (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "No token, authorization denied" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
        req.user = decoded.user ? { ...decoded.user, _id: decoded.user.id } : decoded;
        next();
    } catch (err) {
        res.status(httpStatus.UNAUTHORIZED).json({ message: "Token is not valid" });
    }
};
