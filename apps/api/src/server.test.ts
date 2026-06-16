import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as api from "./index.js";

interface ApiServerApp {
  listen: (options: { host: string; port: number }) => Promise<string>;
  close: () => Promise<void>;
}

interface ApiServerSignalSource {
  once: (signal: "SIGINT" | "SIGTERM", listener: () => void | Promise<void>) => void;
}

type ServerApiExports = typeof api & {
  startApiServer?: (config: {
    env: Record<string, string | undefined>;
    createApp: (config: { env: Record<string, string | undefined> }) => Promise<ApiServerApp>;
    signals: ApiServerSignalSource;
  }) => Promise<{ host: string; port: number; close: () => Promise<void> }>;
};

const serverApi = api as ServerApiExports;

describe("API server startup", () => {
  it("starts the production app on configured host and port with one-shot signal shutdown", async () => {
    const startApiServer = serverApi.startApiServer;
    expect(startApiServer).toBeTypeOf("function");
    if (startApiServer === undefined) {
      return;
    }

    const listenCalls: Array<{ host: string; port: number }> = [];
    let closeCount = 0;
    const signalHandlers: Partial<Record<"SIGINT" | "SIGTERM", () => void | Promise<void>>> = {};
    const app: ApiServerApp = {
      listen: async (options) => {
        listenCalls.push(options);
        return "listening";
      },
      close: async () => {
        closeCount += 1;
      }
    };
    const createAppCalls: Array<{ env: Record<string, string | undefined> }> = [];

    const server = await startApiServer({
      env: {
        DATABASE_URL: "postgres://production-db.example/the-nine",
        PERSONA_WEBHOOK_SECRET: "whsec_server",
        HOST: "127.0.0.1",
        PORT: "8080"
      },
      createApp: async (config) => {
        createAppCalls.push(config);
        return app;
      },
      signals: {
        once: (signal, listener) => {
          signalHandlers[signal] = listener;
        }
      }
    });

    expect(createAppCalls).toEqual([
      {
        env: {
          DATABASE_URL: "postgres://production-db.example/the-nine",
          PERSONA_WEBHOOK_SECRET: "whsec_server",
          HOST: "127.0.0.1",
          PORT: "8080"
        }
      }
    ]);
    expect(listenCalls).toEqual([{ host: "127.0.0.1", port: 8080 }]);
    expect(server).toEqual(expect.objectContaining({
      host: "127.0.0.1",
      port: 8080,
      close: expect.any(Function)
    }));

    await signalHandlers.SIGTERM?.();
    await signalHandlers.SIGINT?.();
    await server.close();

    expect(closeCount).toBe(1);
  });

  it("defaults to the ECS-compatible host and port", async () => {
    const startApiServer = serverApi.startApiServer;
    expect(startApiServer).toBeTypeOf("function");
    if (startApiServer === undefined) {
      return;
    }

    const listenCalls: Array<{ host: string; port: number }> = [];
    const server = await startApiServer({
      env: {
        DATABASE_URL: "postgres://production-db.example/the-nine",
        PERSONA_WEBHOOK_SECRET: "whsec_server"
      },
      createApp: async () => ({
        listen: async (options) => {
          listenCalls.push(options);
          return "listening";
        },
        close: async () => undefined
      }),
      signals: {
        once: () => undefined
      }
    });

    expect(server.host).toBe("0.0.0.0");
    expect(server.port).toBe(3000);
    expect(listenCalls).toEqual([{ host: "0.0.0.0", port: 3000 }]);
  });

  it("rejects invalid ports before creating the production app", async () => {
    const startApiServer = serverApi.startApiServer;
    expect(startApiServer).toBeTypeOf("function");
    if (startApiServer === undefined) {
      return;
    }

    await expect(
      startApiServer({
        env: {
          DATABASE_URL: "postgres://production-db.example/the-nine",
          PERSONA_WEBHOOK_SECRET: "whsec_server",
          PORT: "not-a-port"
        },
        createApp: async () => {
          throw new Error("createApp should not run with an invalid PORT.");
        },
        signals: {
          once: () => undefined
        }
      })
    ).rejects.toThrow("PORT must be an integer from 1 to 65535.");
  });

  it("declares the production build and start commands for the API package", async () => {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toBe("tsc -p tsconfig.json");
    expect(packageJson.scripts?.start).toBe("node dist/server.js");
  });
});
