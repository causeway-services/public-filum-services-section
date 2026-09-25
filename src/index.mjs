import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCableAppFromConfig } from "./cable-app.mjs";
export function createApp() {
    const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "newscable.config.json");
    return createCableAppFromConfig(configPath);
}
