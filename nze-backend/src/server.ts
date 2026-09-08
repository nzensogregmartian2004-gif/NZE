import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { initSocket } from "./realtime/socket.js";

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`🚀 NZE backend démarré sur http://localhost:${env.PORT} (HTTP + WebSocket)`);
});
