import { Server } from 'socket.io';
import { createServer } from 'http';

// Types
interface AudioData extends ArrayBuffer {}

// Create HTTP server (needed for Socket.io)
const httpServer = createServer();

// Create a Socket.io server that listens on port 8080
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Define port
const PORT = 8080;

// Start the server
httpServer.listen(PORT, () => {
  console.log(`Socket.io server started on port ${PORT}`);
});

// Listen for socket connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Setup your socket.io event listeners here
  // These are placeholders for future OpenAI integration

  // Handle voice chunks (binary data)
  socket.on('voice_chunk', (data: AudioData) => {
    console.log('Received voice chunk, size:', data.byteLength);
    // Here we would process the audio and eventually send it to OpenAI
    // For now, just echo back a response for testing
    socket.emit('voice_response', data);
  });

  // Handle complete voice file
  socket.on('voice_file', (data: AudioData) => {
    console.log('Received complete voice file, size:', data.byteLength);
    // Here we would process the full audio and send it to OpenAI
    // For now, just echo back a response for testing
    socket.emit('voice_response', data);
  });
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
