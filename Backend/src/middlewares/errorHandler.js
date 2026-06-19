import httpStatus from "http-status";

export const errorHandler = (err, req, res, next) => {
    console.error("Global Error Handler:", err.stack || err.message || err);

    const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = err.message || "Something went wrong. Please try again.";

    res.status(statusCode).json({
        success: false,
        message,
        // Optional: Include stack trace only in development
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};
