import { useRef, useState, useEffect, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import {
    FaMicrophone, FaMicrophoneSlash,
    FaVideo, FaVideoSlash,
    FaPhoneSlash, FaDesktop,
    FaComments, FaTimes,
    FaUsers, FaCopy, FaLink, FaPaperPlane,
    FaExpand, FaCompress,
} from "react-icons/fa";
import { io } from "socket.io-client";
import ThemeToggle from "../components/ThemeToggle";
import CameraOffPlaceholder from "../components/CameraOffPlaceholder";
import "../public/CSS/VideoCall.css";
import "../public/CSS/WaitingRoom.css";
import server_url from "../environment.js";

let connections = {};

const peerConfigConnections = {
    iceServers: [
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
    ]
};

const MEDIA_ACQUIRE_TIMEOUT_MS = 4000;

const acquireMediaWithTimeout = (constraints, timeoutMs = MEDIA_ACQUIRE_TIMEOUT_MS) => {
    if (!navigator.mediaDevices?.getUserMedia) {
        return Promise.reject(new Error("MediaDevices API not available"));
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Media acquisition timeout"));
        }, timeoutMs);
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => { clearTimeout(timer); resolve(stream); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
};

const requestElementFullscreen = (el) => {
    if (!el) return Promise.resolve();
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!fn) return Promise.reject(new Error("Fullscreen API not supported"));
    const result = fn.call(el);
    return result && typeof result.then === "function" ? result : Promise.resolve();
};

const exitDocumentFullscreen = () => {
    const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (!fn) return Promise.resolve();
    const result = fn.call(document);
    return result && typeof result.then === "function" ? result : Promise.resolve();
};

const getFullscreenElement = () =>
    document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;

// ── FIX 1: RemoteVideo — stable ref + immediate attach on mount ──────────────
function RemoteVideo({ item, index, participantNames, status, tileRef, onFullscreen, isFullscreenActive, isHostTile }) {
    const ref = useRef(null);

    // FIX: attach stream when it changes
    useEffect(() => {
        if (!item.stream) return;
        const el = ref.current;
        if (!el) return;
        if (el.srcObject !== item.stream) {
            el.srcObject = item.stream;
            el.play().catch(() => { });
        }
    }, [item.stream]);

    // FIX: also attach immediately when the element mounts
    const setRef = useCallback((el) => {
        ref.current = el;
        if (el && item.stream) {
            el.srcObject = item.stream;
            el.play().catch(() => { });
        }
    }, [item.stream]);

    const displayName = participantNames[item.id] || `Participant ${index + 1}`;
    const hasVideoTrack = item.stream && item.stream.getVideoTracks().length > 0;
    const isMuted = status?.isMuted;
    const isVideoOff = status?.isVideoOff || !hasVideoTrack;

    return (
        <div className="vc-tile" ref={tileRef} data-tile-id={item.id}>
            {isHostTile && <div className="vc-tile-host-badge">HOST</div>}
            <video
                ref={setRef}
                autoPlay
                playsInline
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: isVideoOff ? "none" : "block",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 1,
                }}
            />
            {isVideoOff && <CameraOffPlaceholder participantName={displayName} />}
            <div className="vc-tile-name" style={{ display: "flex", alignItems: "center", zIndex: 3 }}>
                {displayName}
                {isMuted && (
                    <span style={{ marginLeft: "6px", color: "#ef4444", display: "flex" }}>
                        <FaMicrophoneSlash size={12} />
                    </span>
                )}
            </div>
            <button
                type="button"
                className="vc-fullscreen-btn"
                onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
                title={isFullscreenActive ? "Exit fullscreen" : "Fullscreen"}
                aria-label={isFullscreenActive ? "Exit fullscreen" : "Enter fullscreen"}
            >
                {isFullscreenActive ? <FaCompress size={13} /> : <FaExpand size={13} />}
            </button>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function VideoCall() {
    const navigate = useNavigate();
    const { userData } = useContext(AuthContext);
    const toast = useToast();

    const socketRef = useRef(null);
    const socketIdRef = useRef(null);
    const localVideoRef = useRef(null);
    const lobbyVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const chatMessagesRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const hasAutoJoinedRef = useRef(false);
    const joinCallRef = useRef(null);
    const isHostRef = useRef(false);
    const mediaCheckPromiseRef = useRef(null);
    const tileRefs = useRef({});

    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [video, setVideo] = useState(false);
    const [audio, setAudio] = useState(false);
    const [screen, setScreen] = useState(false);
    const [showModal, setModal] = useState(false);
    const showModalRef = useRef(showModal);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [mediaError, setMediaError] = useState("");
    const [videos, setVideos] = useState([]);
    const [participantCount, setParticipantCount] = useState(0);
    const [typingUsers, setTypingUsers] = useState([]);
    const [participantNames, setParticipantNames] = useState({});
    const [participantStatuses, setParticipantStatuses] = useState({});
    const [permissionsChecked, setPermissionsChecked] = useState(false);

    const [waitingRoomStatus, setWaitingRoomStatus] = useState("none");
    const [isHost, setIsHost] = useState(false);
    const [hostSocketId, setHostSocketId] = useState(null);
    const [waitingUsers, setWaitingUsers] = useState([]);
    const [meetingLocked, setMeetingLocked] = useState(false);
    const [autoApprove, setAutoApprove] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [showHostDashboard, setShowHostDashboard] = useState(true);

    const [focusedId, setFocusedId] = useState(null);
    const [fullscreenTileId, setFullscreenTileId] = useState(null);

    useEffect(() => {
        if (userData?.fullName) {
            setUsername(userData.fullName);
        }
    }, [userData]);

    useEffect(() => { showModalRef.current = showModal; }, [showModal]);
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);

    useEffect(() => {
        connections = {};
    }, []);

    const attachLocalStream = useCallback((stream, attempt = 0) => {
        if (!stream) {
            console.warn("attachLocalStream: stream is null");
            return;
        }

        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        console.log(`attachLocalStream attempt ${attempt} — video:${videoTracks.length} audio:${audioTracks.length}`);

        const el = localVideoRef.current;
        if (el) {
            if (el.srcObject) el.srcObject = null;
            el.srcObject = stream;
            el.muted = true;
            el.play().catch((err) => console.warn("Local video play failed:", err));
            console.log("Local stream attached ✅");
            return;
        }

        if (attempt < 60) {
            requestAnimationFrame(() => attachLocalStream(stream, attempt + 1));
        } else {
            console.error("attachLocalStream: video element never appeared after 60 attempts");
        }
    }, []);

    useEffect(() => {
        if (navigator.mediaDevices?.getDisplayMedia) {
            setScreenAvailable(true);
        }

        const checkMedia = async () => {
            console.time("Media Init");
            const optimalConstraints = {
                video: { width: 640, height: 480, frameRate: 15 },
                audio: true
            };
            try {
                const stream = await acquireMediaWithTimeout(optimalConstraints);
                setVideoAvailable(true);
                setAudioAvailable(true);
                localStreamRef.current = stream;
                if (lobbyVideoRef.current) {
                    lobbyVideoRef.current.srcObject = stream;
                }
            } catch (err) {
                if (err.name === "NotAllowedError" || err.message.includes("Permission denied")) {
                    setVideoAvailable(false);
                    setAudioAvailable(false);
                } else {
                    try {
                        const audioStream = await acquireMediaWithTimeout({ audio: true });
                        setVideoAvailable(false);
                        setAudioAvailable(true);
                        localStreamRef.current = audioStream;
                    } catch (audioErr) {
                        if (audioErr.name === "NotAllowedError") {
                            setVideoAvailable(false);
                            setAudioAvailable(false);
                        } else {
                            try {
                                const videoStream = await acquireMediaWithTimeout({ video: { width: 640, height: 480, frameRate: 15 } });
                                setVideoAvailable(true);
                                setAudioAvailable(false);
                                localStreamRef.current = videoStream;
                                if (lobbyVideoRef.current) {
                                    lobbyVideoRef.current.srcObject = videoStream;
                                }
                            } catch {
                                setVideoAvailable(false);
                                setAudioAvailable(false);
                            }
                        }
                    }
                }
            }
            setPermissionsChecked(true);
            console.timeEnd("Media Init");
        };

        mediaCheckPromiseRef.current = checkMedia();
    }, []);

    useEffect(() => {
        if (askForUsername && lobbyVideoRef.current && localStreamRef.current) {
            lobbyVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [askForUsername, videoAvailable]);

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (messages.length === 0) return;
        const roomPath = window.location.pathname;
        try {
            sessionStorage.setItem(`meeting_messages_${roomPath}`, JSON.stringify(messages));
        } catch { }
    }, [messages]);

    useEffect(() => {
        if (!askForUsername && waitingRoomStatus === "none") {
            attachLocalStream(localStreamRef.current);
        }
    }, [askForUsername, waitingRoomStatus, attachLocalStream]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const el = getFullscreenElement();
            setFullscreenTileId(el ? el.dataset?.tileId || null : null);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.addEventListener("MSFullscreenChange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
        };
    }, []);

    useEffect(() => {
        if (focusedId && focusedId !== "local" && !videos.some((v) => v.id === focusedId)) {
            setFocusedId(null);
        }
    }, [videos, focusedId]);

    useEffect(() => {
        return () => {
            if (getFullscreenElement()) {
                exitDocumentFullscreen().catch(() => { });
            }
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            Object.values(connections).forEach((pc) => pc.close());
            connections = {};
            socketRef.current?.disconnect();
        };
    }, []);

    const handleTileClick = useCallback((id) => {
        setFocusedId((prev) => (prev === id ? null : id));
    }, []);

    const exitFocusMode = useCallback((e) => {
        e?.stopPropagation();
        setFocusedId(null);
    }, []);

    const toggleTileFullscreen = useCallback((id) => {
        const el = tileRefs.current[id];
        if (!el) return;
        const current = getFullscreenElement();
        if (current === el) {
            exitDocumentFullscreen().catch((err) => console.error("Exit fullscreen failed:", err));
        } else {
            const proceed = () => requestElementFullscreen(el).catch((err) => {
                console.error("Fullscreen request failed:", err);
                toast?.error?.("Fullscreen isn't available right now.");
            });
            if (current) {
                exitDocumentFullscreen().then(proceed).catch(proceed);
            } else {
                proceed();
            }
        }
    }, [toast]);

    const handleTileDoubleClick = useCallback((e, id) => {
        e.stopPropagation();
        toggleTileFullscreen(id);
    }, [toggleTileFullscreen]);

    const getOrCreatePeerConnection = useCallback((id) => {
        if (connections[id]) return connections[id];

        const pc = new RTCPeerConnection(peerConfigConnections);
        connections[id] = pc;

        pc.onicecandidate = (e) => {
            if (e.candidate && socketRef.current) {
                socketRef.current.emit("signal", id, {
                    type: "ice-candidate",
                    candidate: e.candidate
                });
            }
        };

        pc.ontrack = (e) => {
            const [remoteStream] = e.streams;
            const streamToSave = new MediaStream(remoteStream.getTracks());
            setVideos((prev) => {
                const exists = prev.find((v) => v.id === id);
                if (exists) return prev.map((v) => v.id === id ? { ...v, stream: streamToSave } : v);
                return [...prev, { id, stream: streamToSave }];
            });
        };

        pc._negotiating = false;
        pc.onnegotiationneeded = async () => {
            if (pc._negotiating || pc.signalingState !== "stable") return;
            pc._negotiating = true;
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                if (socketRef.current) {
                    socketRef.current.emit("signal", id, { type: "offer", sdp: pc.localDescription });
                }
            } catch (err) {
                console.error("Renegotiation error:", err);
            } finally {
                pc._negotiating = false;
            }
        };

        const currentStream = localStreamRef.current;
        if (currentStream) {
            currentStream.getTracks().forEach((track) => {
                pc.addTrack(track, currentStream);
            });
        }

        return pc;
    }, []);

    const handleUserJoined = useCallback(async (joinedId, allIds) => {
        setParticipantCount(allIds.length);
        if (joinedId === socketIdRef.current) return;
        const pc = getOrCreatePeerConnection(joinedId);
        if (pc._negotiating || pc.signalingState !== "stable") return;
        pc._negotiating = true;
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit("signal", joinedId, { type: "offer", sdp: pc.localDescription });
        } catch (err) {
            console.error("Error creating offer:", err);
        } finally {
            pc._negotiating = false;
        }
    }, [getOrCreatePeerConnection]);

    const handleSignal = useCallback(async (fromId, signal) => {
        if (signal.type === "is-host") {
            setHostSocketId(fromId);
            return;
        }

        const pc = getOrCreatePeerConnection(fromId);
        if (signal.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current.emit("signal", fromId, { type: "answer", sdp: pc.localDescription });
        } else if (signal.type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === "ice-candidate") {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
                console.error("ICE candidate error:", err);
            }
        }
    }, [getOrCreatePeerConnection]);

    const handleUserLeft = useCallback((leftId) => {
        if (connections[leftId]) {
            connections[leftId].close();
            delete connections[leftId];
        }
        setVideos((prev) => prev.filter((v) => v.id !== leftId));
        setParticipantCount((n) => Math.max(0, n - 1));
        delete tileRefs.current[leftId];
        if (hostSocketId === leftId) setHostSocketId(null);
    }, [hostSocketId]);

    const approveUser = useCallback((targetSocketId) => {
        socketRef.current?.emit("approve-user", window.location.pathname, targetSocketId);
    }, []);

    const rejectUser = useCallback((targetSocketId) => {
        socketRef.current?.emit("reject-user", window.location.pathname, targetSocketId);
    }, []);

    const admitAll = useCallback(() => {
        socketRef.current?.emit("admit-all", window.location.pathname);
    }, []);

    const toggleLock = useCallback(() => {
        socketRef.current?.emit(meetingLocked ? "unlock-meeting" : "lock-meeting", window.location.pathname);
    }, [meetingLocked]);

    const toggleAutoApproveStatus = useCallback(() => {
        socketRef.current?.emit("toggle-auto-approve", window.location.pathname, !autoApprove);
    }, [autoApprove]);

    const removeParticipant = useCallback((targetSocketId) => {
        socketRef.current?.emit("remove-participant", window.location.pathname, targetSocketId);
    }, []);

    const activeUsernameRef = useRef("");
    useEffect(() => { activeUsernameRef.current = username; }, [username]);

    const connectSocket = useCallback((roomPath, overrideUsername) => {
        const activeUsername = overrideUsername || activeUsernameRef.current;

        socketRef.current = io(server_url, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            timeout: 20000,
        });

        socketRef.current.on("connect_error", (err) => {
            console.error("SOCKET CONNECT ERROR:", err.message);
            if (
                err.message === "websocket error" ||
                err.message.includes("INTERNET") ||
                err.message.includes("timeout")
            ) {
                toast.error("Connection failed. Check your internet.");
            }
        });

        socketRef.current.on("reconnect_attempt", (attempt) => {
            if (attempt === 1) toast.info("Reconnecting to server...");
        });

        socketRef.current.on("reconnect", () => {
            toast.success("Reconnected successfully!");
        });

        socketRef.current.on("reconnect_failed", () => {
            toast.error("Could not connect. Please refresh the page.");
        });

        socketRef.current.on("connect", () => {
            socketIdRef.current = socketRef.current.id;

            let sessionId = sessionStorage.getItem("meetverse_session_id");
            if (!sessionId) {
                sessionId = Math.random().toString(36).substring(2, 15);
                sessionStorage.setItem("meetverse_session_id", sessionId);
            }

            socketRef.current.emit("join-request", {
                path: roomPath,
                username: activeUsername,
                userId: userData?._id || null,
                sessionId: sessionId
            });
        });

        socketRef.current.on("waiting-for-approval", () => {
            setWaitingRoomStatus("waiting");
            setAskForUsername(false);
        });

        socketRef.current.on("join-rejected", ({ reason }) => {
            setWaitingRoomStatus("rejected");
            setRejectReason(
                reason === "meeting-locked"
                    ? "Meeting is locked by the host."
                    : "Your request was declined by the host."
            );
            setAskForUsername(false);
            sessionStorage.removeItem(`joined_meeting_${roomPath}`);
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
        });

        socketRef.current.on("join-approved", ({ isHost: approvedAsHost, participants }) => {
            setIsHost(approvedAsHost);
            isHostRef.current = approvedAsHost;
            if (approvedAsHost) {
                setHostSocketId(socketIdRef.current);
                if (Array.isArray(participants)) {
                    participants.forEach(p => {
                        if (p.socketId !== socketIdRef.current) {
                            socketRef.current.emit("signal", p.socketId, { type: "is-host" });
                        }
                    });
                }
            }
            
            setWaitingRoomStatus("none");
            setAskForUsername(false);
            if (Array.isArray(participants)) setParticipantCount(participants.length);

            attachLocalStream(localStreamRef.current);

            const token = localStorage.getItem("token");
            if (token) {
                fetch(`${server_url}/api/v1/meetings/history`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ meetingCode: roomPath })
                }).catch(err => console.error("Failed to save meeting history", err));
            }
            toast.success(approvedAsHost ? "You are the host of this meeting." : "Joined meeting successfully!");
        });

        socketRef.current.on("user-joined", (joinedId, allIds, roomUsernames) => {
            if (roomUsernames) setParticipantNames(roomUsernames);
            handleUserJoined(joinedId, allIds);

            if (isHostRef.current && socketRef.current) {
                socketRef.current.emit("signal", joinedId, { type: "is-host" });
            }

            const localAudioOff = sessionStorage.getItem("meeting_audio_enabled") === "false";
            const localVideoOff = sessionStorage.getItem("meeting_video_enabled") === "false";
            
            if (localAudioOff && socketRef.current) socketRef.current.emit("mute-user");
            if (localVideoOff && socketRef.current) socketRef.current.emit("video-off");
        });

        socketRef.current.on("signal", handleSignal);

        socketRef.current.on("user-left", (leftId) => {
            handleUserLeft(leftId);
            setParticipantStatuses(prev => {
                const newStatuses = { ...prev };
                delete newStatuses[leftId];
                return newStatuses;
            });
        });

        socketRef.current.on("mute-user", (socketId) => {
            setParticipantStatuses(prev => ({ ...prev, [socketId]: { ...prev[socketId], isMuted: true } }));
        });
        socketRef.current.on("unmute-user", (socketId) => {
            setParticipantStatuses(prev => ({ ...prev, [socketId]: { ...prev[socketId], isMuted: false } }));
        });
        socketRef.current.on("video-off", (socketId) => {
            setParticipantStatuses(prev => ({ ...prev, [socketId]: { ...prev[socketId], isVideoOff: true } }));
        });
        socketRef.current.on("video-on", (socketId) => {
            setParticipantStatuses(prev => ({ ...prev, [socketId]: { ...prev[socketId], isVideoOff: false } }));
        });
        socketRef.current.on("screen-share-start", (socketId) => {
            setParticipantStatuses(prev => ({ ...prev, [socketId]: { ...prev[socketId], isScreenSharing: true } }));
        });
        socketRef.current.on("screen-share-stop", (socketId) => {
            setParticipantStatuses(prev => ({ ...prev, [socketId]: { ...prev[socketId], isScreenSharing: false } }));
        });

        socketRef.current.on("chat-message", (data, sender, senderSocketId, timestamp) => {
            const isOwn = senderSocketId === socketIdRef.current;
            setMessages((prev) => [
                ...prev,
                {
                    text: data,
                    sender: isOwn ? activeUsernameRef.current : sender,
                    own: isOwn,
                    timestamp: timestamp || new Date().toISOString()
                }
            ]);
            setNewMessages((n) => (!showModalRef.current && !isOwn ? n + 1 : n));
        });

        socketRef.current.on("user-typing", (typingUser, typingSocketId) => {
            setTypingUsers((prev) => {
                if (!prev.some(user => user.id === typingSocketId)) {
                    return [...prev, { id: typingSocketId, name: typingUser }];
                }
                return prev;
            });
        });

        socketRef.current.on("user-stop-typing", (typingSocketId) => {
            setTypingUsers((prev) => prev.filter(user => user.id !== typingSocketId));
        });

        socketRef.current.on("new-join-request", (request) => {
            if (!isHostRef.current) return;
            setWaitingUsers(prev => {
                if (prev.some(u => u.socketId === request.socketId)) return prev;
                return [...prev, request];
            });
        });

        socketRef.current.on("waiting-list-updated", (newList) => {
            setWaitingUsers(newList);
        });

        socketRef.current.on("participant-removed", () => {
            toast.error("You have been removed by the host.");
            setTimeout(() => { window.location.href = "/home"; }, 1500);
        });

        socketRef.current.on("meeting-locked", () => {
            setMeetingLocked(true);
            toast.warning("Meeting is now locked.");
        });

        socketRef.current.on("meeting-unlocked", () => {
            setMeetingLocked(false);
            toast.success("Meeting unlocked.");
        });

        socketRef.current.on("auto-approve-toggled", (status) => {
            setAutoApprove(status);
            toast.info(`Auto-approve is now ${status ? "ON" : "OFF"}`);
        });

        socketRef.current.on("host-transferred", (newHostSocketId) => {
            setHostSocketId(newHostSocketId);
            if (newHostSocketId === socketIdRef.current) {
                setIsHost(true);
                isHostRef.current = true;
                toast.success("You are now the host of this meeting.");
            }
        });

        socketRef.current.on("meeting-ended", () => {
            if (isHostRef.current) return;
            toast.error("The host has ended the meeting.");
            sessionStorage.removeItem(`joined_meeting_${roomPath}`);
            sessionStorage.removeItem("meeting_username");
            sessionStorage.removeItem("meeting_audio_enabled");
            sessionStorage.removeItem("meeting_video_enabled");
            sessionStorage.removeItem(`meeting_messages_${roomPath}`);
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            setTimeout(() => { window.location.href = "/home"; }, 1500);
        });
    }, [handleUserJoined, handleSignal, handleUserLeft, userData, toast, attachLocalStream]);

    const joinCall = useCallback(async (overrideUsername) => {
        try {
            const roomPath = window.location.pathname;

            const savedMessages = sessionStorage.getItem(`meeting_messages_${roomPath}`);
            if (savedMessages) {
                try { setMessages(JSON.parse(savedMessages)); } catch { setMessages([]); }
            } else {
                setMessages([]);
            }
            setMessage("");
            setNewMessages(0);

            const nameToUse = (typeof overrideUsername === "string" ? overrideUsername : null) || username;
            if (!nameToUse?.trim()) {
                toast.warning("Please enter your name to join.");
                return;
            }

            if (mediaCheckPromiseRef.current && !localStreamRef.current) {
                await Promise.race([
                    mediaCheckPromiseRef.current,
                    new Promise((resolve) => setTimeout(resolve, 1200)),
                ]);
            }

            let stream = localStreamRef.current;
            if (!stream) {
                try {
                    const optimalConstraints = { video: { width: 640, height: 480, frameRate: 15 }, audio: true };
                    if (videoAvailable && audioAvailable) {
                        try {
                            stream = await acquireMediaWithTimeout(optimalConstraints);
                        } catch (err) {
                            if (err.name !== "NotAllowedError") {
                                try { stream = await acquireMediaWithTimeout({ audio: true }); } catch { }
                            }
                        }
                    } else if (videoAvailable) {
                        try { stream = await acquireMediaWithTimeout({ video: { width: 640, height: 480, frameRate: 15 } }); } catch { }
                    } else if (audioAvailable) {
                        try { stream = await acquireMediaWithTimeout({ audio: true }); } catch { }
                    }
                } catch (err) {
                    console.warn("Media acquisition failed:", err);
                }
            }

            localStreamRef.current = stream || null;

            if (lobbyVideoRef.current && stream) {
                lobbyVideoRef.current.srcObject = stream;
            }

            const isAudioOn = true;
            const isVideoOn = true;

            if (stream) {
                stream.getAudioTracks().forEach((t) => { t.enabled = isAudioOn; });
                stream.getVideoTracks().forEach((t) => { t.enabled = isVideoOn; });
            }

            setVideo(stream && stream.getVideoTracks().length > 0 ? isVideoOn : false);
            setAudio(stream && stream.getAudioTracks().length > 0 ? isAudioOn : false);
            setMediaError(stream ? "" : "No camera/mic. Joining without media.");

            sessionStorage.setItem(`joined_meeting_${roomPath}`, "true");
            sessionStorage.setItem("meeting_username", nameToUse);
            sessionStorage.setItem("meeting_audio_enabled", "true");
            sessionStorage.setItem("meeting_video_enabled", "true");

            connectSocket(roomPath, nameToUse);
        } catch (err) {
            console.error("joinCall CRASHED:", err.message, err.stack);
        }
    }, [videoAvailable, audioAvailable, username, toast, connectSocket]);
    joinCallRef.current = joinCall;

    useEffect(() => {
        if (!permissionsChecked) return;
        if (hasAutoJoinedRef.current) return;

        const roomPath = window.location.pathname;
        const wasInMeeting = sessionStorage.getItem(`joined_meeting_${roomPath}`) === "true";
        const storedUsername = sessionStorage.getItem("meeting_username");

        if (wasInMeeting && storedUsername) {
            hasAutoJoinedRef.current = true;
            setUsername(storedUsername);
            setTimeout(() => joinCallRef.current?.(storedUsername), 0);
        }
    }, [permissionsChecked]);

    const replaceTracksForAllPeers = (newStream) => {
        Object.values(connections).forEach((pc) => {
            newStream.getTracks().forEach((newTrack) => {
                const sender = pc.getSenders().find((s) => s.track?.kind === newTrack.kind);
                if (sender) {
                    sender.replaceTrack(newTrack).catch(e => console.error("Replace track error", e));
                } else {
                    try { pc.addTrack(newTrack, newStream); } catch (e) { console.error("Add track error", e); }
                }
            });
        });
    };

    const handleVideo = async () => {
        const stream = localStreamRef.current;
        if (stream && stream.getVideoTracks().length > 0) {
            const tracks = stream.getVideoTracks();
            const next = !tracks[0].enabled;
            tracks.forEach((t) => (t.enabled = next));
            setVideo(next);
            sessionStorage.setItem("meeting_video_enabled", next ? "true" : "false");
            if (socketRef.current) socketRef.current.emit(next ? "video-on" : "video-off");
            return;
        }
        try {
            const videoStream = await acquireMediaWithTimeout({ video: true });
            if (localStreamRef.current) {
                videoStream.getVideoTracks().forEach((track) => {
                    localStreamRef.current.addTrack(track);
                });
                replaceTracksForAllPeers(localStreamRef.current);
                attachLocalStream(localStreamRef.current);
            } else {
                localStreamRef.current = videoStream;
                attachLocalStream(videoStream);
                replaceTracksForAllPeers(videoStream);
            }
            setVideo(true);
            setVideoAvailable(true);
            sessionStorage.setItem("meeting_video_enabled", "true");
            if (socketRef.current) socketRef.current.emit("video-on");
        } catch (err) {
            console.error("Camera start failed:", err);
            toast.error("Cannot access camera.");
        }
    };

    const handleAudio = async () => {
        const stream = localStreamRef.current;
        if (stream && stream.getAudioTracks().length > 0) {
            const tracks = stream.getAudioTracks();
            const next = !tracks[0].enabled;
            tracks.forEach((t) => (t.enabled = next));
            setAudio(next);
            sessionStorage.setItem("meeting_audio_enabled", next ? "true" : "false");
            if (socketRef.current) socketRef.current.emit(next ? "unmute-user" : "mute-user");
            return;
        }
        try {
            const audioStream = await acquireMediaWithTimeout({ audio: true });
            if (localStreamRef.current) {
                audioStream.getAudioTracks().forEach((track) => {
                    localStreamRef.current.addTrack(track);
                });
                replaceTracksForAllPeers(localStreamRef.current);
            } else {
                localStreamRef.current = audioStream;
                replaceTracksForAllPeers(audioStream);
            }
            setAudio(true);
            setAudioAvailable(true);
            sessionStorage.setItem("meeting_audio_enabled", "true");
            if (socketRef.current) socketRef.current.emit("unmute-user");
        } catch (err) {
            console.error("Mic start failed:", err);
            toast.error("Cannot access microphone.");
        }
    };

    const handleScreen = async () => {
        if (!screenAvailable) return;
        if (screen) {
            const currentStream = localStreamRef.current;
            if (currentStream) currentStream.getTracks().forEach((t) => t.stop());
            try {
                const cam = await acquireMediaWithTimeout({ video: videoAvailable, audio: audioAvailable });
                localStreamRef.current = cam;
                attachLocalStream(cam);
                replaceTracksForAllPeers(cam);
                setScreen(false); setVideo(true); setAudio(true);
                if (socketRef.current) {
                    socketRef.current.emit("screen-share-stop");
                    socketRef.current.emit("video-on");
                    socketRef.current.emit("unmute-user");
                }
            } catch (err) { console.error("Revert to camera failed:", err); setScreen(false); }
            return;
        }
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const existingStream = localStreamRef.current;
            if (existingStream) existingStream.getTracks().forEach((t) => t.stop());
            localStreamRef.current = screenStream;
            attachLocalStream(screenStream);
            replaceTracksForAllPeers(screenStream);
            setScreen(true);
            if (socketRef.current) socketRef.current.emit("screen-share-start");
            screenStream.getVideoTracks()[0].onended = async () => {
                try {
                    const cam = await acquireMediaWithTimeout({ video: videoAvailable, audio: audioAvailable });
                    localStreamRef.current = cam;
                    attachLocalStream(cam);
                    replaceTracksForAllPeers(cam);
                    setScreen(false); setVideo(true); setAudio(true);
                    if (socketRef.current) {
                        socketRef.current.emit("screen-share-stop");
                        socketRef.current.emit("video-on");
                        socketRef.current.emit("unmute-user");
                    }
                } catch (err) { console.error("Revert after screen end failed:", err); setScreen(false); }
            };
        } catch (err) {
            if (err.name === "NotAllowedError") toast.error("Screen share permission denied.");
            else console.error("Screen share failed:", err);
        }
    };

    const toggleModal = () => {
        if (!showModal) setNewMessages(0);
        setModal((prev) => !prev);
    };

    const sendMessage = useCallback(() => {
        if (!message.trim()) return;
        socketRef.current?.emit("chat-message", message.trim(), username);
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        socketRef.current?.emit("stop-typing");
        setMessage("");
    }, [message, username]);

    const endCall = () => {
        try {
            if (getFullscreenElement()) {
                exitDocumentFullscreen().catch(() => { });
            }
            if (isHost) {
                socketRef.current?.emit("end-meeting-all", window.location.pathname);
            }
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            Object.values(connections).forEach((pc) => pc.close());
            connections = {};
            socketRef.current?.disconnect();
            setMessages([]);
            toast.info(isHost ? "You ended the meeting." : "Left the meeting");
        } catch (err) { console.error("End call error:", err); }

        const roomPath = window.location.pathname;
        sessionStorage.removeItem(`joined_meeting_${roomPath}`);
        sessionStorage.removeItem("meeting_username");
        sessionStorage.removeItem("meeting_audio_enabled");
        sessionStorage.removeItem("meeting_video_enabled");
        sessionStorage.removeItem(`meeting_messages_${roomPath}`);
        sessionStorage.removeItem("meetverse_session_id");

        navigate("/home");
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Meeting link copied!");
    };

    const meetingCode = window.location.pathname.substring(1);
    const gridCount = videos.length + 1;
    const isFocusMode = !!focusedId && gridCount > 1;
    const thumbRowCount = Math.max(gridCount - 1, 1);

    return (
        <>
            <AnimatePresence mode="wait">
                {askForUsername && waitingRoomStatus === "none" && (
                    <motion.div
                        className="vc-lobby"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        key="lobby"
                    >
                        <div className="lobby-container">
                            <motion.div
                                className="lobby-preview"
                                initial={{ opacity: 0, x: -24 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                {videoAvailable ? (
                                    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "inherit", overflow: "hidden", background: "#0d0f1a" }}>
                                        <video
                                            ref={lobbyVideoRef}
                                            autoPlay
                                            muted
                                            playsInline
                                            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                                        />
                                        <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "4px 10px", fontSize: "0.8rem", color: "#fff" }}>
                                            Preview
                                        </div>
                                    </div>
                                ) : (
                                    <div className="lobby-no-cam">
                                        <div className="cam-off-icon"><FaVideoSlash /></div>
                                        <span>No camera available</span>
                                    </div>
                                )}

                                <div className="lobby-preview-controls">
                                    <button
                                        className={`lobby-ctrl ${audioAvailable ? "on" : "off"}`}
                                        title={audioAvailable ? "Mic On" : "No mic"}
                                    >
                                        {audioAvailable ? <FaMicrophone /> : <FaMicrophoneSlash />}
                                    </button>
                                    <button
                                        className={`lobby-ctrl ${videoAvailable ? "on" : "off"}`}
                                        title={videoAvailable ? "Cam On" : "No camera"}
                                    >
                                        {videoAvailable ? <FaVideo /> : <FaVideoSlash />}
                                    </button>
                                </div>
                            </motion.div>

                            <motion.div
                                className="lobby-form glass"
                                initial={{ opacity: 0, x: 24 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.15 }}
                            >
                                <div className="lobby-logo">
                                    <FaVideo /> MeetVerse
                                </div>

                                <h2>Ready to join?</h2>
                                <p>
                                    Welcome, <strong>{userData?.fullName || "User"}</strong>.
                                    Check your settings and join the meeting.
                                </p>

                                <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "var(--radius-sm)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-subtle)", marginBottom: 2 }}>Meeting Code</div>
                                        <code style={{ fontSize: "0.95rem", color: "var(--primary-light)", fontWeight: 700, wordBreak: "break-all" }}>{meetingCode}</code>
                                    </div>
                                    <button
                                        onClick={copyLink}
                                        style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "var(--radius-xs)", padding: "6px 12px", color: "var(--primary-light)", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, flexShrink: 0 }}
                                    >
                                        <FaCopy /> Copy Link
                                    </button>
                                </div>

                                <label className="lobby-input-label">Your Name</label>
                                <input
                                    className="lobby-input"
                                    type="text"
                                    placeholder="Enter your display name"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && joinCall()}
                                    autoFocus
                                />

                                {mediaError && (
                                    <div className="lobby-media-warning">{mediaError}</div>
                                )}

                                <motion.button
                                    className="lobby-join-btn"
                                    onClick={() => joinCall()}
                                    disabled={!username.trim()}
                                    whileTap={{ scale: 0.97 }}
                                    whileHover={{ scale: 1.02 }}
                                >
                                    <FaVideo /> Join Meeting
                                </motion.button>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {waitingRoomStatus === "waiting" && (
                <div className="vc-waiting-room glass">
                    <div className="waiting-spinner"></div>
                    <h2>Waiting for Host Approval</h2>
                    <p>Your request has been sent to the meeting organizer.</p>
                    <p>Please wait while the host reviews your request.</p>
                    <button className="lobby-join-btn" onClick={() => window.location.href = "/home"}>Cancel Request</button>
                </div>
            )}

            {waitingRoomStatus === "rejected" && (
                <div className="vc-waiting-room glass">
                    <h2 style={{ color: "#f87171" }}>Request Declined</h2>
                    <p>{rejectReason}</p>
                    <button className="lobby-join-btn" onClick={() => window.location.href = "/home"}>Return Home</button>
                </div>
            )}

            {!askForUsername && waitingRoomStatus === "none" && (
                <motion.div
                    className="vc-room"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key="room"
                >
                    <div className="vc-topbar">
                        <div className="vc-topbar-left">
                            <span className="vc-meeting-title">MeetVerse</span>
                            <span className="vc-meeting-id">{meetingCode}</span>
                        </div>
                        <div className="vc-topbar-right">
                            <div className="vc-participant-count">
                                <FaUsers /> {participantCount || 1}
                            </div>
                            <button
                                className="icon-btn"
                                onClick={copyLink}
                                title="Copy meeting link"
                                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: "0.85rem" }}
                            >
                                <FaLink />
                            </button>
                            <ThemeToggle />
                        </div>
                    </div>

                    {isHost && (
                        <div className="host-dashboard">
                            <div className="host-dashboard-header" style={{ cursor: "pointer" }} onClick={() => setShowHostDashboard(!showHostDashboard)}>
                                <h3>Host Dashboard</h3>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.8rem", background: "rgba(16,185,129,0.2)", color: "#34d399", padding: "2px 8px", borderRadius: "10px" }}>Active</div>
                                    <span style={{ color: "var(--text-subtle)" }}>{showHostDashboard ? "▲" : "▼"}</span>
                                </div>
                            </div>

                            {showHostDashboard && (
                                <div className="host-dashboard-content">
                                    <div>
                                        <div className="host-section-title">Pending Requests ({waitingUsers.length})</div>
                                        {waitingUsers.length > 0 ? (
                                            <>
                                                <button className="host-control-btn" style={{ width: "100%", marginBottom: "8px" }} onClick={admitAll}>Admit All Users</button>
                                                <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                                                    {waitingUsers.map(u => (
                                                        <div key={u.socketId} className="waiting-user-card">
                                                            <div className="waiting-user-info">
                                                                <span className="waiting-user-name">{u.username}</span>
                                                            </div>
                                                            <div className="waiting-user-actions">
                                                                <button className="btn-approve" onClick={() => approveUser(u.socketId)}>Approve</button>
                                                                <button className="btn-reject" onClick={() => rejectUser(u.socketId)}>Reject</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ color: "var(--text-subtle)", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>No pending requests.</div>
                                        )}
                                    </div>

                                    <div>
                                        <div className="host-section-title">Participants ({videos.length + 1})</div>
                                        <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                                            <div className="participant-item">
                                                <div className="participant-item-name">
                                                    <FaUsers size={12} color="var(--text-subtle)" /> {username} (You)
                                                </div>
                                            </div>
                                            {videos.map(v => (
                                                <div key={v.id} className="participant-item">
                                                    <div className="participant-item-name">
                                                        <FaUsers size={12} color="var(--text-subtle)" /> {participantNames[v.id] || "Participant"}
                                                    </div>
                                                    <button className="remove-participant-btn" onClick={() => removeParticipant(v.id)} title="Remove Participant">
                                                        <FaTimes />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="host-section-title">Meeting Security</div>
                                        <div className="host-controls-grid">
                                            <button className={`host-control-btn ${meetingLocked ? "active" : ""}`} onClick={toggleLock}>
                                                {meetingLocked ? "Unlock Meeting" : "Lock Meeting"}
                                            </button>
                                            <button className={`host-control-btn ${autoApprove ? "active" : ""}`} onClick={toggleAutoApproveStatus}>
                                                {autoApprove ? "Auto-Approve OFF" : "Auto-Approve ON"}
                                            </button>
                                        </div>
                                        <button className="host-control-btn danger" style={{ width: "100%", marginTop: "8px" }} onClick={endCall}>
                                            End Meeting for All
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="vc-video-area">
                        <div
                            className={`vc-grid ${isFocusMode ? "vc-focus-mode" : `count-${Math.min(gridCount, 6)}`} ${showModal ? "chat-open" : ""}`}
                            style={isFocusMode ? { gridTemplateRows: `repeat(${thumbRowCount}, minmax(80px, 1fr))` } : undefined}
                        >
                            <motion.div
                                layout
                                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                                className={`vc-tile-wrapper ${focusedId === "local" ? "vc-tile-main" : isFocusMode ? "vc-tile-thumb" : ""}`}
                                style={focusedId === "local" ? { gridRow: `1 / ${thumbRowCount + 1}` } : undefined}
                                onClick={() => gridCount > 1 && handleTileClick("local")}
                                onDoubleClick={(e) => handleTileDoubleClick(e, "local")}
                            >
                                <div
                                    className="vc-tile"
                                    ref={(el) => { tileRefs.current["local"] = el; }}
                                    data-tile-id="local"
                                >
                                    {isHost && <div className="vc-tile-host-badge">HOST</div>}
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: video ? "block" : "none",
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            zIndex: 1,
                                        }}
                                    />
                                    {!video && <CameraOffPlaceholder participantName={username || "You"} />}
                                    <div className="vc-tile-name" style={{ zIndex: 3 }}>
                                        {username || "You"} (You)
                                    </div>
                                    {focusedId === "local" && (
                                        <button
                                            type="button"
                                            className="vc-exit-focus-btn"
                                            onClick={exitFocusMode}
                                            title="Exit focus view"
                                            aria-label="Exit focus view"
                                            style={{ zIndex: 4 }}
                                        >
                                            <FaTimes size={12} />
                                        </button>
                                    )}
                                    {gridCount > 1 && (
                                        <button
                                            type="button"
                                            className="vc-fullscreen-btn"
                                            onClick={(e) => { e.stopPropagation(); toggleTileFullscreen("local"); }}
                                            title={fullscreenTileId === "local" ? "Exit fullscreen" : "Fullscreen"}
                                            aria-label={fullscreenTileId === "local" ? "Exit fullscreen" : "Enter fullscreen"}
                                            style={{ zIndex: 4 }}
                                        >
                                            {fullscreenTileId === "local" ? <FaCompress size={13} /> : <FaExpand size={13} />}
                                        </button>
                                    )}
                                </div>
                            </motion.div>

                            {videos.map((item, index) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    transition={{ type: "spring", damping: 28, stiffness: 280 }}
                                    className={`vc-tile-wrapper ${focusedId === item.id ? "vc-tile-main" : isFocusMode ? "vc-tile-thumb" : ""}`}
                                    style={focusedId === item.id ? { gridRow: `1 / ${thumbRowCount + 1}` } : undefined}
                                    onClick={() => handleTileClick(item.id)}
                                    onDoubleClick={(e) => handleTileDoubleClick(e, item.id)}
                                >
                                    <RemoteVideo
                                        item={item}
                                        index={index}
                                        participantNames={participantNames}
                                        status={participantStatuses[item.id]}
                                        tileRef={(el) => { tileRefs.current[item.id] = el; }}
                                        onFullscreen={() => toggleTileFullscreen(item.id)}
                                        isFullscreenActive={fullscreenTileId === item.id}
                                        isHostTile={hostSocketId === item.id}
                                    />
                                    {focusedId === item.id && (
                                        <button
                                            type="button"
                                            className="vc-exit-focus-btn"
                                            onClick={exitFocusMode}
                                            title="Exit focus view"
                                            aria-label="Exit focus view"
                                        >
                                            <FaTimes size={12} />
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        <AnimatePresence>
                            {showModal && (
                                <motion.div
                                    className="vc-chat-panel"
                                    initial={{ x: "100%", opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: "100%", opacity: 0 }}
                                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                >
                                    <div className="chat-panel-header">
                                        <h3>Meeting Chat</h3>
                                        <button className="close-panel-btn" onClick={toggleModal}>
                                            <FaTimes />
                                        </button>
                                    </div>

                                    <div className="chat-messages" ref={chatMessagesRef}>
                                        {messages.length === 0 ? (
                                            <div style={{ textAlign: "center", color: "var(--text-subtle)", fontSize: "0.85rem", marginTop: 32 }}>
                                                No messages yet. Say hello! 👋
                                            </div>
                                        ) : (
                                            messages.map((msg, i) => (
                                                <div key={i} className="chat-msg-group">
                                                    {!msg.own && <div className="chat-msg-sender">{msg.sender}</div>}
                                                    <div className={`chat-bubble ${msg.own ? "sent" : "received"}`}>
                                                        {msg.text}
                                                    </div>
                                                    <div className="chat-ts" style={{ textAlign: msg.own ? "right" : "left" }}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </div>
                                                </div>
                                            ))
                                        )}

                                        {typingUsers.length > 0 && (
                                            <div className="chat-msg-group">
                                                <div className="typing-indicator">
                                                    <div className="typing-dot" />
                                                    <div className="typing-dot" />
                                                    <div className="typing-dot" />
                                                </div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-subtle)", paddingLeft: 4, marginTop: 3 }}>
                                                    {typingUsers.map(u => u.name).join(", ")} typing...
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="chat-input-row">
                                        <input
                                            className="chat-text-input"
                                            type="text"
                                            value={message}
                                            placeholder="Type a message..."
                                            onChange={(e) => {
                                                setMessage(e.target.value);
                                                if (socketRef.current) {
                                                    socketRef.current.emit("typing", username);
                                                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                                    typingTimeoutRef.current = setTimeout(() => {
                                                        socketRef.current.emit("stop-typing");
                                                        typingTimeoutRef.current = null;
                                                    }, 2000);
                                                }
                                            }}
                                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                        />
                                        <button
                                            className="chat-send-btn"
                                            onClick={sendMessage}
                                            disabled={!message.trim()}
                                            aria-label="Send message"
                                        >
                                            <FaPaperPlane />
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ── BOTTOM CONTROLS BAR ── */}
                    <div className="vc-controls-bar">
                        <div className="controls-left">
                            <span className="time-label">
                                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="code-label">{meetingCode}</span>
                        </div>

                        <div className="controls-center">
                            <div className="ctrl-stack">
                                <button
                                    className={`ctrl-icon-btn ${audio ? "ctrl-on" : "ctrl-off"}`}
                                    onClick={handleAudio}
                                    title={audio ? "Mute" : "Unmute"}
                                    aria-label={audio ? "Mute microphone" : "Unmute microphone"}
                                    disabled={!audioAvailable}
                                    style={!audioAvailable ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                                >
                                    {audio ? <FaMicrophone /> : <FaMicrophoneSlash />}
                                </button>
                                <div className="ctrl-label">{audio ? "Mute" : "Unmute"}</div>
                            </div>

                            <div className="ctrl-stack">
                                <button
                                    className={`ctrl-icon-btn ${video ? "ctrl-on" : "ctrl-off"}`}
                                    onClick={handleVideo}
                                    title={video ? "Stop Video" : "Start Video"}
                                    aria-label={video ? "Stop camera" : "Start camera"}
                                    disabled={!videoAvailable}
                                    style={!videoAvailable ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                                >
                                    {video ? <FaVideo /> : <FaVideoSlash />}
                                </button>
                                <div className="ctrl-label">{video ? "Stop" : "Start"}</div>
                            </div>

                            {screenAvailable && (
                                <div className="ctrl-stack">
                                    <button
                                        className={`ctrl-icon-btn ${screen ? "ctrl-active" : "ctrl-on"}`}
                                        onClick={handleScreen}
                                        title={screen ? "Stop Sharing" : "Share Screen"}
                                        aria-label={screen ? "Stop screen sharing" : "Start screen sharing"}
                                    >
                                        <FaDesktop />
                                    </button>
                                    <div className="ctrl-label">{screen ? "Stop" : "Share"}</div>
                                </div>
                            )}

                            <div className="ctrl-stack">
                                <button
                                    className={`ctrl-icon-btn ${showModal ? "ctrl-active" : "ctrl-on"}`}
                                    onClick={toggleModal}
                                    title="Chat"
                                    aria-label="Toggle chat"
                                    style={{ position: "relative" }}
                                >
                                    <FaComments />
                                    {newMessages > 0 && (
                                        <span className="ctrl-badge">
                                            {newMessages > 9 ? "9+" : newMessages}
                                        </span>
                                    )}
                                </button>
                                <div className="ctrl-label">Chat</div>
                            </div>

                            <div className="ctrl-stack">
                                <button className="ctrl-icon-btn ctrl-end" onClick={endCall} aria-label="Leave meeting" title="Leave">
                                    <FaPhoneSlash />
                                </button>
                                <div className="ctrl-label">Leave</div>
                            </div>
                        </div>

                        <div className="controls-right">
                            <button
                                className="ctrl-icon-btn ctrl-on"
                                onClick={copyLink}
                                title="Copy meeting link"
                                aria-label="Copy meeting link"
                            >
                                <FaLink />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </>
    );
}