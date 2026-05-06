export async function register() {
  // Only run in Node.js runtime (not Edge), and only in production or dev server.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  async function runScheduledSync() {
    try {
      const { loadNinjaRmmConfig, runNinjaRmmSync } = await import(
        "@/lib/ninjarmm/ninjarmm-sync"
      );
      const config = await loadNinjaRmmConfig();
      if (!config?.enabled) return;
      await runNinjaRmmSync();
    } catch (err) {
      console.error("[ninjarmm-sync] Scheduled run error:", err);
    }
  }

  // First run 30 s after startup (gives DB time to be ready)
  setTimeout(runScheduledSync, 30_000);
  // Then every 15 minutes
  setInterval(runScheduledSync, INTERVAL_MS);

  console.log(
    "[ninjarmm-sync] Scheduled sync registered (every 15 minutes)"
  );
}
