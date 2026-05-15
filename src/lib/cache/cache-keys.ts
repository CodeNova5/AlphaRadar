export function walletProfileKey(wallet: string, window: string): string {
  return `wallet_profile:${wallet}:${window}`;
}

export function leaderboardKey(window: string): string {
  return `leaderboard:${window}`;
}

export function smartMoneyFeedKey(window: string): string {
  return `smart_money_feed:${window}`;
}

export function tokenMetadataKey(address: string): string {
  return `token_meta:${address}`;
}
