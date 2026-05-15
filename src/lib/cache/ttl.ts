export const TTL = {
  walletProfile: 20 * 60 * 1000,       // 20 min
  holdings: 3 * 60 * 1000,             // 3 min
  netWorth: 30 * 60 * 1000,            // 30 min
  tokenMetadata: 24 * 60 * 60 * 1000,  // 24h
  firstFunded: 7 * 24 * 60 * 60 * 1000, // 7 days
  leaderboard: 15 * 60 * 1000,         // 15 min
  smartMoneyFeed: 10 * 60 * 1000,      // 10 min
  tokenMarketData: 2 * 60 * 1000,      // 2 min
  tokenSecurity: 30 * 60 * 1000,       // 30 min
} as const;

export function isFresh(updatedAt: string | null, ttlMs: number): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < ttlMs;
}

export function isStale(updatedAt: string | null, ttlMs: number): boolean {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() >= ttlMs;
}
