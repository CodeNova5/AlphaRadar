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

const requestsPerSecond = Math.max(1, config.birdeye.requestsPerSecond || 3);
const minIntervalMs = Math.ceil(1000 / requestsPerSecond);

let requestChain = Promise.resolve();
let lastRequestStartedAt = 0;

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

export async function birdeyeGet<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${config.birdeye.baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await acquireSlot();

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-API-KEY": config.birdeye.apiKey,
          "x-chain": config.birdeye.defaultChain,
          "Content-Type": "application/json",
        },
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

        console.log(`[Birdeye] ${endpoint} ${duration}ms`);
        return json.data as T;
      }

      const status = res.status;
      console.error(`[Birdeye] ${endpoint} ${status} ${duration}ms`);

      if (status === 429 && attempt < maxAttempts) {
        await sleep(250 * attempt);
        continue;
      }

      throw new BirdeyeError(endpoint, status, res.statusText);
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof BirdeyeError) {
        if (err.status === 0 && attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }
        throw err;
      }

      if ((err as Error).name === "AbortError") {
        if (attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }
        throw new BirdeyeError(endpoint, 0, "Request timed out");
      }

      if (attempt < maxAttempts) {
        await sleep(250 * attempt);
        continue;
      }

      throw new BirdeyeError(endpoint, 0, (err as Error).message);
    }
  }

  throw new BirdeyeError(endpoint, 0, "Birdeye request failed after retries");
}
