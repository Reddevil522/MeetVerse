import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
    FaComments,
    FaVideo,
    FaUsers,
    FaShieldAlt,
    FaCircle
} from "react-icons/fa";

export default function AuthIllustration() {
    return (
        <div className="auth-left">

            <motion.div
                // className="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >

                <Link to="/" className="logo">
                    <FaComments />
                    ChatVerse
                </Link>
            </motion.div>

            <motion.h1
                initial={{ y: 40 }}
                animate={{ y: 0 }}
            >
                Connect With Anyone, Anytime
            </motion.h1>

            <p>
                Secure messaging, instant communication,
                and seamless collaboration.
            </p>

            <div className="feature-list">
                <div><FaComments /> Real-Time Messaging</div>
                <div><FaVideo /> HD Video Calls</div>
                <div><FaUsers /> Group Conversations</div>
                <div><FaShieldAlt /> End-to-End Security</div>
            </div>

            <motion.div
                className="mockup-container"
                animate={{
                    y: [0, -12, 0]
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity
                }}
            >

                <div className="chat-window glass">
                    <div className="chat-header">
                        <FaCircle className="online" />
                        Sarah Online
                    </div>

                    <div className="bubble left">
                        Hey 👋
                    </div>

                    <div className="bubble right">
                        Let's meet today
                    </div>

                    <div className="typing">
                        <span />
                        <span />
                        <span />
                    </div>
                </div>

                <div className="video-card glass">
                    <FaVideo />
                    HD Video Call
                </div>

                <div className="group-card glass">
                    Team Discussion
                </div>

            </motion.div>
        </div>
    );
}