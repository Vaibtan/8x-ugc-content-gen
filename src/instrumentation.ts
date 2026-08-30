import { runApp, verifyRuntimeConfiguration } from "@/lib/runtime";

/** Fail server startup with the Effect Config error instead of a later provider failure. */
export async function register() {
  await runApp(verifyRuntimeConfiguration).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Founder Voice configuration failed: ${detail}`);
  });
}
