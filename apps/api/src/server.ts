import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { createApiProductionApp, type ApiProductionEnvironment } from "./production-app.js";

export interface ApiServerEnvironment extends ApiProductionEnvironment {
  HOST?: string;
  PORT?: string;
  [key: string]: string | undefined;
}

export interface ApiServerApp {
  listen: (options: { host: string; port: number }) => Promise<string>;
  close: () => Promise<void>;
}

export interface ApiServerSignalSource {
  once: (signal: "SIGINT" | "SIGTERM", listener: () => void | Promise<void>) => void;
}

export interface ApiServerConfig {
  env?: ApiServerEnvironment;
  createApp?: (config: { env: ApiServerEnvironment }) => Promise<ApiServerApp>;
  signals?: ApiServerSignalSource;
}

export interface ApiServerHandle {
  app: ApiServerApp;
  host: string;
  port: number;
  close: () => Promise<void>;
}

export async function startApiServer(config: ApiServerConfig = {}): Promise<ApiServerHandle> {
  const env = config.env ?? process.env;
  const host = readServerHost(env);
  const port = readServerPort(env);
  const createApp = config.createApp ?? createProductionServerApp;
  const signals = config.signals ?? process;
  const app = await createApp({ env });
  let closePromise: Promise<void> | null = null;
  const close = async (): Promise<void> => {
    closePromise ??= app.close();
    await closePromise;
  };

  await app.listen({ host, port });
  signals.once("SIGTERM", () => close());
  signals.once("SIGINT", () => close());

  return {
    app,
    host,
    port,
    close
  };
}

function readServerHost(env: ApiServerEnvironment): string {
  return env.HOST?.trim() || "0.0.0.0";
}

function readServerPort(env: ApiServerEnvironment): number {
  const rawPort = env.PORT?.trim() || "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }

  return port;
}

async function createProductionServerApp(config: { env: ApiServerEnvironment }): Promise<FastifyInstance> {
  return createApiProductionApp({ env: config.env });
}

function isDirectExecution(metaUrl: string, argvPath: string | undefined): boolean {
  if (argvPath === undefined) {
    return false;
  }

  return fileURLToPath(metaUrl) === resolve(argvPath);
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  startApiServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown API server startup failure.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
