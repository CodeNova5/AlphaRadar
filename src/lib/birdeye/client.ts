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

export async function birdeyeGet<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${config.birdeye.baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

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
      console.error(`[Birdeye] ${endpoint} ${res.status} ${duration}ms`);
      throw new BirdeyeError(endpoint, res.status, res.statusText);
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
    if (err instanceof BirdeyeError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new BirdeyeError(endpoint, 0, "Request timed out");
    }
    throw new BirdeyeError(endpoint, 0, (err as Error).message);
  }
}
