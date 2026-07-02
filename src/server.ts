#!/usr/bin/env node
// Thin bin dispatcher. ZERO static imports here — ESM hoists them before any
// guard runs, which would fire server-init side effects even for `init`.
// All real server logic lives in ./server-main.js, loaded via dynamic import
// only on the non-init path.
if (process.argv[2] === "init") {
  const { runInitWizard } = await import("./cli/init.js");
  await runInitWizard();
  process.exit(0);
} else {
  await import("./server-main.js");
}
