import { createServer } from 'http';
import { setupOpenAISocket } from './oai-realtime';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
const PORT = 8080;

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const sessions = new Map<
  string,
  { ws: WebSocket; sendAudioBuffer: (audioBuffer: ArrayBuffer) => void }
>();

io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  const {
    ws,
    sendAudioBuffer,
    disconnect: oaiDisconnect,
  } = await setupOpenAISocket((sessionId, ws) => {
    sessions.set(sessionId, { ws, sendAudioBuffer });
  });

  socket.on('disconnect', () => {
    oaiDisconnect();
    console.log('Client disconnected:', socket.id);
  });
});
