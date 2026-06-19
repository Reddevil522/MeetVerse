import { Server } from "socket.io";

let meetings = {};
/*
  meetings[roomId] = {
      hostSocketId: string,
      hostSessionId: string,
      hostUserId: string | null,
      participants: [{ socketId, username, userId, sessionId }],
      waitingUsers: [{ socketId, username, userId, sessionId, requestedAt }],
      isLocked: boolean,
      autoApprove: boolean,
  }
*/

const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    // Helper functions
    const getRoomBySocketId = (socketId) => {
        for (const [roomId, meeting] of Object.entries(meetings)) {
            if (meeting.participants.some(p => p.socketId === socketId)) return roomId;
        }
        return null;
    };

    const isHost = (roomId, socketId) => {
        return meetings[roomId]?.hostSocketId === socketId;
    };

    const getParticipantSocketIds = (roomId) => {
        return meetings[roomId]?.participants.map(p => p.socketId) || [];
    };

    const getRoomUsernames = (roomId) => {
        const obj = {};
        meetings[roomId]?.participants.forEach(p => {
            obj[p.socketId] = p.username || "Participant";
        });
        return obj;
    };

    io.on("connection", (socket) => {
        console.log("User Connected:", socket.id);

        // ==================================================
        // JOIN REQUEST (Waiting Room Flow)
        // ==================================================
        socket.on("join-request", ({ path, username, userId, sessionId }) => {
            let meeting = meetings[path];

            // 1. If meeting doesn't exist, create it and assign host
            if (!meeting) {
                meetings[path] = {
                    hostSocketId: socket.id,
                    hostSessionId: sessionId,
                    hostUserId: userId || null,
                    participants: [{ socketId: socket.id, username, userId, sessionId }],
                    waitingUsers: [],
                    isLocked: false,
                    autoApprove: false,
                };
                socket.join(path);
                socket.emit("join-approved", { isHost: true, participants: meetings[path].participants });
                console.log(`[Host Created] ${username} created room ${path}`);
                socket.emit("user-joined", socket.id, getParticipantSocketIds(path), getRoomUsernames(path));
                return;
            }

            // 2. Host re-joining (matched by sessionId OR userId)
            const isHostRejoining = (meeting.hostSessionId === sessionId) || 
                                    (userId && meeting.hostUserId === userId);

            if (isHostRejoining) {
                meeting.hostSocketId = socket.id;
                meeting.hostSessionId = sessionId; // update session id in case they joined from new tab
                meeting.participants = meeting.participants.filter(p => p.sessionId !== sessionId && p.socketId !== socket.id);
                meeting.participants.push({ socketId: socket.id, username, userId, sessionId });

                socket.join(path);
                socket.emit("join-approved", { isHost: true, participants: meeting.participants });

                const pIds = getParticipantSocketIds(path);
                const pNames = getRoomUsernames(path);
                pIds.forEach((id) => { io.to(id).emit("user-joined", socket.id, pIds, pNames); });
                // Re-send waiting list to host on refresh
                socket.emit("waiting-list-updated", meeting.waitingUsers);
                console.log(`[Host Rejoined] ${username} rejoined as host of room ${path}`);
                return;
            }

            // 3. Existing approved participant re-joining on page refresh
            const wasParticipant = meeting.participants.some(p => p.sessionId === sessionId);
            if (wasParticipant) {
                // Update their socket ID and re-add them
                meeting.participants = meeting.participants.filter(p => p.sessionId !== sessionId);
                meeting.participants.push({ socketId: socket.id, username, userId, sessionId });

                socket.join(path);
                socket.emit("join-approved", { isHost: false, participants: meeting.participants });

                const pIds = getParticipantSocketIds(path);
                const pNames = getRoomUsernames(path);
                pIds.forEach((id) => { io.to(id).emit("user-joined", socket.id, pIds, pNames); });
                console.log(`[Participant Rejoined] ${username} rejoined room ${path}`);
                return;
            }

            // 4. Meeting is locked — reject immediately
            if (meeting.isLocked) {
                socket.emit("join-rejected", { reason: "meeting-locked" });
                return;
            }

            // 5. Auto-approve enabled — let them straight in
            if (meeting.autoApprove) {
                meeting.participants.push({ socketId: socket.id, username, userId, sessionId });
                socket.join(path);
                socket.emit("join-approved", { isHost: false, participants: meeting.participants });

                const pIds = getParticipantSocketIds(path);
                const pNames = getRoomUsernames(path);
                pIds.forEach((id) => { io.to(id).emit("user-joined", socket.id, pIds, pNames); });
                return;
            }

            // 6. Needs host approval — place in waiting room
            const request = { socketId: socket.id, username, userId, sessionId, requestedAt: Date.now() };
            if (!meeting.waitingUsers.some(u => u.socketId === socket.id)) {
                meeting.waitingUsers.push(request);
            }
            socket.emit("waiting-for-approval");
            console.log(`[Waiting] ${username} waiting for approval in room ${path}`);
            // Notify host
            if (meeting.hostSocketId) {
                io.to(meeting.hostSocketId).emit("new-join-request", request);
            }
            // Fallback: broadcast to room so if hostSocketId is stale, host still gets it (filtered on frontend)
            socket.to(path).emit("new-join-request", request);
        });

        // Backward compatibility for existing join-call (if needed during transition)
        socket.on("join-call", (path, username) => {
            // Emulate join-request with no userId
            socket.emit("fallback-trigger"); // Inform frontend to use new event if possible
            const reqData = { path, username, userId: null };
            // Manually process as autoApprove to not break old frontends before migration
            let meeting = meetings[path];
            if (!meeting) {
                meetings[path] = {
                    hostSocketId: socket.id,
                    participants: [{ socketId: socket.id, username, userId: null }],
                    waitingUsers: [],
                    isLocked: false,
                    autoApprove: true, // Default to true for backward compat legacy join
                };
                socket.join(path);
            } else {
                meeting.participants.push({ socketId: socket.id, username, userId: null });
                socket.join(path);
            }

            const pIds = getParticipantSocketIds(path);
            const pNames = getRoomUsernames(path);
            pIds.forEach((id) => {
                io.to(id).emit("user-joined", socket.id, pIds, pNames);
            });
        });

        // ==================================================
        // HOST ACTIONS
        // ==================================================

        socket.on("approve-user", (roomId, targetSocketId) => {
            if (!isHost(roomId, socket.id)) return;
            const meeting = meetings[roomId];

            const waitingIndex = meeting.waitingUsers.findIndex(u => u.socketId === targetSocketId);
            if (waitingIndex !== -1) {
                const user = meeting.waitingUsers.splice(waitingIndex, 1)[0];
                meeting.participants.push({ socketId: user.socketId, username: user.username, userId: user.userId });

                // Add socket to room
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) {
                    targetSocket.join(roomId);
                    targetSocket.emit("join-approved", { isHost: false, participants: meeting.participants });

                    const pIds = getParticipantSocketIds(roomId);
                    const pNames = getRoomUsernames(roomId);
                    pIds.forEach((id) => {
                        io.to(id).emit("user-joined", targetSocketId, pIds, pNames);
                    });
                }

                // Notify host that approval succeeded
                socket.emit("waiting-list-updated", meeting.waitingUsers);
            }
        });

        socket.on("reject-user", (roomId, targetSocketId) => {
            if (!isHost(roomId, socket.id)) return;
            const meeting = meetings[roomId];

            const waitingIndex = meeting.waitingUsers.findIndex(u => u.socketId === targetSocketId);
            if (waitingIndex !== -1) {
                meeting.waitingUsers.splice(waitingIndex, 1);
                io.to(targetSocketId).emit("join-rejected", { reason: "host-rejected" });
                socket.emit("waiting-list-updated", meeting.waitingUsers);
            }
        });

        socket.on("admit-all", (roomId) => {
            if (!isHost(roomId, socket.id)) return;
            const meeting = meetings[roomId];

            const usersToAdmit = [...meeting.waitingUsers];
            meeting.waitingUsers = [];

            usersToAdmit.forEach(user => {
                meeting.participants.push({ socketId: user.socketId, username: user.username, userId: user.userId });
                const targetSocket = io.sockets.sockets.get(user.socketId);
                if (targetSocket) {
                    targetSocket.join(roomId);
                    targetSocket.emit("join-approved", { isHost: false, participants: meeting.participants });
                }
            });

            // Broadcast all new joins
            const pIds = getParticipantSocketIds(roomId);
            const pNames = getRoomUsernames(roomId);
            usersToAdmit.forEach(user => {
                pIds.forEach((id) => {
                    io.to(id).emit("user-joined", user.socketId, pIds, pNames);
                });
            });

            socket.emit("waiting-list-updated", meeting.waitingUsers);
        });

        socket.on("remove-participant", (roomId, targetSocketId) => {
            console.log(`[Host Action] remove-participant. Room: ${roomId}, Socket: ${socket.id}, Target: ${targetSocketId}`);
            if (!isHost(roomId, socket.id)) {
                console.log(`[Host Action Failed] Not the host. Expected: ${meetings[roomId]?.hostSocketId}, Got: ${socket.id}`);
                return;
            }
            const meeting = meetings[roomId];

            if (targetSocketId === socket.id) return; // Host can't remove themselves here

            const pIndex = meeting.participants.findIndex(p => p.socketId === targetSocketId);
            if (pIndex !== -1) {
                meeting.participants.splice(pIndex, 1);
                io.to(targetSocketId).emit("participant-removed", { reason: "removed-by-host" });

                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) {
                    targetSocket.leave(roomId);
                }

                // Notify others
                const pIds = getParticipantSocketIds(roomId);
                pIds.forEach((id) => {
                    io.to(id).emit("user-left", targetSocketId);
                });
            }
        });

        socket.on("lock-meeting", (roomId) => {
            console.log(`[Host Action] lock-meeting. Room: ${roomId}, Socket: ${socket.id}`);
            if (!isHost(roomId, socket.id)) {
                console.log(`[Host Action Failed] Not the host. Expected: ${meetings[roomId]?.hostSocketId}, Got: ${socket.id}`);
                return;
            }
            meetings[roomId].isLocked = true;
            io.to(roomId).emit("meeting-locked");
        });

        socket.on("unlock-meeting", (roomId) => {
            console.log(`[Host Action] unlock-meeting. Room: ${roomId}, Socket: ${socket.id}`);
            if (!isHost(roomId, socket.id)) {
                console.log(`[Host Action Failed] Not the host. Expected: ${meetings[roomId]?.hostSocketId}, Got: ${socket.id}`);
                return;
            }
            meetings[roomId].isLocked = false;
            io.to(roomId).emit("meeting-unlocked");
        });

        socket.on("toggle-auto-approve", (roomId, status) => {
            console.log(`[Host Action] toggle-auto-approve. Room: ${roomId}, Socket: ${socket.id}, Status: ${status}`);
            if (!isHost(roomId, socket.id)) {
                console.log(`[Host Action Failed] Not the host. Expected: ${meetings[roomId]?.hostSocketId}, Got: ${socket.id}`);
                return;
            }
            meetings[roomId].autoApprove = status;
            socket.emit("auto-approve-toggled", status);
        });

        socket.on("end-meeting-all", (roomId) => {
            console.log(`[Host Action] end-meeting-all. Room: ${roomId}, Socket: ${socket.id}`);
            if (!isHost(roomId, socket.id)) {
                console.log(`[Host Action Failed] Not the host. Expected: ${meetings[roomId]?.hostSocketId}, Got: ${socket.id}`);
                return;
            }

            // Notify all OTHER participants the meeting is ended
            // Host handles their own exit on the frontend
            socket.to(roomId).emit("meeting-ended");

            const meeting = meetings[roomId];
            if (meeting) {
                meeting.participants.forEach(p => {
                    if (p.socketId !== socket.id) {
                        const s = io.sockets.sockets.get(p.socketId);
                        if (s) s.leave(roomId);
                    }
                });
                delete meetings[roomId];
            }
        });

        // ==================================================
        // WEBRTC SIGNALING
        // ==================================================
        socket.on("signal", (toId, message) => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return; // Prevent waiting users or non-participants from signaling

            const targetRoomId = getRoomBySocketId(toId);
            if (roomId === targetRoomId) {
                io.to(toId).emit("signal", socket.id, message);
            }
        });

        // ==================================================
        // MEDIA STATUS SYNC
        // ==================================================

        socket.on("mute-user", () => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("mute-user", socket.id);
        });

        socket.on("unmute-user", () => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("unmute-user", socket.id);
        });

        socket.on("video-off", () => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("video-off", socket.id);
        });

        socket.on("video-on", () => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("video-on", socket.id);
        });

        socket.on("screen-share-start", () => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("screen-share-start", socket.id);
        });

        socket.on("screen-share-stop", () => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("screen-share-stop", socket.id);
        });

        // ==================================================
        // CHAT MESSAGE
        // ==================================================
        socket.on("chat-message", (data, sender) => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return; // Security: must be in room

            console.log(`Room: ${roomId} | Sender: ${sender} | Message: ${data}`);

            const pIds = getParticipantSocketIds(roomId);
            pIds.forEach((id) => {
                io.to(id).emit("chat-message", data, sender, socket.id, new Date().toISOString());
            });
        });

        // ==================================================
        // TYPING EVENTS
        // ==================================================
        socket.on("typing", (username) => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("user-typing", username, socket.id);
        });

        socket.on("stop-typing", () => {
            const roomId = getRoomBySocketId(socket.id);
            if (!roomId) return;
            socket.to(roomId).emit("user-stop-typing", socket.id);
        });

        // ==================================================
        // DISCONNECT
        // ==================================================
        socket.on("disconnect", () => {
            console.log("User Disconnected:", socket.id);

            for (const [roomId, meeting] of Object.entries(meetings)) {

                // If Host disconnects, we wait 3 seconds for them to reconnect (page refresh).
                // If they don't return, we end the meeting for everyone.
                if (meeting.hostSocketId === socket.id) {
                    meeting.hostSocketId = null;
                    meeting.participants = meeting.participants.filter(p => p.socketId !== socket.id);

                    setTimeout(() => {
                        const m = meetings[roomId];
                        if (m && m.hostSocketId === null) {
                            // Host didn't return after 3 seconds, end the meeting
                            io.to(roomId).emit("meeting-ended");

                            // Force everyone to leave
                            m.participants.forEach(p => {
                                const s = io.sockets.sockets.get(p.socketId);
                                if (s) s.leave(roomId);
                            });
                            delete meetings[roomId];
                            console.log(`[Meeting Ended] Room ${roomId} deleted because host left.`);
                        }
                    }, 3000);
                } else {
                    // Regular participant disconnect
                    const index = meeting.participants.findIndex(p => p.socketId === socket.id);
                    if (index !== -1) {
                        meeting.participants.splice(index, 1);
                    }
                }

                // Also remove from waiting room if they were waiting
                meeting.waitingUsers = meeting.waitingUsers.filter(u => u.socketId !== socket.id);
                // Notify host of waiting list update just in case
                if (meeting.hostSocketId) {
                    io.to(meeting.hostSocketId).emit("waiting-list-updated", meeting.waitingUsers);
                }

                // Notify others in room
                const pIds = getParticipantSocketIds(roomId);
                pIds.forEach((id) => {
                    io.to(id).emit("user-left", socket.id);
                });
            }
        });

    });

    return io;
};

export default connectToSocket;