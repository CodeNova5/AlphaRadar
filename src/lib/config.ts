const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

export const config = {
  birdeye: {
    apiKey: required("BIRDEYE_API_KEY"),
    baseUrl: process.env.BIRDEYE_BASE_URL || "https://public-api.birdeye.so",
    defaultChain: process.env.DEFAULT_CHAIN || "solana",
  },
  supabase: {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  },
  admin: {
    refreshSecret: process.env.ADMIN_REFRESH_SECRET || "dev-secret",
  },
} as const;
