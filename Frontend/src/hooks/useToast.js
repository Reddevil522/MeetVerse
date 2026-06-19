import { useContext } from "react";
import { ToastContext } from "../contexts/ToastContext";

/**
 * Custom hook to trigger global toast notifications.
 * Usage:
 * const toast = useToast();
 * toast.success("It works!");
 */
export const useToast = () => {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }

    const { addToast } = context;

    return {
        success: (message) => addToast(message, "success"),
        error: (message) => addToast(message, "error"),
        warning: (message) => addToast(message, "warning"),
        info: (message) => addToast(message, "info"),
    };
};
