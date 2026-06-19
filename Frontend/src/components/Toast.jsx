import { motion } from "framer-motion";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaExclamationTriangle, FaTimes } from "react-icons/fa";

export default function Toast({ toast, onClose }) {
    const { message, type } = toast;

    // Determine the icon dynamically based on the toast type
    const getIcon = () => {
        switch (type) {
            case "success": return <FaCheckCircle className="toast-icon success" />;
            case "error": return <FaExclamationCircle className="toast-icon error" />;
            case "warning": return <FaExclamationTriangle className="toast-icon warning" />;
            case "info":
            default:
                return <FaInfoCircle className="toast-icon info" />;
        }
    };

    return (
        <motion.div
            className={`toast-item ${type}`}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            layout
        >
            <div className="toast-content">
                {getIcon()}
                <span className="toast-message">{message}</span>
            </div>
            <button className="toast-close-btn" onClick={onClose} aria-label="Close Toast">
                <FaTimes />
            </button>
        </motion.div>
    );
}
