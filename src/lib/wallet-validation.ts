const SOLANA_WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateWalletAddress(address: string): string | null {
  if (!address || address.trim().length === 0) {
    return "Wallet address is required";
  }
  const trimmed = address.trim();
  if (!SOLANA_WALLET_REGEX.test(trimmed)) {
    return "Invalid Solana wallet address format";
  }
  return null;
}

export function sanitizeWallet(address: string): string {
  return address.trim();
}
