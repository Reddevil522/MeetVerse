/**
 * Register.jsx — Premium Registration Page
 * Split-screen layout: Brand panel left · Form right
 * All auth logic (handleRegister, toast, navigate) unchanged.
 */
import "../public/CSS/Authentication.css";
import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { FaUser, FaAt, FaLock, FaEye, FaEyeSlash, FaVideo, FaShieldAlt, FaStar, FaRocket } from "react-icons/fa";

/* ── Brand panel bullets ─────────────────────────────────── */
const brandPerks = [
    { icon: <FaRocket />, text: "Start your first meeting in under 60 seconds" },
    { icon: <FaShieldAlt />, text: "End-to-end encrypted — your data stays private" },
    { icon: <FaStar />, text: "Free forever — no credit card required" },
];

export default function Register() {
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const toast = useToast();

    const { handleRegister } = useContext(AuthContext);
    const navigate = useNavigate();

    /* ── Register handler — logic unchanged ──────────────── */
    const handleAuthRegister = async () => {
        if (password !== confirmPassword) {
            return toast.error("Passwords do not match");
        }
        if (password.length < 6) {
            return toast.warning("Password must be at least 6 characters");
        }
        try {
            setLoading(true);
            await handleRegister(fullName, email, password);
            navigate("/login", { state: { successMessage: "Account created! Please sign in." } });
        } catch (err) {
            const message = err.response?.data?.message || "Registration failed. Please try again.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">

            {/* ══ LEFT BRAND PANEL ══ */}
            <motion.div
                className="auth-left"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
            >
                {/* Logo */}
                <Link to="/" className="auth-brand">
                    <FaVideo /> MeetVerse
                </Link>

                <div className="auth-left-content">
                    <h2>
                        Join <span className="hl">thousands</span><br />already collaborating.
                    </h2>
                    <p>
                        Create your free MeetVerse account and start hosting
                        unlimited video meetings with anyone, anywhere.
                    </p>

                    {/* Feature bullets */}
                    <div className="auth-features">
                        {brandPerks.map((f, i) => (
                            <motion.div
                                key={i}
                                className="auth-feature-item"
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                            >
                                <div className="auth-feature-icon">{f.icon}</div>
                                {f.text}
                            </motion.div>
                        ))}
                    </div>

                    {/* Testimonial mini */}
                    <motion.div
                        className="auth-mockup"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <div className="auth-mockup-header">
                            <div className="auth-mockup-dot" />
                            "MeetVerse changed how our team collaborates."
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", marginTop: 4 }}>
                            — Jessica Taylor, PM @ Stripe
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* ══ RIGHT FORM PANEL ══ */}
            <motion.div
                className="auth-right"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="auth-card glass">
                    <div className="auth-card-header">
                        <h2>Create account</h2>
                        <p>Join thousands of users already chatting</p>
                    </div>

                    {/* Full Name */}
                    <div className="input-group">
                        <label htmlFor="fullName">Full Name</label>
                        <div className="input-wrapper">
                            <FaUser className="input-icon" />
                            <input
                                id="fullName"
                                type="text"
                                placeholder="Your full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                autoComplete="name"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="input-group">
                        <label htmlFor="reg-email">Email Address</label>
                        <div className="input-wrapper">
                            <FaAt className="input-icon" />
                            <input
                                id="reg-email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="input-group">
                        <label htmlFor="reg-password">Password</label>
                        <div className="input-wrapper">
                            <FaLock className="input-icon" />
                            <input
                                id="reg-password"
                                type={showPass ? "text" : "password"}
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="eye-btn"
                                onClick={() => setShowPass(!showPass)}
                                aria-label="Toggle password visibility"
                            >
                                {showPass ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="input-group">
                        <label htmlFor="confirm-password">Confirm Password</label>
                        <div className="input-wrapper">
                            <FaLock className="input-icon" />
                            <input
                                id="confirm-password"
                                type={showPass ? "text" : "password"}
                                placeholder="Repeat your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <motion.button
                        className="auth-submit-btn"
                        onClick={handleAuthRegister}
                        disabled={loading}
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.01 }}
                        style={{ marginTop: 8 }}
                    >
                        {loading ? <span className="btn-spinner" /> : null}
                        {loading ? "Creating account..." : "Create Free Account"}
                    </motion.button>

                    <div className="auth-divider">OR</div>

                    {/* Social */}
                    {/* <button type="button" className="social-btn">
                        <FaGoogle /> Continue with Google
                    </button> */}

                    <div className="auth-footer-link">
                        Already have an account?{" "}
                        <Link to="/login">Sign in</Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}