import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const cfg = loadConfig();
const app = await buildApp({ logger: true });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "berhenti");
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: cfg.host, port: cfg.port });
app.log.info(`Nyebrang! server di http://${cfg.host}:${cfg.port} (client: ${cfg.clientDist}, db: ${cfg.dbPath})`);
