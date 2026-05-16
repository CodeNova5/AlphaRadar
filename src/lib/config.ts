const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

const getApiKeys = (): string[] => {
  const keys: string[] = [required("BIRDEYE_API_KEY")];
  if (process.env.BIRDEYE_API_KEY2) keys.push(process.env.BIRDEYE_API_KEY2);
  if (process.env.BIRDEYE_API_KEY3) keys.push(process.env.BIRDEYE_API_KEY3);
  return keys;
};

export const config = {
  birdeye: {
    apiKeys: getApiKeys(),
    apiKey: required("BIRDEYE_API_KEY"),
    baseUrl: process.env.BIRDEYE_BASE_URL || "https://public-api.birdeye.so",
    defaultChain: process.env.DEFAULT_CHAIN || "solana",
    requestsPerSecond: Number(process.env.BIRDEYE_REQUESTS_PER_SECOND || "1"),
  },
  supabase: {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  admin: {
    refreshSecret: process.env.ADMIN_REFRESH_SECRET || "dev-secret",
  },
} as const;
