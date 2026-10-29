import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const DEFAULT_PAUSE_FILE_NAME = ".dev-pause";

// Deliberately no exported "clear" function. Per spec/005 section 2.3's
// circuit breaker, only a human may clear a pause -- the runner never
// auto-clears one. Not exposing a clear API here means the runner's own
// code has no path that could do it by accident; a human clears it by
// deleting the file directly, which needs no special tooling.

export function isPaused(pauseFilePath) {
  return existsSync(pauseFilePath);
}

export function writePause(pauseFilePath, reason) {
  mkdirSync(dirname(pauseFilePath), { recursive: true });
  writeFileSync(
    pauseFilePath,
    `${JSON.stringify({ reason, pausedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}
