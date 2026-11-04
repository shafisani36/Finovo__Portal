const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        server: "Finovo Socket.IO Signaling Server",
      }),
    );
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Finovo Real-Time Signaling Server Active");
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Track userId -> Set<socketId> so one user can have multiple tabs
const userSockets = new Map(); // userId (string) -> Set<socketId>

function registerUser(socket, userId) {
  const uid = String(userId);
  socket.userId = uid;
  socket.join(`user_${uid}`);
  if (!userSockets.has(uid)) userSockets.set(uid, new Set());
  userSockets.get(uid).add(socket.id);
  console.log(
    `[Socket.IO] Socket ${socket.id} registered as User ${uid} (${userSockets.get(uid).size} tab(s))`
  );
}

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on("register_user", (userId) => {
    registerUser(socket, userId);
  });

  // =========================================================================
  // CALL SIGNALING — Targeted delivery with caller exclusion
  // =========================================================================

  socket.on("call_initiate", (signal) => {
    const callerId = String(signal.callerId || "");
    const receiverUserId = String(signal.receiverUserId || "");

    console.log(
      `[Socket.IO] Call initiated: callId=${signal.callId} caller=${callerId} receiver=${receiverUserId} isVideo=${signal.isVideo}`
    );

    // Prevent self-calling at server level
    if (callerId && callerId === receiverUserId) {
      console.warn(`[Socket.IO] Self-call blocked: userId=${callerId}`);
      return;
    }

    if (receiverUserId && receiverUserId !== "undefined") {
      // Deliver ONLY to the target receiver's room (all their browser tabs)
      io.to(`user_${receiverUserId}`).emit("incoming_call", signal);
      console.log(`[Socket.IO] incoming_call → user_${receiverUserId}`);
    } else {
      // No specific receiver: broadcast to everyone except the caller
      socket.broadcast.emit("incoming_call", signal);
    }
  });

  // Call Answer — notify the caller that their call was answered
  socket.on("call_answer", (data) => {
    console.log(
      `[Socket.IO] Call answered: callId=${data?.callId} by userId=${socket.userId}`
    );
    const callerId = data?.callerId;
    if (callerId) {
      io.to(`user_${callerId}`).emit("call_answered", data);
    } else {
      socket.broadcast.emit("call_answered", data);
    }
  });

  // Call Decline — notify the caller
  socket.on("call_declined", (data) => {
    console.log(`[Socket.IO] Call declined: callId=${data?.callId}`);
    const callerId = data?.callerId;
    if (callerId) {
      io.to(`user_${callerId}`).emit("call_declined", data);
      io.to(`user_${callerId}`).emit("call_ended", {
        ...data,
        reason: "declined",
      });
    } else {
      socket.broadcast.emit("call_declined", data);
      socket.broadcast.emit("call_ended", { ...data, reason: "declined" });
    }
  });

  // Call End / Hangup
  socket.on("call_end", (data) => {
    console.log(`[Socket.IO] Call ended: callId=${data?.callId}`);
    // Notify all participants in both caller and receiver rooms
    const { callerId, receiverUserId } = data || {};
    if (callerId) io.to(`user_${callerId}`).emit("call_ended", data);
    if (receiverUserId)
      io.to(`user_${receiverUserId}`).emit("call_ended", data);
    // Also broadcast to cover group calls
    socket.broadcast.emit("call_ended", data);
  });

  // =========================================================================
  // WebRTC Peer-to-Peer Media Signaling (Offer, Answer, ICE Candidates)
  // =========================================================================

  socket.on("webrtc_offer", (data) => {
    const targetUserId = data?.targetUserId;
    console.log(
      `[Socket.IO] WebRTC Offer relay: callId=${data?.callId} target=${
        targetUserId || "broadcast"
      }`
    );
    if (targetUserId) {
      io.to(`user_${targetUserId}`).emit("webrtc_offer", data);
    } else {
      socket.broadcast.emit("webrtc_offer", data);
    }
  });

  socket.on("webrtc_answer", (data) => {
    const targetUserId = data?.targetUserId;
    console.log(
      `[Socket.IO] WebRTC Answer relay: callId=${data?.callId} target=${
        targetUserId || "broadcast"
      }`
    );
    if (targetUserId) {
      io.to(`user_${targetUserId}`).emit("webrtc_answer", data);
    } else {
      socket.broadcast.emit("webrtc_answer", data);
    }
  });

  socket.on("webrtc_ice_candidate", (data) => {
    const targetUserId = data?.targetUserId;
    if (targetUserId) {
      io.to(`user_${targetUserId}`).emit("webrtc_ice_candidate", data);
    } else {
      socket.broadcast.emit("webrtc_ice_candidate", data);
    }
  });

  // =========================================================================
  // Real-time Chat Messages — targeted to conversation members
  // =========================================================================

  socket.on("send_message", (data) => {
    const convId = data?.conversationId;
    const members = data?.conversation?.members;

    console.log(`[Socket.IO] Message relay for conv ${convId}`);

    if (members && Array.isArray(members) && members.length > 0) {
      // Targeted delivery: send only to conversation members (not sender)
      members.forEach((m) => {
        const uid = String(m.id || m.user_id || m.userId || "");
        if (uid && uid !== String(socket.userId)) {
          io.to(`user_${uid}`).emit("message", data);
        }
      });
    } else {
      // Fallback: broadcast to all
      socket.broadcast.emit("message", data);
    }
  });

  // Typing indicators
  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });

  // Read Cursor Updates
  socket.on("read_cursor_update", (data) => {
    socket.broadcast.emit("read_cursor_update", data);
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `[Socket.IO] Client disconnected: ${socket.id} (${reason})`
    );
    if (socket.userId) {
      const sockets = userSockets.get(socket.userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(socket.userId);
        }
      }
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[Socket.IO] Real-Time Signaling Server running on port ${PORT}`
  );
});
