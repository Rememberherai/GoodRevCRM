'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const HEARTBEAT_INTERVAL = 10_000; // 10 seconds
const HEARTBEAT_TIMEOUT = 15_000; // 15 seconds — if no heartbeat, re-elect
const LS_KEY_PREFIX = 'browser_scheduler_leader_';

/**
 * Cross-tab leader election using BroadcastChannel (with localStorage fallback).
 * Only one tab will be elected leader at a time. Useful for ensuring only one
 * tab runs the browser scheduler.
 */
export function useLeaderElection(channelName: string, enabled: boolean) {
  const [isLeader, setIsLeader] = useState(false);
  const tabIdRef = useRef(crypto.randomUUID());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatRef = useRef(0);

  const lsKey = `${LS_KEY_PREFIX}${channelName}`;

  const claimLeadership = useCallback(() => {
    setIsLeader(true);
    // Broadcast to other tabs
    try {
      channelRef.current?.postMessage({ type: 'leader-claim', tabId: tabIdRef.current });
    } catch { /* channel may be closed */ }
    // Also write to localStorage for fallback
    try {
      localStorage.setItem(lsKey, JSON.stringify({ tabId: tabIdRef.current, ts: Date.now() }));
    } catch { /* localStorage may be unavailable */ }
  }, [lsKey]);

  const sendHeartbeat = useCallback(() => {
    try {
      channelRef.current?.postMessage({ type: 'heartbeat', tabId: tabIdRef.current });
    } catch { /* channel may be closed */ }
    try {
      localStorage.setItem(lsKey, JSON.stringify({ tabId: tabIdRef.current, ts: Date.now() }));
    } catch { /* ignore */ }
  }, [lsKey]);

  useEffect(() => {
    if (!enabled) {
      setIsLeader(false);
      return;
    }

    const tabId = tabIdRef.current;
    let hasBroadcastChannel = false;

    // Try BroadcastChannel
    try {
      const channel = new BroadcastChannel(channelName);
      channelRef.current = channel;
      hasBroadcastChannel = true;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'leader-claim' && data.tabId !== tabId) {
          // Another tab claimed leadership — we defer if their ID is higher
          if (data.tabId > tabId) {
            setIsLeader(false);
            lastHeartbeatRef.current = Date.now();
          }
        }

        if (data.type === 'heartbeat' && data.tabId !== tabId) {
          lastHeartbeatRef.current = Date.now();
          // If we thought we were leader but another tab is sending heartbeats with a higher ID, step down
          setIsLeader((prev) => {
            if (prev && data.tabId > tabId) return false;
            return prev;
          });
        }

        if (data.type === 'resign' && data.tabId !== tabId) {
          // The leader resigned — try to claim
          setTimeout(() => {
            claimLeadership();
          }, Math.random() * 500); // Small random delay to avoid thundering herd
        }
      };
    } catch {
      // BroadcastChannel not available — use localStorage only
    }

    // Check if there's an existing leader via localStorage
    let shouldClaim = true;
    try {
      const existing = localStorage.getItem(lsKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed.tabId !== tabId && Date.now() - parsed.ts < HEARTBEAT_TIMEOUT) {
          shouldClaim = false;
          lastHeartbeatRef.current = Date.now();
        }
      }
    } catch { /* ignore */ }

    if (shouldClaim) {
      claimLeadership();
    }

    // Leader sends heartbeats
    heartbeatTimerRef.current = setInterval(() => {
      setIsLeader((prev) => {
        if (prev) sendHeartbeat();
        return prev;
      });
    }, HEARTBEAT_INTERVAL);

    // Non-leader watches for stale leader
    watchdogTimerRef.current = setInterval(() => {
      setIsLeader((prev) => {
        if (prev) return prev; // We're already leader

        // Check if the current leader is stale
        const now = Date.now();
        if (now - lastHeartbeatRef.current > HEARTBEAT_TIMEOUT) {
          // Also check localStorage
          try {
            const existing = localStorage.getItem(lsKey);
            if (existing) {
              const parsed = JSON.parse(existing);
              if (now - parsed.ts > HEARTBEAT_TIMEOUT) {
                // Leader is stale — claim
                claimLeadership();
                return true;
              }
            } else {
              // No leader at all — claim
              claimLeadership();
              return true;
            }
          } catch {
            claimLeadership();
            return true;
          }
        }
        return prev;
      });
    }, HEARTBEAT_TIMEOUT / 2);

    // Resign on unload
    const handleUnload = () => {
      setIsLeader((prev) => {
        if (prev) {
          try {
            channelRef.current?.postMessage({ type: 'resign', tabId });
          } catch { /* ignore */ }
          try {
            localStorage.removeItem(lsKey);
          } catch { /* ignore */ }
        }
        return false;
      });
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
      if (hasBroadcastChannel) {
        try {
          channelRef.current?.close();
        } catch { /* ignore */ }
      }
      channelRef.current = null;
    };
  }, [enabled, channelName, lsKey, claimLeadership, sendHeartbeat]);

  return { isLeader, tabId: tabIdRef.current };
}
