export type Freshness = "fresh" | "cached" | "stale";

export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  warnings?: string[];
  freshness?: Freshness;
  generatedAt?: string;
  source?: string;
  error?: string;
}

export function success<T>(
  data: T,
  opts?: {
    warnings?: string[];
    freshness?: Freshness;
    generatedAt?: string;
    source?: string;
  }
): ApiResponse<T> {
  return {
    ok: true,
    data,
    ...opts,
  };
}

export function fail(
  error: string,
  opts?: { warnings?: string[] }
): ApiResponse<null> {
  return {
    ok: false,
    data: null,
    error,
    ...opts,
  };
}
