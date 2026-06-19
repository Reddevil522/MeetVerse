import { createContext, useState, useCallback, useRef } from "react";
import ToastContainer from "../components/ToastContainer";

// Create the context
// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext(null);

// Deduplication window in ms — any identical (message+type) within this
// window is silently dropped. Fixes React StrictMode double-mount firing
// the same toast twice.
const DEDUP_WINDOW_MS = 800;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    // Map of "type:message" → timestamp of last add
    const recentKeys = useRef(new Map());

    // Function to remove a toast by ID
    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    // Function to add a new toast (with deduplication)
    const addToast = useCallback((message, type = "info") => {
        const key = `${type}:${message}`;
        const now = Date.now();
        const lastSeen = recentKeys.current.get(key) ?? 0;

        // Drop exact duplicate within the dedup window
        if (now - lastSeen < DEDUP_WINDOW_MS) return;
        recentKeys.current.set(key, now);

        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto dismiss after 4 seconds
        setTimeout(() => {
            removeToast(id);
        }, 4000);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            {/* The ToastContainer renders the list of active toasts globally */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};
