"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@/context/wallet-context";

/**
 * Detects when a wallet account exists but the signer has been lost
 * (e.g. after tab sleep or extension context invalidation) and
 * automatically attempts one re-enablement.
 *
 * Ported from TrustedStake staking UI reliability patterns.
 */
export function useWalletAutoReconnect() {
  const { selectedAccount, getSigner, isConnected } = useWallet();
  const refreshAttemptedRef = useRef(false);

  useEffect(() => {
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

    // Reason: Signer is missing despite being connected — likely context
    // invalidation. Re-dispatching a focus event nudges the visibility
    // handler in wallet-context to re-enable the extension.
    document.dispatchEvent(new Event("visibilitychange"));
  }, [isConnected, selectedAccount, getSigner]);
}
