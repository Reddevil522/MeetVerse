/**
 * Login.jsx — Premium Authentication Page
 * Split-screen: Brand panel left · Login form right
 * All auth logic (handleLogin, toast, navigate) unchanged.
 */
import "../public/CSS/Authentication.css";
import { useState, useContext, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { FaLock, FaEye, FaEyeSlash, FaAt, FaVideo, FaMicrophone, FaDesktop, FaComments } from "react-icons/fa";

/* ── Left panel feature bullets ─────────────────────────── */
const brandFeatures = [
    { icon: <FaVideo />, text: "HD Video Calling — Crystal-clear 1080p" },
    { icon: <FaMicrophone />, text: "AI Noise Cancellation built in" },
    { icon: <FaDesktop />, text: "One-click Screen Sharing" },
    { icon: <FaComments />, text: "Real-time Chat alongside video" },
];

export default function Login() {
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const toast = useToast();
    const toastRef = useRef(toast);
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const { handleLogin } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    // Show success flash if redirected from Register or error if from ProtectedRoute
    useEffect(() => {
        if (location.state?.successMessage) {
            const msg = location.state.successMessage;
            // Only clear the successMessage, preserve the 'from' state if it exists
            const nextState = { ...location.state };
            delete nextState.successMessage;
            navigate(location.pathname, { replace: true, state: nextState });
            toastRef.current.success(msg);
        } else if (location.state?.error) {
            const msg = location.state.error;
            const nextState = { ...location.state };
            delete nextState.error;
            navigate(location.pathname, { replace: true, state: nextState });
            toastRef.current.warning(msg);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Login handler — logic unchanged ─────────────────── */
    const handleAuthLogin = async () => {
        try {
            setLoading(true);
            await handleLogin(email, password);
            toast.success("Welcome back! Login successful.");
            const redirectTarget = location.state?.from || "/home";
            navigate(redirectTarget);
        } catch (err) {
            const errorMsg = err.response?.data?.message || "Login failed. Please check your credentials.";
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // Allow Enter key to submit
    const onKeyDown = (e) => { if (e.key === "Enter") handleAuthLogin(); };

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
                        Your team is<br />waiting. <span className="hl">Join them.</span>
                    </h2>
                    <p>
                        MeetVerse brings enterprise-grade video conferencing to everyone —
                        free, secure, and effortlessly easy.
                    </p>

                    {/* Feature bullets */}
                    <div className="auth-features">
                        {brandFeatures.map((f, i) => (
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

                    {/* Mini meeting mockup */}
                    <motion.div
                        className="auth-mockup"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <div className="auth-mockup-header">
                            <div className="auth-mockup-dot" />
                            Live Meeting • 3 participants
                        </div>
                        <div className="auth-mockup-controls">
                            <div className="auth-ctrl"><FaMicrophone /> Mic On</div>
                            <div className="auth-ctrl"><FaVideo /> Cam On</div>
                            <div className="auth-ctrl"><FaDesktop /> Sharing</div>
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
                        <h2>Welcome back </h2>
                        <p>Sign in to continue your conversations</p>
                    </div>

                    {/* Email */}
                    <div className="input-group">
                        <label htmlFor="email">Email Address</label>
                        <div className="input-wrapper">
                            <FaAt className="input-icon" />
                            <input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={onKeyDown}
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <div className="input-wrapper">
                            <FaLock className="input-icon" />
                            <input
                                id="password"
                                type={showPass ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={onKeyDown}
                                autoComplete="current-password"
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

                    {/* Options row */}
                    <div className="auth-options">
                        <label className="remember-me">
                            <input type="checkbox" /> Remember me
                        </label>
                        <Link to="/forgetPassword" className="forgot-link">Forgot password?</Link>
                    </div>

                    {/* Submit */}
                    <motion.button
                        className="auth-submit-btn"
                        onClick={handleAuthLogin}
                        disabled={loading}
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.01 }}
                    >
                        {loading ? <span className="btn-spinner" /> : null}
                        {loading ? "Signing in..." : "Sign In"}
                    </motion.button>

                    <div className="auth-divider">OR</div>

                    {/* Social */}
                    {/* <button type="button" className="social-btn">
                        <FaGoogle /> Continue with Google
                    </button>
                    <button type="button" className="social-btn">
                        <FaGithub /> Continue with GitHub
                    </button> */}

                    <div className="auth-footer-link">
                        Don&apos;t have an account?{" "}
                        <Link to="/register">Create one free</Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}