#!/usr/bin/env node
import process from "node:process";
import { startNativeApplication as start } from "@red-cup-engineering/computer-web-server/native-application";
import { installGracefulShutdown } from "@red-cup-engineering/http-services-section/node-server";
import { createApp } from "./index.mjs";
const envPort = process.env["PORT"] ? Number(process.env["PORT"]) : undefined;
const port = envPort !== undefined && Number.isSafeInteger(envPort) ? envPort : 0;
const host = process.env["HOST"] ?? "127.0.0.1";
const result = await start(await createApp(), {
    host,
    port
});
installGracefulShutdown(result);
process.stdout.write(`filum cable listening at http://${host}:${result.port}/\n`);
