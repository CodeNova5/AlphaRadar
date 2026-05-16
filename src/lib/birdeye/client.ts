import { config } from "@/lib/config";

const BIRDEYE_MIN_INTERVAL_MS = Number(process.env.BIRDEYE_MIN_INTERVAL_MS || "1000");
const BIRDEYE_MAX_RETRIES = Number(process.env.BIRDEYE_MAX_RETRIES || "2");
const BIRDEYE_RETRY_BASE_MS = Number(process.env.BIRDEYE_RETRY_BASE_MS || "500");
const BIRDEYE_DISABLE_TTL_MS = Number(process.env.BIRDEYE_DISABLE_TTL_MS || "1800000");

let birdeyeQueue: Promise<void> = Promise.resolve();
let nextBirdeyeRequestAt = 0;
const temporarilyDisabledEndpoints = new Map<
  string,
  { status: number; until: number; reason: string }
>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBirdeyeRateLimitSlot(): Promise<void> {
  // Serialize all Birdeye calls in-process so starts are spaced by at least the interval.
  let release!: () => void;
  const previous = birdeyeQueue.catch(() => undefined);
  birdeyeQueue = new Promise<void>((resolve) => {
    release = () => resolve();
  });

  await previous;

  const now = Date.now();
  const waitMs = Math.max(0, nextBirdeyeRequestAt - now);
  if (waitMs > 0) {
    await sleep(waitMs);
  }

  nextBirdeyeRequestAt = Date.now() + Math.max(0, BIRDEYE_MIN_INTERVAL_MS);
  release();
}

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

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isNaN(dateMs)) return null;

  return Math.max(0, dateMs - Date.now());
}

function getDisableReason(endpoint: string): { status: number; reason: string } | null {
  const disabled = temporarilyDisabledEndpoints.get(endpoint);
  if (!disabled) return null;

  if (Date.now() >= disabled.until) {
    temporarilyDisabledEndpoints.delete(endpoint);
    return null;
  }

  return { status: disabled.status, reason: disabled.reason };
}

function markTemporarilyDisabled(endpoint: string, status: number, reason: string): void {
  if (status !== 401 && status !== 403 && status !== 404) return;

  temporarilyDisabledEndpoints.set(endpoint, {
    status,
    reason,
    until: Date.now() + BIRDEYE_DISABLE_TTL_MS,
  });
}

export async function birdeyeGet<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const disabled = getDisableReason(endpoint);
  if (disabled) {
    throw new BirdeyeError(
      endpoint,
      disabled.status,
      `Endpoint temporarily disabled due to earlier ${disabled.status}: ${disabled.reason}`
    );
  }

  const url = new URL(`${config.birdeye.baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  let attempt = 0;
  for (; attempt <= BIRDEYE_MAX_RETRIES; attempt++) {
    await waitForBirdeyeRateLimitSlot();

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

      if (!res.ok) {
        let message = res.statusText;
        try {
          const maybeJson = (await res.json()) as { message?: string; error?: string };
          message = maybeJson.message || maybeJson.error || message;
        } catch {
          // Ignore body parse errors and fall back to status text.
        }

        console.error(`[Birdeye] ${endpoint} ${res.status} ${duration}ms`);
        markTemporarilyDisabled(endpoint, res.status, message);

        if (res.status === 429 && attempt < BIRDEYE_MAX_RETRIES) {
          const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
          const fallbackBackoff = BIRDEYE_RETRY_BASE_MS * Math.pow(2, attempt);
          const backoffMs = retryAfterMs ?? fallbackBackoff;
          await sleep(Math.max(0, backoffMs));
          continue;
        }

        throw new BirdeyeError(endpoint, res.status, message);
      }

      const json: BirdeyeRawResponse = await res.json();

      if (!json.success) {
        console.error(
          `[Birdeye] ${endpoint} API failure ${duration}ms: ${json.message}`
        );
        throw new BirdeyeError(endpoint, 0, json.message || "API returned success=false");
      }

      console.log(`[Birdeye] ${endpoint} ${duration}ms`);
      return json.data as T;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof BirdeyeError) {
        throw err;
      }

      if ((err as Error).name === "AbortError") {
        if (attempt < BIRDEYE_MAX_RETRIES) {
          const backoffMs = BIRDEYE_RETRY_BASE_MS * Math.pow(2, attempt);
          await sleep(backoffMs);
          continue;
        }
        throw new BirdeyeError(endpoint, 0, "Request timed out");
      }

      if (attempt < BIRDEYE_MAX_RETRIES) {
        const backoffMs = BIRDEYE_RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(backoffMs);
        continue;
      }

      throw new BirdeyeError(endpoint, 0, (err as Error).message);
    }
  }

  throw new BirdeyeError(endpoint, 0, `Failed after ${attempt} attempts`);
}
