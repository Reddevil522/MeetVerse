/**
 * PageTransition.jsx
 * Framer Motion wrapper for smooth page entry animations.
 * Wrap any page component with this to get fade+slide transitions.
 */
import { motion } from "framer-motion";

const pageVariants = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
    exit:    { opacity: 0, y: -8,  transition: { duration: 0.2 } },
};

export default function PageTransition({ children }) {
    return (
        <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: "100%", minHeight: "100vh" }}
        >
            {children}
        </motion.div>
    );
}
