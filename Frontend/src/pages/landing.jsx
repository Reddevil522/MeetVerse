/**
 * landing.jsx — Premium Landing Page
 * Design inspired by Google Meet, Notion, and Linear.
 * All existing logic preserved: navigation, toast, auth state.
 */

import { useState, useEffect, useRef } from 'react';
import "../public/CSS/LandingPage.css";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import ThemeToggle from "../components/ThemeToggle";
import {
    FaBars, FaTimes, FaVideo, FaMicrophone, FaDesktop,
    FaComments, FaRecordVinyl, FaLock, FaUsers, FaHistory,
    FaGithub, FaLinkedin, FaTwitter, FaStar, FaArrowRight,
    FaPhoneSlash, FaGlobe, FaEnvelope,
} from "react-icons/fa";

/* ── Static Data ───────────────────────────────────────────── */

const features = [
    { icon: <FaVideo />, title: "HD Video Calling", desc: "Crystal-clear 1080p video meetings with ultra-low latency for seamless remote collaboration." },
    { icon: <FaMicrophone />, title: "Crystal Clear Audio", desc: "AI-powered noise cancellation keeps conversations crisp even in noisy environments." },
    { icon: <FaDesktop />, title: "Screen Sharing", desc: "Share your full screen, a window, or a browser tab instantly with one click." },
    { icon: <FaComments />, title: "Live Chat", desc: "Real-time messaging alongside your video calls with emoji and file support." },
    { icon: <FaRecordVinyl />, title: "Meeting Recording", desc: "Record sessions securely to the cloud with automatic transcripts available after." },
    { icon: <FaLock />, title: "Secure & Private", desc: "End-to-end encryption and JWT authentication keeps every meeting protected." },
    { icon: <FaUsers />, title: "Team Collaboration", desc: "Built for teams of all sizes — from startups to enterprises — with unlimited participants." },
    { icon: <FaHistory />, title: "Meeting History", desc: "Access past meetings, chat logs, and re-join previous rooms from your dashboard." },
];

const stats = [
    { target: 500000, suffix: "+", label: "Active Users" },
    { target: 1200000, suffix: "+", label: "Meetings Hosted" },
    { target: 120, suffix: "+", label: "Countries Served" },
    { target: 50, suffix: "M+", label: "Messages Sent" },
];

const testimonials = [
    {
        name: "David Smith",
        role: "Software Engineer, Google",
        review: "This platform is a game-changer. Video quality is unmatched and the latency is incredibly low — comparable to being in the same room.",
        initials: "DS",
    },
    {
        name: "Jessica Taylor",
        role: "Product Manager, Stripe",
        review: "We switched from Zoom for all our team standups. The screen sharing is flawless and the chat panel is super intuitive.",
        initials: "JT",
    },
    {
        name: "Michael Chen",
        role: "Educator, Stanford",
        review: "Perfect for online classes. The secure authentication gives me full confidence in student privacy during sessions.",
        initials: "MC",
    },
];

/* ── Animated Counter Hook ─────────────────────────────────── */
function useCounter(target, duration = 2000, start = false) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime = null;
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
            else setCount(target);
        };
        requestAnimationFrame(step);
    }, [target, duration, start]);
    return count;
}

/* ── Individual Stat Item ──────────────────────────────────── */
function StatItem({ target, suffix, label }) {
    const [inView, setInView] = useState(false);
    const ref = useRef(null);
    const count = useCounter(target, 2000, inView);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setInView(true); },
            { threshold: 0.4 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    // Format with K/M for readability
    const formatted = count >= 1_000_000
        ? (count / 1_000_000).toFixed(1) + "M"
        : count >= 1_000
            ? (count / 1_000).toFixed(0) + "K"
            : count;

    return (
        <motion.div ref={ref} className="stat-card" whileHover={{ y: -4 }}>
            <div className="stat-number">{formatted}{suffix}</div>
            <div className="stat-label">{label}</div>
        </motion.div>
    );
}

/* ── Fade-up animation variant ─────────────────────────────── */
const fadeUp = {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] } },
};

const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    const toastRef = useRef(toast);
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    // Show error toast from router state (e.g., redirect from protected route)
    // Using a ref for toast prevents this firing again when toast object identity changes.
    useEffect(() => {
        if (location.state?.error) {
            const msg = location.state.error;
            // Clear state immediately so a re-render doesn't re-fire
            navigate(location.pathname, { replace: true, state: {} });
            toastRef.current.error(msg);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run only on mount — the state won't change after clear

    // Navbar scroll effect
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const handleStartMeeting = () => navigate("/home");

    return (
        <div className="landing">
            {/* Ambient background blobs */}
            <div className="blob blob1" />
            <div className="blob blob2" />
            <div className="blob blob3" />

            {/* ════════ NAVBAR ════════ */}
            <nav className={`lp-navbar ${scrolled ? "scrolled" : ""}`}>
                <Link to="/" className="lp-logo">
                    <FaVideo />
                    MeetVerse
                </Link>

                {/* Desktop nav links */}
                <ul className="lp-nav-links">
                    <li><a href="#home">Home</a></li>
                    <li><a href="#features">Features</a></li>
                    <li><a href="#how-it-works">How It Works</a></li>
                    <li><a href="#testimonials">Testimonials</a></li>
                </ul>

                {/* Desktop CTA */}
                <div className="lp-nav-actions">
                    <Link to="/login"><button className="btn-ghost">Login</button></Link>
                    <Link to="/register"><button className="btn-gradient">Register</button></Link>
                    <ThemeToggle />
                </div>

                {/* Mobile hamburger */}
                <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
                    {menuOpen ? <FaTimes /> : <FaBars />}
                </button>
            </nav>

            {/* Mobile drawer */}
            <div className={`mobile-nav-drawer ${menuOpen ? "open" : ""}`}>
                <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
                <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
                <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
                <a href="#testimonials" onClick={() => setMenuOpen(false)}>Testimonials</a>
                <div className="mobile-nav-divider" />
                <div className="mobile-nav-actions" style={{ alignItems: "center" }}>
                    <Link to="/login" style={{ flex: 1 }}><button className="btn-ghost" style={{ width: "100%" }}>Login</button></Link>
                    <Link to="/register" style={{ flex: 1 }}><button className="btn-gradient" style={{ width: "100%", justifyContent: "center" }}>Register</button></Link>
                    <ThemeToggle />
                </div>
            </div>

            {/* ════════ HERO ════════ */}
            <section className="lp-hero" id="home">
                {/* Left — Content */}
                <motion.div
                    className="lp-hero-content"
                    initial="hidden"
                    animate="visible"
                    variants={stagger}
                >
                    <motion.div className="lp-hero-badge" variants={fadeUp}>
                        <span className="badge-dot" />
                        ⚡ The Future of Video Conferencing
                    </motion.div>

                    <motion.h1 variants={fadeUp}>
                        Connect, Collaborate &{" "}
                        <span className="gradient-text">Meet Anywhere</span>
                    </motion.h1>

                    <motion.p variants={fadeUp}>
                        Secure, high-quality video meetings for teams, students, businesses and communities.
                        Experience the ultimate collaboration tool — simple, fast, and free.
                    </motion.p>

                    <motion.div className="lp-hero-buttons" variants={fadeUp}>
                        <button className="btn-gradient btn-large" onClick={handleStartMeeting}>
                            Start a Meeting <FaArrowRight />
                        </button>
                        <button className="btn-outline-lg" onClick={() => navigate("/home")}>
                            Join Meeting
                        </button>
                    </motion.div>

                    <motion.div className="lp-hero-social" variants={fadeUp}>
                        <div className="lp-hero-avatars">
                            <div className="av av-a" />
                            <div className="av av-b" />
                            <div className="av av-c" />
                        </div>
                        <span>Trusted by <strong>500K+</strong> professionals worldwide</span>
                    </motion.div>
                </motion.div>

                {/* Right — Floating Video Mockup */}
                <motion.div
                    className="lp-hero-mockup"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0, transition: { duration: 0.7, delay: 0.2 } }}
                >
                    <motion.div animate={{ y: [0, -14, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
                        <div className="hero-video-card">
                            {/* Top bar */}
                            <div className="hvc-topbar">
                                <div className="hvc-live-badge">
                                    <span className="hvc-live-dot" />
                                    3 participants online
                                </div>
                                <div className="hvc-participants">
                                    <div className="hvc-avatars">
                                        <div className="hvc-av hvc-av-a">DS</div>
                                        <div className="hvc-av hvc-av-b">JT</div>
                                        <div className="hvc-av hvc-av-c">MC</div>
                                    </div>
                                    <span className="hvc-part-count">+2 more</span>
                                </div>
                            </div>

                            {/* Video grid */}
                            <div className="hvc-video-grid">
                                <div className="hvc-tile hvc-tile-main">
                                    <div className="hvc-tile-avatar hvc-av-main">DS</div>
                                    <div className="hvc-tile-name">David S. · Host</div>
                                </div>
                                <div className="hvc-tile">
                                    <div className="hvc-tile-avatar hvc-av-blue">JT</div>
                                    <div className="hvc-mic-off"><FaTimes style={{ fontSize: 7 }} /></div>
                                    <div className="hvc-tile-name">Jessica T.</div>
                                </div>
                                <div className="hvc-tile">
                                    <div className="hvc-tile-avatar hvc-av-pink">MC</div>
                                    <div className="hvc-tile-name">Michael C.</div>
                                </div>
                            </div>

                            {/* Info row */}
                            <div className="hvc-info">
                                <div>
                                    <div className="hvc-meeting-title">Premium Video Interface</div>
                                    <div className="hvc-meeting-meta">32:14 · End-to-end encrypted · meetverse.io</div>
                                </div>
                                <div className="hvc-hd-badge">
                                    <span className="hvc-hd-dot" />
                                    1080p HD
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="hvc-controls">
                                <button className="hvc-btn"><FaMicrophone /></button>
                                <button className="hvc-btn"><FaVideo /></button>
                                <button className="hvc-btn hvc-btn-muted"><FaDesktop /></button>
                                <button className="hvc-btn hvc-btn-end"><FaPhoneSlash /></button>
                                <button className="hvc-btn hvc-btn-muted"><FaComments /></button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* ════════ FEATURES ════════ */}
            <section className="lp-section" id="features">
                <motion.div
                    className="section-header-center"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={stagger}
                >
                    <motion.span className="section-label" variants={fadeUp}>Features</motion.span>
                    <motion.h2 className="section-title" variants={fadeUp}>Everything you need to connect</motion.h2>
                    <motion.p className="section-sub" variants={fadeUp}>
                        Purpose-built tools for modern communication — from one-on-one calls to team meetings.
                    </motion.p>
                </motion.div>

                <motion.div
                    className="lp-features-grid"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    variants={stagger}
                >
                    {features.map((item, i) => (
                        <motion.div key={i} className="feature-card" variants={fadeUp} whileHover={{ y: -6, scale: 1.01 }}>
                            <div className="feature-icon-wrap">{item.icon}</div>
                            <h3>{item.title}</h3>
                            <p>{item.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ════════ STATISTICS ════════ */}
            <div className="lp-stats-section">
                <div className="stats-grid">
                    {stats.map((s, i) => (
                        <StatItem key={i} target={s.target} suffix={s.suffix} label={s.label} />
                    ))}
                </div>
            </div>

            {/* ════════ HOW IT WORKS ════════ */}
            <section className="lp-section" id="how-it-works">
                <div className="how-grid">
                    {/* Steps */}
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-60px" }}
                        variants={stagger}
                    >
                        <motion.span className="section-label" variants={fadeUp}>Process</motion.span>
                        <motion.h2 className="section-title" variants={fadeUp}>Get started in minutes</motion.h2>

                        <div className="steps-list" style={{ marginTop: 32 }}>
                            {[
                                { n: "01", t: "Create Account", d: "Sign up in seconds with your email. No credit card required." },
                                { n: "02", t: "Start a Meeting", d: "Generate a secure, unique meeting link instantly from your dashboard." },
                                { n: "03", t: "Share the Link", d: "Send the invitation to participants via email, chat, or SMS." },
                                { n: "04", t: "Collaborate Live", d: "Join the room to start video, screen sharing, and messaging." },
                            ].map((step) => (
                                <motion.div key={step.n} className="step-item" variants={fadeUp}>
                                    <div className="step-num">{step.n}</div>
                                    <div className="step-content">
                                        <h3>{step.t}</h3>
                                        <p>{step.d}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Right stat card */}
                    <motion.div
                        className="how-stat-card"
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        whileHover={{ scale: 1.02 }}
                    >
                        <div className="big-num">99.9%</div>
                        <div className="big-label">Uptime Reliability</div>
                        <div className="divider" />
                        <div className="big-num" style={{ color: "#10B981" }}>1M+</div>
                        <div className="big-label">Meetings Hosted</div>
                        <div className="divider" />
                        <div className="big-num" style={{ color: "#A855F7" }}>&lt;50ms</div>
                        <div className="big-label">Average Latency</div>
                    </motion.div>
                </div>
            </section>

            {/* ════════ TESTIMONIALS ════════ */}
            <section className="lp-section" id="testimonials">
                <motion.div
                    className="section-header-center"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                    variants={stagger}
                >
                    <motion.span className="section-label" variants={fadeUp}>Testimonials</motion.span>
                    <motion.h2 className="section-title" variants={fadeUp}>Loved by professionals</motion.h2>
                </motion.div>

                <motion.div
                    className="testimonial-grid"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-40px" }}
                    variants={stagger}
                >
                    {testimonials.map((t, i) => (
                        <motion.div key={i} className="testimonial-card" variants={fadeUp} whileHover={{ y: -8 }}>
                            <div className="testimonial-stars">
                                {[...Array(5)].map((_, si) => <FaStar key={si} />)}
                            </div>
                            <p className="testimonial-quote">"{t.review}"</p>
                            <div className="testimonial-author">
                                <div className="t-avatar">{t.initials}</div>
                                <div>
                                    <div className="t-name">{t.name}</div>
                                    <div className="t-role">{t.role}</div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ════════ CTA ════════ */}
            <div className="lp-cta">
                <motion.div
                    className="cta-card"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    whileHover={{ scale: 1.01 }}
                >
                    <h2>Ready to host your first meeting?</h2>
                    <p>Join thousands of professionals already collaborating on our platform.</p>
                    <div className="cta-buttons">
                        <Link to="/register">
                            <button className="btn-gradient btn-large">Get Started Free <FaArrowRight /></button>
                        </Link>
                        <button className="btn-outline-lg" onClick={handleStartMeeting}>
                            Join a Meeting
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* ════════ FOOTER ════════ */}
            <footer className="lp-footer" id="contact">

                {/* ── Newsletter Bar ── */}
                <div className="footer-newsletter">
                    <div className="footer-newsletter-text">
                        <span className="footer-newsletter-label">Stay in the loop</span>
                        <p>Get product updates, tips, and early access to new features.</p>
                    </div>
                    <form className="footer-newsletter-form" onSubmit={e => e.preventDefault()}>
                        <div className="footer-newsletter-input-wrap">
                            <FaEnvelope className="footer-newsletter-icon" />
                            <input type="email" placeholder="Enter your email address" />
                        </div>
                        <button type="submit" className="btn-gradient">Subscribe</button>
                    </form>
                </div>

                {/* ── Divider ── */}
                <div className="footer-divider" />

                {/* ── Main Grid ── */}
                <div className="footer-grid">
                    {/* Brand */}
                    <div className="footer-brand-col">
                        <div className="footer-brand-name"><FaVideo />MeetVerse</div>
                        <p className="footer-brand-desc">
                            Modern video conferencing built for teams, students, and businesses worldwide. Simple, fast, and free.
                        </p>
                        {/* Status badge */}
                        <div className="footer-status-badge">
                            <span className="footer-status-dot" />
                            All systems operational
                        </div>
                        <div className="footer-socials">
                            <a href="#" className="social-icon" aria-label="GitHub"><FaGithub /></a>
                            <a href="#" className="social-icon" aria-label="LinkedIn"><FaLinkedin /></a>
                            <a href="#" className="social-icon" aria-label="Twitter"><FaTwitter /></a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="footer-col">
                        <h4>Product</h4>
                        <a href="#home">Home</a>
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How It Works</a>
                        <a href="#testimonials">Testimonials</a>
                    </div>

                    {/* Company */}
                    <div className="footer-col">
                        <h4>Company</h4>
                        <a href="#">About</a>
                        <a href="#">Blog</a>
                        <a href="#">Careers</a>
                        <a href="#">Press Kit</a>
                    </div>

                    {/* Legal & Contact */}
                    <div className="footer-col">
                        <h4>Legal</h4>
                        <a href="#"><FaEnvelope className="footer-link-icon" />support@meetverse.io</a>
                        <a href="#"><FaGlobe className="footer-link-icon" />meetverse.io</a>
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                    </div>
                </div>

                {/* ── Bottom Bar ── */}
                <div className="footer-bottom">
                    <span className="footer-bottom-copy">© 2026 Gopal Kumar. All rights reserved.</span>
                    <div className="footer-bottom-links">
                        <a href="#">Privacy</a>
                        <a href="#">Terms</a>
                        <a href="#">Cookies</a>
                    </div>
                    <span className="footer-bottom-love">Built with ❤️ for the future of work</span>
                </div>
            </footer>
        </div>
    );
}
