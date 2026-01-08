const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let io;

const init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*', // Allow all for now, or match frontend config
      methods: ['GET', 'POST']
    }
  });

  io.use(async (socket, next) => {
    if (socket.handshake.query && socket.handshake.query.token) {
      const token = socket.handshake.query.token;

      // Try JWT first
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (!err && decoded) {
            socket.user = decoded;
            return next();
        }

        // If JWT fails, check if it's a Client Token
        prisma.project.findFirst({ where: { clientToken: token } })
            .then(project => {
                if (project) {
                    socket.clientProject = project; // Tag socket as client guest for this project
                    // Assign a unique guest ID to prevent room collisions
                    socket.user = { id: `guest_${socket.id}`, role: 'guest', name: 'Guest' };
                    return next();
                } else {
                    return next(new Error('Authentication error'));
                }
            })
            .catch(e => {
                console.error("Socket auth db error:", e);
                return next(new Error('Authentication error'));
            });
      });
    } else {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    // Join a room specific to the user so we can emit to them specifically
    // Guests use a unique ID (guest_SOCKETID), so they get a unique room too, which is fine (safe).
    if (socket.user) {
        socket.join(`user_${socket.user.id}`);
    }

    // If Guest Client, automatically join the project room
    if (socket.clientProject) {
        socket.join(`project_${socket.clientProject.id}`);
    }

    // Handle room joining
    socket.on('join_room', (room) => {
      // Allow admin to join admin_stats room
      if (room === 'admin_stats' && socket.user && socket.user.role === 'admin') {
        socket.join(room);
      }
    });

    // Handle joining project room
    socket.on('join_project', (projectId) => {
        if (projectId) {
            // Check access?
            // If normal user, assume they have access (checked by frontend/api usually, but socket ideally should check too)
            // If guest, they are already joined to their specific project.
            // If guest tries to join ANOTHER project, we should block.
            if (socket.clientProject) {
                if (parseInt(projectId) === socket.clientProject.id) {
                    // Already joined or allow re-join
                    socket.join(`project_${projectId}`);
                }
            } else {
                // Regular user
                socket.join(`project_${projectId}`);
            }
        }
    });

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
