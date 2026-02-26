"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useWallet } from "@/context/wallet-context";

/**
 * Detects when a wallet account exists but the signer has been lost
 * (e.g. after tab sleep or extension context invalidation) and
 * automatically refreshes it.
 *
 * Returns `isRefreshingSigner` so the UI can show a brief
 * "Refreshing wallet.." indicator instead of a generic connecting banner.
 */
export function useWalletAutoReconnect() {
  const { selectedAccount, getSigner, isConnected, refreshSigner } = useWallet();
  const [isRefreshingSigner, setIsRefreshingSigner] = useState(false);
  const refreshAttemptedRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

  const doRefresh = useCallback(async () => {
    setIsRefreshingSigner(true);
    try {
      await refreshSigner();
    } finally {
      setIsRefreshingSigner(false);
    }
  }, [refreshSigner]);

  useEffect(() => {
    const address = selectedAccount?.address ?? null;

    if (address !== lastAddressRef.current) {
      lastAddressRef.current = address;
      refreshAttemptedRef.current = false;
    }

    if (!isConnected || !selectedAccount) {
      refreshAttemptedRef.current = false;
      return;
    }

    const signer = getSigner();
    if (signer) {
      refreshAttemptedRef.current = false;
      return;
    }

    if (refreshAttemptedRef.current) return;
    refreshAttemptedRef.current = true;

    doRefresh();
  }, [isConnected, selectedAccount, getSigner, doRefresh]);

  return { isRefreshingSigner };
}
