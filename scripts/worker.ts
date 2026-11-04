import "dotenv/config";
import { prisma } from "../src/lib/db";
import { processOutbox } from "../src/modules/notifications/dispatcher";
import { runRetention } from "../src/modules/retention/cleanup";

/**
 * Worker de notificaciones.
 *
 * Uso:
 *   npm run worker            # bucle cada 30 s
 *   npm run worker -- --once  # una pasada (CI, cron o pruebas manuales)
 */

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.OUTBOX_INTERVAL_MS ?? 30_000);
const retentionIntervalMs = 24 * 60 * 60 * 1000;
let lastRetention = 0;

async function retentionPass() {
  const now = Date.now();

  if (now - lastRetention < retentionIntervalMs) {
    return;
  }

  lastRetention = now;
  const result = await runRetention();

  console.log(
    `[retencion] anonimizados=${result.anonymizedClients} idempotencia=${result.purgedIdempotencyKeys} sesiones=${result.purgedSessions}`,
  );
}

async function pass() {
  const result = await processOutbox({ limit: 50 });

  if (result.processed > 0) {
    console.log(
      `[outbox] procesadas=${result.processed} enviadas=${result.sent} fallidas=${result.failed} omitidas=${result.skipped}`,
    );
  }
}

async function main() {
  if (once) {
    await pass();
    await prisma.$disconnect();
    return;
  }

  let running = true;

  const shutdown = async () => {
    running = false;
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("[outbox] worker iniciado");

  while (running) {
    try {
      await pass();
      await retentionPass();
    } catch (error) {
      console.error("[outbox] error en la pasada", error);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch(async (error) => {
  console.error("[outbox] error fatal", error);
  await prisma.$disconnect();
  process.exit(1);
});
