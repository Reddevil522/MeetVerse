/**
 * Home.jsx — Premium Dashboard Page
 * Collapsible sidebar + main content grid layout.
 * All API calls, auth logic, navigation unchanged.
 */
import { useContext, useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import ThemeToggle from "../components/ThemeToggle";
import {
    FaVideo, FaKeyboard, FaCalendarAlt, FaBell, FaSignOutAlt,
    FaHistory, FaClock, FaUsers, FaChevronLeft, FaChevronRight,
    FaTachometerAlt, FaCog, FaLink, FaTrash,
} from "react-icons/fa";
import { server_url } from "../config";
import "../public/CSS/Home.css";

/* ── Sidebar navigation config ──────────────────────────── */
const sidebarNav = [
    { icon: <FaTachometerAlt />, label: "Dashboard", key: "dashboard" },
    { icon: <FaVideo />, label: "Meetings", key: "meetings" },
    { icon: <FaHistory />, label: "History", key: "history" },
    { icon: <FaUsers />, label: "Contacts", key: "contacts" },
    { icon: <FaCog />, label: "Settings", key: "settings" },
];

/* ── Clock hook ─────────────────────────────────────────── */
function useClock() {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return time;
}

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function Home() {
    const { userData, handleLogout } = useContext(AuthContext);
    const navigate = useNavigate();
    const toast = useToast();
    const toastRef = useRef(toast);
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);
    const now = useClock();

    const [joinCode, setJoinCode] = useState("");
    const [meetingHistory, setMeetingHistory] = useState([]);
    const [stats, setStats] = useState({ total: 0, hours: 0, participants: 0 });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeNav, setActiveNav] = useState("dashboard");

    /* ── Fetch meeting history ──────────────────────────────── */
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;

                const response = await fetch(`${server_url}/api/v1/meetings/history`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();

                if (data.success) {
                    setMeetingHistory(data.meetings);

                    // Calculate real stats from user data
                    const totalMeetings = data.meetings.length;

                    // Sum real duration (assuming duration is in minutes), fallback to 0 if none
                    const totalMinutes = data.meetings.reduce((acc, m) => acc + (m.duration || 0), 0);
                    const hours = Math.round(totalMinutes / 60);

                    // Count unique participants across all meetings
                    const uniqueParticipants = new Set();
                    data.meetings.forEach(m => {
                        if (m.participants) {
                            m.participants.forEach(p => uniqueParticipants.add(p._id?.toString() || p.toString()));
                        }
                    });

                    setStats({
                        total: totalMeetings,
                        hours: hours,
                        participants: uniqueParticipants.size,
                    });
                }
            } catch (error) {
                // Use ref so changing toast object doesn't re-trigger this effect
                toastRef.current.error("Failed to fetch meeting history: " + error.message);
            }
        };
        fetchHistory();
    }, []); // run once on mount — toastRef is stable

    /* ── Actions — logic unchanged ─────────────────────────── */
    const startNewMeeting = () => {
        const roomId = Math.random().toString(36).substring(2, 10);
        toast.success("Meeting created! Joining now...");
        navigate(`/${roomId}`);
    };

    const handleJoinMeeting = (e) => {
        e.preventDefault();
        if (joinCode.trim()) {
            toast.success("Joining meeting...");
            navigate(`/${joinCode.trim()}`);
        } else {
            toast.warning("Please enter a valid meeting code");
        }
    };

    const handleUserLogout = () => {
        navigate("/", { replace: true });
        setTimeout(() => {
            handleLogout();
            toast.success("Logged out successfully");
        }, 10);
    };

    const handleDeleteMeeting = async (meetingCode) => {
        // if (!window.confirm("Are you sure you want to remove this meeting from your history?")) return;
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const response = await fetch(`${server_url}/api/v1/meetings/history/${encodeURIComponent(meetingCode)}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            let data;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Server returned non-JSON response (${response.status}). ${text.substring(0, 50)}...`);
            }

            if (data.success) {
                setMeetingHistory(prev => prev.filter(m => m.meetingCode !== meetingCode));
                toast.success("Meeting removed from history");

                setStats(prev => ({
                    ...prev,
                    total: Math.max(0, prev.total - 1),
                }));
            } else {
                toast.error(data.message || "Failed to delete meeting");
            }
        } catch (error) {
            toast.error("Failed to delete meeting: " + error.message);
        }
    };

    /* ── Derived display values ─────────────────────────────── */
    const displayName = userData?.fullName || "User";
    const avatarLetter = displayName.charAt(0).toUpperCase();
    const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

    return (
        <div className="dashboard-shell">

            {/* ════════ SIDEBAR ════════ */}
            <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
                {/* Logo */}
                <Link to="/" className="sidebar-logo">
                    <FaVideo />
                    <span className="sidebar-logo-text">MeetVerse</span>
                </Link>

                {/* Collapse toggle */}
                <button
                    className="sidebar-toggle"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    aria-label="Toggle sidebar"
                >
                    {sidebarCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
                </button>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Navigation</div>
                    {sidebarNav.map((item) => (
                        <button
                            key={item.key}
                            className={`sidebar-item ${activeNav === item.key ? "active" : ""}`}
                            onClick={() => setActiveNav(item.key)}
                        >
                            <span className="s-icon">{item.icon}</span>
                            <span className="s-label">{item.label}</span>
                        </button>
                    ))}
                    {/* Mobile-only Logout Item */}
                    <button
                        className="sidebar-item mobile-only-logout"
                        onClick={handleUserLogout}
                        title="Logout"
                    >
                        <span className="s-icon"><FaSignOutAlt style={{ color: "var(--error)" }} /></span>
                        <span className="s-label" style={{ color: "var(--error)" }}>Logout</span>
                    </button>
                </nav>

                {/* User footer */}
                <div className="sidebar-footer">
                    <div className="topbar-user" onClick={handleUserLogout} title="Logout" style={{ width: "100%" }}>
                        <div className="topbar-avatar">{avatarLetter}</div>
                        <span className="topbar-uname" style={{ flex: 1 }}>{displayName}</span>
                        <FaSignOutAlt style={{ fontSize: "1rem", color: "var(--text-subtle)", marginLeft: "auto", flexShrink: 0 }} />
                    </div>
                </div>
            </aside>

            {/* ════════ MAIN ════════ */}
            <main className={`dashboard-main ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>

                {/* Top bar */}
                <header className="dashboard-topbar ">
                    <div className="topbar-greeting">
                        <h3>{greeting}, {displayName.split(" ")[0]} </h3>
                        <p>{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
                    </div>
                    <div className="topbar-right">
                        <span className="topbar-time">
                            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button className="icon-btn" aria-label="Notifications"><FaBell /></button>

                        <ThemeToggle />
                    </div>
                </header>

                {/* Content */}
                <div className="dashboard-content">

                    {/* ── Quick Actions ── */}
                    <motion.div
                        className="quick-actions"
                        initial="hidden"
                        animate="visible"
                        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
                    >
                        {/* New Meeting */}
                        <motion.div
                            className="quick-action-card qa-new"
                            onClick={startNewMeeting}
                            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                            whileHover={{ y: -4 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="qa-icon"><FaVideo /></div>
                            <div className="qa-title">New Meeting</div>
                            <div className="qa-desc">Start an instant meeting and invite others</div>
                        </motion.div>

                        {/* Join Meeting */}
                        <motion.div
                            className="quick-action-card qa-join"
                            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                        >
                            <div className="qa-icon"><FaKeyboard /></div>
                            <div className="qa-title">Join a Meeting</div>
                            <div className="qa-desc">Enter a code or link to join</div>
                            <form className="join-inline-form" onSubmit={handleJoinMeeting}>
                                <input
                                    className="join-code-input"
                                    type="text"
                                    placeholder="Enter code..."
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    aria-label="Meeting code"
                                />
                                <button
                                    className="join-code-btn"
                                    type="submit"
                                    disabled={!joinCode.trim()}
                                >
                                    Join
                                </button>
                            </form>
                        </motion.div>

                        {/* Schedule */}
                        <motion.div
                            className="quick-action-card qa-schedule"
                            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                            whileHover={{ y: -4 }}
                        >
                            <div className="qa-icon"><FaCalendarAlt /></div>
                            <div className="qa-title">Schedule</div>
                            <div className="qa-desc">Plan a meeting for later on Google Calendar</div>
                        </motion.div>
                    </motion.div>

                    {/* ── Statistics ── */}
                    <div className="stats-row">
                        {[
                            { cls: "si-meetings", icon: <FaHistory />, value: stats.total, label: "Total Meetings" },
                            { cls: "si-hours", icon: <FaClock />, value: `${stats.hours}h`, label: "Hours in Meetings" },
                            { cls: "si-people", icon: <FaUsers />, value: stats.participants, label: "Total Participants" },
                        ].map((s, i) => (
                            <motion.div
                                key={i}
                                className={`stat-item ${s.cls}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + i * 0.1 }}
                                whileHover={{ y: -2 }}
                            >
                                <div className="stat-item-icon">{s.icon}</div>
                                <div className="stat-item-info">
                                    <h4>{s.value}</h4>
                                    <p>{s.label}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Recent Meetings ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="section-heading">
                            <h2>Recent Meetings</h2>
                            <span className="section-heading-badge">{meetingHistory.length} meetings total</span>
                        </div>

                        <div className="meetings-list-container">
                            <AnimatePresence mode="wait">
                                {meetingHistory.length === 0 ? (
                                    <motion.div
                                        className="meetings-empty"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        key="empty"
                                    >
                                        <div className="meetings-empty-icon"><FaVideo /></div>
                                        <h3>No meetings yet</h3>
                                        <p>
                                            Start a new meeting or join one to see your history here.
                                        </p>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="list"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        {meetingHistory.map((meeting) => {
                                            const displayCode = meeting.meetingCode.startsWith('/')
                                                ? meeting.meetingCode.substring(1)
                                                : meeting.meetingCode;

                                            return (
                                                <div key={meeting._id} className="meeting-row">
                                                    <div className="meeting-row-left">
                                                        <div className="meeting-row-icon"><FaLink /></div>
                                                        <div>
                                                            <div className="meeting-row-code">{displayCode}</div>
                                                            <div className="meeting-row-date">
                                                                {new Date(meeting.createdAt).toLocaleString([], {
                                                                    dateStyle: "medium",
                                                                    timeStyle: "short",
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="meeting-row-actions" style={{ display: "flex", gap: "8px" }}>
                                                        <button
                                                            className="rejoin-btn"
                                                            onClick={() => navigate(`/${displayCode}`)}
                                                        >
                                                            Rejoin
                                                        </button>
                                                        <button
                                                            className="delete-meeting-btn"
                                                            onClick={() => handleDeleteMeeting(meeting.meetingCode)}
                                                            title="Remove from history"
                                                            style={{
                                                                background: "rgba(239, 68, 68, 0.1)",
                                                                color: "#ef4444",
                                                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                                                borderRadius: "var(--radius-sm)",
                                                                width: "36px",
                                                                height: "36px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                cursor: "pointer",
                                                                transition: "all 0.2s"
                                                            }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; e.currentTarget.style.transform = "scale(1.05)"; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; e.currentTarget.style.transform = "scale(1)"; }}
                                                        >
                                                            <FaTrash size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                </div>
            </main>
        </div>
    );
}
