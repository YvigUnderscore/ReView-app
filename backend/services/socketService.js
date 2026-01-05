const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware');

let io;

const init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*', // Allow all for now, or match frontend config
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    if (socket.handshake.query && socket.handshake.query.token) {
      jwt.verify(socket.handshake.query.token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded;
        next();
      });
    } else {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    // Join a room specific to the user so we can emit to them specifically
    socket.join(`user_${socket.user.id}`);

    socket.on('disconnect', () => {
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Emit to a specific user by their ID
const emitToUser = (userId, event, data) => {
  const ioInstance = getIo();
  ioInstance.to(`user_${userId}`).emit(event, data);
};

module.exports = { init, getIo, emitToUser };
