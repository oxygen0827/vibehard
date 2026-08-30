export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionDatabaseConfigured } = await import("@/lib/db");
    try {
      assertProductionDatabaseConfigured();
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  }
}
