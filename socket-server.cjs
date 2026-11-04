const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'Finovo Socket.IO Signaling Server' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Finovo Real-Time Signaling Server Active');
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('register_user', (userId) => {
    socket.userId = String(userId);
    socket.join(`user_${userId}`);
    console.log(`[Socket.IO] Socket ${socket.id} registered as User ${userId}`);
  });

  // Call Initiation Signaling
  socket.on('call_initiate', (signal) => {
    console.log(`[Socket.IO] Call initiated:`, {
      callId: signal.callId,
      callerId: signal.callerId,
      callerName: signal.callerName,
      receiverUserId: signal.receiverUserId,
      isVideo: signal.isVideo,
    });

    // Broadcast incoming_call to all other connected clients
    socket.broadcast.emit('incoming_call', signal);

    // If targeted to a specific receiver room
    if (signal.receiverUserId) {
      io.to(`user_${signal.receiverUserId}`).emit('incoming_call', signal);
    }
  });

  // Call Answer Signaling
  socket.on('call_answer', (data) => {
    console.log(`[Socket.IO] Call answered:`, data);
    socket.broadcast.emit('call_answered', data);
  });

  // Call Decline Signaling
  socket.on('call_declined', (data) => {
    console.log(`[Socket.IO] Call declined:`, data);
    socket.broadcast.emit('call_declined', data);
    socket.broadcast.emit('call_ended', { ...data, reason: 'declined' });
  });

  // Call End / Hangup Signaling
  socket.on('call_end', (data) => {
    console.log(`[Socket.IO] Call ended:`, data);
    socket.broadcast.emit('call_ended', data);
  });

  // Real-time Chat Messages
  socket.on('send_message', (data) => {
    console.log(`[Socket.IO] Message relay for conv ${data?.conversationId}`);
    socket.broadcast.emit('message', data);
  });

  // Typing indicators
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

  // Read Cursor Updates
  socket.on('read_cursor_update', (data) => {
    socket.broadcast.emit('read_cursor_update', data);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Socket.IO] Real-Time Signaling Server running on port ${PORT}`);
});

