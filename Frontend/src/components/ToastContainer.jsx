import Toast from "./Toast";
import { AnimatePresence } from "framer-motion";
import "../public/CSS/Toast.css";

export default function ToastContainer({ toasts, removeToast }) {
    return (
        <div className="toast-container">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        toast={toast}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
