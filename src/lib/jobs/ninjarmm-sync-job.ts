import { runNinjaRmmSync } from "@/lib/ninjarmm/ninjarmm-sync";

const isDirectExecution =
  typeof require !== "undefined" && require.main === module;

if (isDirectExecution) {
  runNinjaRmmSync()
    .then((result) => {
      if (!result.success) {
        console.error("[ninjarmm-sync] Completed with errors:", result.errors);
        process.exit(1);
      }
      console.log("[ninjarmm-sync] Completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[ninjarmm-sync] Fatal error:", err);
      process.exit(1);
    });
}
