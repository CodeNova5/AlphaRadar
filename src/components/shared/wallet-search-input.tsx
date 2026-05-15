"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WalletSearchInput({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setError("Enter a wallet address");
      return;
    }
    if (trimmed.length < 32 || trimmed.length > 44) {
      setError("Invalid Solana address length");
      return;
    }
    setError("");
    router.push(`/wallet/${trimmed}`);
  };

  const heightClass = size === "lg" ? "h-14 text-lg" : size === "md" ? "h-11" : "h-9 text-sm";

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <input
        type="text"
        value={address}
        onChange={(e) => { setAddress(e.target.value); setError(""); }}
        placeholder="Enter Solana wallet address..."
        className={`flex-1 rounded-lg border border-card-border bg-card px-4 ${heightClass} text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-mono`}
      />
      <button
        type="submit"
        className={`rounded-lg bg-primary text-background font-semibold px-6 ${heightClass} hover:bg-primary-dim transition-colors`}
      >
        Analyze
      </button>
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
    </form>
  );
}
