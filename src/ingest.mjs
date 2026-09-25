#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ingestCableFromConfig } from "@causeway-services/koios-news-service-section/news/newscable";
const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "newscable.config.json");
const onSkip = (message)=>{
    process.stderr.write(`${message}\n`);
};
const results = await ingestCableFromConfig(configPath, {
    onSkip
});
for (const result of results){
    process.stdout.write(`${result.wire}: ${result.written} written, ${result.skipped} skipped${result.errors.length > 0 ? `, ${result.errors.length} errors` : ""}\n`);
}
