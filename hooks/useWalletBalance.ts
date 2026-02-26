'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTaoBalance, fetchAlphaBalance } from '@/lib/bittensor';

export interface WalletBalances {
  tao: number | null;
  alpha: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<{ tao: number | null; alpha: number | null }>;
}

/**
 * React hook that queries the Bittensor chain for a wallet's TAO and Alpha balances.
 *
 * TAO balance is always fetched when an address is provided.
 * Alpha balance is fetched only when both address and netuid are provided.
 * Balances refresh automatically when address or netuid change, and can be
 * re-fetched on demand via `refetch()` (e.g. right before placing an order).
 *
 * Args:
 *   ss58Address (string | undefined): Wallet SS58 address.
 *   netuid (number | undefined): Subnet ID for Alpha balance lookup.
 *   enabled (boolean): Whether the hook should actively fetch (default true).
 *
 * Returns:
 *   WalletBalances: { tao, alpha, isLoading, error, refetch }
 */
export function useWalletBalance(
  ss58Address?: string,
  netuid?: number,
  enabled = true,
): WalletBalances {
  const [tao, setTao] = useState<number | null>(null);
  const [alpha, setAlpha] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reason: Track the latest request so stale responses from slow queries
  // don't overwrite fresher results after address/netuid changes.
  const requestIdRef = useRef(0);

  const fetchBalances = useCallback(async (): Promise<{ tao: number | null; alpha: number | null }> => {
    if (!ss58Address) {
      setTao(null);
      setAlpha(null);
      return { tao: null, alpha: null };
    }

    const id = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const promises: [Promise<number>, Promise<number> | null] = [
        fetchTaoBalance(ss58Address),
        netuid != null && netuid > 0 ? fetchAlphaBalance(ss58Address, netuid) : null,
      ];

      const [taoResult, alphaResult] = await Promise.all([
        promises[0],
        promises[1] ?? Promise.resolve(null),
      ]);

      // Only apply if this is still the latest request
      if (id === requestIdRef.current) {
        const taoVal = typeof taoResult === 'number' ? taoResult : null;
        const alphaVal = typeof alphaResult === 'number' ? alphaResult : null;
        setTao(taoVal);
        setAlpha(alphaVal);
        setIsLoading(false);
        return { tao: taoVal, alpha: alphaVal };
      }
      return { tao: null, alpha: null };
    } catch (err) {
      if (id === requestIdRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch balance';
        console.warn('[useWalletBalance]', msg);
        setError(msg);
        setIsLoading(false);
      }
      return { tao: null, alpha: null };
    }
  }, [ss58Address, netuid]);

  useEffect(() => {
    if (!enabled || !ss58Address) {
      setTao(null);
      setAlpha(null);
      setIsLoading(false);
      return;
    }
    fetchBalances();
  }, [enabled, ss58Address, netuid, fetchBalances]);

  return { tao, alpha, isLoading, error, refetch: fetchBalances };
}
