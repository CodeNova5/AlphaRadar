import { config } from "@/lib/config";

export class BirdeyeError extends Error {
  constructor(
    public endpoint: string,
    public status: number,
    message: string
  ) {
    super(`Birdeye ${endpoint}: ${status} - ${message}`);
    this.name = "BirdeyeError";
  }
}

interface BirdeyeRawResponse {
  success: boolean;
  data: unknown;
  message?: string;
}

const requestsPerSecond = Math.max(1, config.birdeye.requestsPerSecond || 1);
const minIntervalMs = Math.ceil(1000 / requestsPerSecond);

let requestChain = Promise.resolve();
let lastRequestStartedAt = 0;
let currentKeyIndex = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSlot(): Promise<void> {
  const run = async () => {
    const elapsed = Date.now() - lastRequestStartedAt;
    const delay = Math.max(0, minIntervalMs - elapsed);
    if (delay > 0) {
      await sleep(delay);
    }
    lastRequestStartedAt = Date.now();
  };

  const next = requestChain.then(run, run);
  requestChain = next.catch(() => undefined);
  await next;
}

async function birdeyeRequest<T>(
  method: "GET" | "POST",
  endpoint: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>
): Promise<T> {
  const url = new URL(`${config.birdeye.baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const maxAttempts = config.birdeye.apiKeys.length + 1;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await acquireSlot();

    const keyIndex = (attempt - 1) % config.birdeye.apiKeys.length;
    const apiKey = config.birdeye.apiKeys[keyIndex];
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers: {
          "X-API-KEY": apiKey,
          "x-chain": config.birdeye.defaultChain,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const duration = Date.now() - start;

      if (res.ok) {
        const json: BirdeyeRawResponse = await res.json();

        if (!json.success) {
          console.error(
            `[Birdeye] ${endpoint} API failure ${duration}ms: ${json.message}`
          );
          throw new BirdeyeError(endpoint, 0, json.message || "API returned success=false");
        }

        console.log(`[Birdeye] ${endpoint} ${duration}ms (key ${keyIndex + 1}/${config.birdeye.apiKeys.length})`);
        return json.data as T;
      }

      const status = res.status;
      console.error(`[Birdeye] ${endpoint} ${status} ${duration}ms (attempt ${attempt}/${maxAttempts}, key ${keyIndex + 1}/${config.birdeye.apiKeys.length})`);

      if (status === 429 && attempt < maxAttempts) {
        const waitMs = Math.min(1000 * attempt, 5000);
        await sleep(waitMs);
        continue;
      }

      throw new BirdeyeError(endpoint, status, res.statusText);
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof BirdeyeError) {
        lastError = err;
        if (err.status === 0 && attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }
        throw err;
      }

      if ((err as Error).name === "AbortError") {
        lastError = new BirdeyeError(endpoint, 0, "Request timed out");
        if (attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }
        throw lastError;
      }

      lastError = err as Error;
      if (attempt < maxAttempts) {
        await sleep(250 * attempt);
        continue;
      }

      throw new BirdeyeError(endpoint, 0, (err as Error).message);
    }
  }

  throw lastError || new BirdeyeError(endpoint, 0, "Birdeye request failed after retries");
}

export async function birdeyeGet<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  return birdeyeRequest<T>("GET", endpoint, params);
}

export async function birdeyePost<T>(
  endpoint: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
): Promise<T> {
  return birdeyeRequest<T>("POST", endpoint, params, body);
}
