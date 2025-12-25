// Tasks page (Base): buy a post-token for BUY_AMOUNT_USDC_DISPLAY, onchain verification via balanceOf
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import Avatar from '@/components/Avatar';
import InAppBrowserModal from '@/components/InAppBrowserModal';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import type { LinkSubmission } from '@/types';
import { useAccount, usePublicClient, useReadContracts } from 'wagmi';
import { erc20Abi, parseEther, parseUnits, type Address } from 'viem';
import { BUY_AMOUNT_USDC_DECIMAL, BUY_AMOUNT_USDC_DISPLAY, REQUIRED_BUYS_TO_PUBLISH } from '@/lib/app-config';
import { useSwapToken, useIsInMiniApp } from '@coinbase/onchainkit/minikit';
import { baseAppContentUrlFromTokenAddress } from '@/lib/base-content';

const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const BUY_AMOUNT_USDC = parseUnits(BUY_AMOUNT_USDC_DECIMAL, 6);

function buildBaseAppSwapUrl(opts: { inputToken: Address; outputToken: Address; exactAmount: string; returnUrl?: string }): string {
  const u = new URL('https://base.app/swap');
  // Best-effort Uniswap-like params. Unknown params are typically ignored.
  u.searchParams.set('inputCurrency', opts.inputToken);
  u.searchParams.set('outputCurrency', opts.outputToken);
  u.searchParams.set('exactField', 'input');
  u.searchParams.set('exactAmount', opts.exactAmount);
  if (opts.returnUrl) {
    // Different hosts use different names; include a few common ones.
    u.searchParams.set('returnUrl', opts.returnUrl);
    u.searchParams.set('redirectUrl', opts.returnUrl);
    u.searchParams.set('redirect_uri', opts.returnUrl);
  }
  return u.toString();
}

const PENDING_SWAP_KEY = 'mtb_pending_swap_v1';

const postTokenBuyAbi = [
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

function isAddress(value?: string): value is Address {
  return !!value && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function compactUrl(url: string): string {
  try {
    const u = new URL(url);
    // base.app/content/... is very long; show a compact host+path prefix
    const path = (u.pathname || '/').replace(/\/{2,}/g, '/');
    const compact = `${u.host}${path}`;
    // Show only the beginning (avoid tall cards from long URLs)
    return compact.length > 48 ? `${compact.slice(0, 48)}…` : compact;
  } catch {
    return url;
  }
}

function shortHex(addr: string): string {
  if (!addr) return '';
  const a = addr.toString();
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function TasksPage() {
  const router = useRouter();
  const { user, isInitialized } = useFarcasterAuth();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  // const { writeContractAsync } = useWriteContract();
  const { swapTokenAsync } = useSwapToken();
  const { isInMiniApp } = useIsInMiniApp();

  const [links, setLinks] = useState<LinkSubmission[]>([]);
  const [completedLinkIds, setCompletedLinkIds] = useState<string[]>([]);
  // UX: show full-screen loader only on the very first load.
  // Background refreshes (focus/visibility) should NOT blank the whole page (causes "jitter").
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [buyingLinkId, setBuyingLinkId] = useState<string | null>(null);
  const [errorByLinkId, setErrorByLinkId] = useState<Record<string, string>>({});
  const [noticeByLinkId, setNoticeByLinkId] = useState<Record<string, string>>({});
  const [postModalUrl, setPostModalUrl] = useState<string | null>(null);
  const handledReturnRef = useRef(false);

  // Always operate in "support" mode (buy posts)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('selected_activity', 'support');
  }, []);

  // Cache buster for in-app WebViews: ensure we don't get stuck on an old cached HTML/JS bundle.
  // Only runs once per URL (adds ?v=... if missing).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const u = new URL(window.location.href);
      if (!u.searchParams.has('v')) {
        u.searchParams.set('v', Date.now().toString());
        window.location.replace(u.toString());
      }
    } catch {
      // ignore
    }
  }, []);

  const hasFid = typeof user?.fid === 'number' && Number.isFinite(user.fid) && user.fid > 0;
  const effectiveAddress: Address | undefined = useMemo(() => {
    if (address && isAddress(address)) return address;
    const ua = user?.address;
    if (typeof ua === 'string' && isAddress(ua)) return ua as Address;
    return undefined;
  }, [address, user?.address]);

  const tokenContracts = useMemo(() => {
    if (!effectiveAddress) return [];
    return links
      .filter((l) => isAddress(l.token_address))
      .map((l) => ({
        address: l.token_address as Address,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [effectiveAddress] as const,
      }));
  }, [links, effectiveAddress]);

  const { data: balances, refetch: refetchBalances } = useReadContracts({
    contracts: tokenContracts,
    query: {
      enabled: !!effectiveAddress && tokenContracts.length > 0,
    },
  });

  const refresh = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setInitialLoading(true);
    else setRefreshing(true);
    try {
      // Always load links (they are global, not user-specific)
      const linksRes = await fetch(`/api/tasks?t=${Date.now()}&taskType=support`);
      const linksJson = await linksRes.json();
      const nextLinks: LinkSubmission[] = Array.isArray(linksJson.links) ? linksJson.links : [];
      setLinks((prev) => {
        if (prev.length === nextLinks.length && prev.every((p, i) => p.id === nextLinks[i]?.id)) {
          return prev;
        }
        return nextLinks;
      });

      // Load per-user progress only when we have a real fid (MiniKit/Base App)
      if (hasFid) {
        const progressRes = await fetch(`/api/user-progress?userFid=${user!.fid}&t=${Date.now()}`);
        const progressJson = await progressRes.json();
        const progress = progressJson.progress || null;
        const nextCompleted: string[] = Array.isArray(progress?.completed_links) ? progress.completed_links : [];
        setCompletedLinkIds((prev) => {
          if (prev.length === nextCompleted.length && prev.every((p, i) => p === nextCompleted[i])) {
            return prev;
          }
          return nextCompleted;
        });
      } else {
        setCompletedLinkIds((prev) => (prev.length ? [] : prev));
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  const markCompleted = useCallback(
    async (linkId: string) => {
      if (hasFid) {
        await fetch('/api/mark-completed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userFid: user?.fid, linkId }),
        });
      }
      setCompletedLinkIds((prev) => (prev.includes(linkId) ? prev : [...prev, linkId]));
      try {
        refetchBalances();
      } catch {
        // ignore
      }
      setErrorByLinkId((p) => ({ ...p, [linkId]: '' }));
      setNoticeByLinkId((p) => {
        const next = { ...p };
        delete next[linkId];
        return next;
      });
    },
    [hasFid, refetchBalances, user?.fid]
  );

  const syncPendingSwap = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!publicClient) return;
    const addr = effectiveAddress;
    if (!addr) return;

    const raw = window.sessionStorage.getItem(PENDING_SWAP_KEY);
    if (!raw) return;

    let pending: { linkId: string; tokenAddress: string; startedAt: number } | null = null;
    try {
      pending = JSON.parse(raw);
    } catch {
      pending = null;
    }
    if (!pending?.linkId || !pending?.tokenAddress) {
      window.sessionStorage.removeItem(PENDING_SWAP_KEY);
      return;
    }

    if (!isAddress(pending.tokenAddress)) {
      window.sessionStorage.removeItem(PENDING_SWAP_KEY);
      return;
    }

    try {
      const balNow = await publicClient.readContract({
        address: pending.tokenAddress as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [addr],
      });
      if (balNow > 0n) {
        window.sessionStorage.removeItem(PENDING_SWAP_KEY);
        await markCompleted(pending.linkId);
        return;
      }
    } catch {
      // ignore and continue to best-effort polling
    }

    setRefreshing(true);
    setNoticeByLinkId((p) => ({ ...p, [pending.linkId]: 'Welcome back — syncing your purchase…' }));
    try {
      let newBal = 0n;
      const started = Date.now();
      while (Date.now() - started < 60_000) {
        await new Promise((r) => setTimeout(r, 2500));
        newBal = await publicClient.readContract({
          address: pending.tokenAddress as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [addr],
        });
        if (newBal > 0n) break;
      }
      if (newBal > 0n) {
        window.sessionStorage.removeItem(PENDING_SWAP_KEY);
        await markCompleted(pending.linkId);
      }
    } finally {
      setRefreshing(false);
    }
  }, [effectiveAddress, markCompleted, publicClient]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.push('/');
      return;
    }

    refresh();

    // Убираем polling (страница не должна "дёргаться" каждые 5 секунд).
    // Обновляем данные только при возврате во вкладку/приложение.
    const onFocus = () => {
      refresh({ silent: true });
      // also resync on-chain balances (BOUGHT state) after wallet redirect
      try {
        refetchBalances();
      } catch {
        // ignore
      }
      syncPendingSwap();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh({ silent: true });
        try {
          refetchBalances();
        } catch {
          // ignore
        }
        syncPendingSwap();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user?.fid, refetchBalances, syncPendingSwap]);

  const balanceByToken = useMemo(() => {
    const map = new Map<string, bigint>();
    if (!balances) return map;
    tokenContracts.forEach((c, idx) => {
      const token = c.address.toLowerCase();
      const r: any = balances[idx];
      const v = r?.result;
      if (typeof v === 'bigint') map.set(token, v);
    });
    return map;
  }, [balances, tokenContracts]);

  const ownedLinkIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of links) {
      if (!isAddress(l.token_address)) continue;
      const bal = balanceByToken.get(l.token_address.toLowerCase()) ?? 0n;
      if (bal > 0n) ids.add(l.id);
    }
    return ids;
  }, [links, balanceByToken]);

  const completedCount = useMemo(() => {
    // Count progress only within the current batch (the 5 links shown on screen),
    // and never show more than REQUIRED_BUYS_TO_PUBLISH.
    const currentIds = new Set<string>(links.map((l) => l.id));
    const ids = new Set<string>();
    for (const id of completedLinkIds) {
      if (currentIds.has(id)) ids.add(id);
    }
    for (const id of ownedLinkIds) {
      if (currentIds.has(id)) ids.add(id);
    }
    return Math.min(ids.size, REQUIRED_BUYS_TO_PUBLISH);
  }, [completedLinkIds, ownedLinkIds, links]);

  const remainingToBuyCount = useMemo(() => {
    let c = 0;
    for (const l of links) {
      if (!isAddress(l.token_address)) continue;
      const bal = balanceByToken.get(l.token_address.toLowerCase()) ?? 0n;
      const owned = bal > 0n;
      const completedByProgress = completedLinkIds.includes(l.id);
      const completed = completedByProgress || owned;
      if (!completed) c++;
    }
    return c;
  }, [links, balanceByToken, completedLinkIds]);

  // Clean UI: if a post is already DONE/BOUGHT, remove any lingering notices/errors.
  useEffect(() => {
    const completed = new Set<string>(completedLinkIds);
    for (const id of ownedLinkIds) completed.add(id);

    setNoticeByLinkId((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const id of completed) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setErrorByLinkId((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const id of completed) {
        if (next[id]) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [completedLinkIds, ownedLinkIds]);

  const canPublish = completedCount >= REQUIRED_BUYS_TO_PUBLISH && hasFid;

  const handleBuy = async (link: LinkSubmission) => {
    const addr = effectiveAddress;
    if (!addr) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Connect your wallet first.' }));
      return;
    }
    // In some WebViews chainId can be undefined; only block when we *know* it's not Base.
    if (chainId && chainId !== 8453) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Switch network to Base (8453).' }));
      return;
    }
    if (!isAddress(link.token_address)) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'This post has an invalid token address.' }));
      return;
    }
    if (!publicClient) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Public client is not available.' }));
      return;
    }
    // Note: isInMiniApp can be undefined/false-positive in some Base App WebViews.
    // Don't hard-block on it; attempt to open Trade and handle errors gracefully.

    setErrorByLinkId((p) => ({ ...p, [link.id]: '' }));
    setNoticeByLinkId((p) => ({ ...p, [link.id]: '' }));
    setBuyingLinkId(link.id);

    try {
      setNoticeByLinkId((p) => ({ ...p, [link.id]: 'Opening Trade…' }));
      // Preflight: user needs BUY_AMOUNT_USDC_DISPLAY USDC for the swap.
      // Gas is usually paid in Base ETH; in Base App it can sometimes be paid in USDC (wallet feature).
      const [ethBalance, usdcBalance] = await Promise.all([
        publicClient.getBalance({ address: addr }),
        publicClient.readContract({
          address: USDC_CONTRACT_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [addr],
        }),
      ]);

      if (usdcBalance < BUY_AMOUNT_USDC) {
        throw new Error(`Not enough USDC. You need at least ${BUY_AMOUNT_USDC_DISPLAY} USDC on Base.`);
      }
      // Gas UX: warn early, but don't hard-block (Base App may support paying gas in USDC).
      if (ethBalance < parseEther('0.00001')) {
        setNoticeByLinkId((p) => ({
          ...p,
          [link.id]:
            'Note: network fee (gas) is usually paid in Base ETH. In Base App you may be able to pay gas in USDC—if you see that option in the confirmation screen.',
        }));
      }

      // BUY flow for Base App tokens:
      // base.app tokens are typically purchased via Swap (USDC -> token), not via token.buy().
      // So we open the swap form pre-selected; some wallets may not prefill the amount, user may need to type it.
      // UX requirement: after each buy, user must be able to return to this app on the same Tasks screen.
      // Prefer opening Trade in a new tab/in-app browser (closing it returns here without losing state).
      let openedExternal = false;
      if (typeof window !== 'undefined') {
        const returnUrl = `${window.location.origin}/tasks?fromTrade=1&linkId=${encodeURIComponent(link.id)}`;
        window.sessionStorage.setItem(
          PENDING_SWAP_KEY,
          JSON.stringify({ linkId: link.id, tokenAddress: link.token_address, startedAt: Date.now() })
        );
        const swapUrl = buildBaseAppSwapUrl({
          inputToken: USDC_CONTRACT_ADDRESS,
          outputToken: link.token_address as Address,
          exactAmount: BUY_AMOUNT_USDC_DECIMAL,
          returnUrl,
        });
        const w = window.open(swapUrl, '_blank', 'noopener,noreferrer');
        openedExternal = !!w;
      }

      if (openedExternal) {
        setNoticeByLinkId((p) => ({
          ...p,
          [link.id]: `Trade opened. Complete the swap, then return here — we’ll sync the status automatically.`,
        }));
        // We can't await the trade; we sync on focus/visibility when the user returns.
        return;
      }

      // Fallback: use MiniKit action if the WebView blocks opening new tabs.
      await swapTokenAsync({
        sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`,
        buyToken: `eip155:8453/erc20:${link.token_address as Address}`,
        sellAmount: BUY_AMOUNT_USDC.toString(), // 0.10 USDC = "100000"
      });
      setNoticeByLinkId((p) => ({
        ...p,
        [link.id]: `Waiting for confirmation… If the amount is empty, type ${BUY_AMOUNT_USDC_DISPLAY} USDC and confirm.`,
      }));

      // After swap UI opens, user can cancel or complete.
      // Poll for balance for up to ~45s to auto-mark if completed.
      // Важно: не полагаться на состояние balances/refetchBalances (оно обновляется асинхронно).
      // Читаем баланс напрямую из RPC после swap.
      let newBal = 0n;
      const started = Date.now();
      while (Date.now() - started < 45_000) {
        await new Promise((r) => setTimeout(r, 2500));
        newBal = await publicClient.readContract({
          address: link.token_address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [addr],
        });
        if (newBal > 0n) break;
      }
      if (newBal <= 0n) {
        throw new Error(
          `If you completed the swap in Trade, return here — we’ll update the status automatically. If you haven’t confirmed yet, finish the swap in Trade.`
        );
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(PENDING_SWAP_KEY);
      }
      await markCompleted(link.id);
    } catch (e: any) {
      const raw = (e?.shortMessage || e?.message || 'Buy error').toString();
      const lower = raw.toLowerCase();
      const msg = lower.includes('user rejected') || lower.includes('rejected the request')
        ? 'Transaction cancelled in wallet.'
        : raw;
      setNoticeByLinkId((p) => {
        const next = { ...p };
        delete next[link.id];
        return next;
      });
      setErrorByLinkId((p) => ({ ...p, [link.id]: msg }));
    } finally {
      setBuyingLinkId(null);
    }
  };

  // If Trade returned the user to the app (or they re-opened the app), auto-sync and scroll to the relevant card.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (handledReturnRef.current) return;

    const hasPending = !!window.sessionStorage.getItem(PENDING_SWAP_KEY);
    const u = new URL(window.location.href);
    const linkId = u.searchParams.get('linkId');
    const fromTrade = u.searchParams.get('fromTrade');

    if (!hasPending && !fromTrade) return;

    handledReturnRef.current = true;

    if (linkId) {
      setTimeout(() => {
        const el = document.getElementById(`link-${linkId}`);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 150);
    }

    syncPendingSwap();

    if (fromTrade) {
      u.searchParams.delete('fromTrade');
      u.searchParams.delete('linkId');
      window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
    }
  }, [syncPendingSwap, links.length]);

  const openPostInModal = (url: string) => {
    const u = (url || '').trim();
    if (!u.startsWith('http')) return;
    setPostModalUrl(u);
  };

  if (initialLoading) {
    return (
      <Layout title="Tasks">
        <div className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
          <div className="relative z-10 flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <p className="text-white text-xl font-bold">Loading…</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Buy Posts">
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-display leading-none tracking-tight">
              BUY POSTS
            </h1>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-20 h-1 bg-white"></div>
              <div className="w-20 h-1 bg-white"></div>
            </div>
            <p className="text-white text-opacity-90 text-lg">
              Buy {REQUIRED_BUYS_TO_PUBLISH} tokenized posts for{' '}
              <span className="font-black text-yellow-300">{BUY_AMOUNT_USDC_DISPLAY}</span> each.
            </p>
            <p className="text-white text-opacity-75 text-sm mt-3">
              Gas fee: usually paid in Base ETH. In the Base app you may be able to pay gas in USDC (if you see that option in the confirmation screen).
            </p>
          </div>

          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8">
              <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-primary shadow-lg">
                <Image src="/images/mrs-crypto.jpg" alt="Mrs. Crypto" width={64} height={64} className="w-full h-full object-cover" unoptimized />
                </div>
              <div className="flex-1">
                <div className="text-gray-900 font-black text-xl">Progress</div>
                <div className="text-gray-600">
                  Bought post-tokens: <span className="font-black">{completedCount}</span>/{REQUIRED_BUYS_TO_PUBLISH}
              </div>
                {refreshing && <div className="text-xs text-gray-500 mt-1">Syncing…</div>}
            </div>
              {canPublish ? (
                <Button onClick={() => router.push('/submit')}>👉 Add your post</Button>
              ) : (
                <Button onClick={() => router.push('/submit')} disabled>
                  {hasFid ? `Publish (need ${REQUIRED_BUYS_TO_PUBLISH})` : 'Publish (open in Base App)'} 
                </Button>
              )}
            </div>
          </div>

          {links.length > 0 && remainingToBuyCount === 0 && (
            <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl shadow-xl p-4 mb-6 border border-white/30">
              <div className="text-gray-900 font-black">You completed this batch ✅</div>
              <div className="text-gray-700 text-sm mt-1">
                You can’t repeat buys on the same posts. Please wait until <span className="font-bold">{REQUIRED_BUYS_TO_PUBLISH} new links</span> appear.
              </div>
            </div>
          )}

          <div className="space-y-4">
            {links.length === 0 ? (
              <div className="text-center py-12 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl border border-white/30 shadow-2xl">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-2xl font-bold text-white mb-2">No tasks yet</h3>
                <p className="text-white text-opacity-80">No one has added posts yet.</p>
              </div>
            ) : (
              links.map((link) => {
                const tokenAddr = isAddress(link.token_address) ? link.token_address : undefined;
                const postUrl = ((link.cast_url || '').trim().startsWith('http')
                  ? (link.cast_url || '').trim()
                  : (tokenAddr ? baseAppContentUrlFromTokenAddress(tokenAddr) : null)) || '';
                const hasPostUrl = postUrl.startsWith('http');
                const bal = tokenAddr ? balanceByToken.get(tokenAddr.toLowerCase()) ?? 0n : 0n;
                const owned = bal > 0n;
                const completedByProgress = completedLinkIds.includes(link.id);
                const completed = completedByProgress || owned;
                const isBuying = buyingLinkId === link.id;
                const err = errorByLinkId[link.id];

                return (
                  <div
                    key={link.id}
                    id={`link-${link.id}`}
                    className="bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-white/30"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        url={link.pfp_url}
                        seed={link.username || link.id}
                        size={40}
                        alt={link.username || 'avatar'}
                        className="rounded-full object-cover border-2 border-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-black text-gray-900 truncate">@{link.username}</div>
                            {tokenAddr && (
                              <div className="text-xs text-gray-500 truncate mt-1" title={tokenAddr}>
                                Token: {shortHex(tokenAddr)}
                              </div>
                            )}
                            {tokenAddr && <div className="mt-2" />}
          </div>
                          <div className="flex items-center gap-3">
                            {hasPostUrl && (
                              <button
                                type="button"
                                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openPostInModal(postUrl);
                                }}
                              >
                                Read the post
                              </button>
                            )}
                            <button
                              className={`px-4 py-2 rounded-xl font-bold text-white ${
                                completed
                                  ? 'bg-green-600 cursor-not-allowed opacity-90'
                                  : 'bg-gradient-to-r from-primary via-secondary to-accent'
                              }`}
                              onClick={() => handleBuy(link)}
                              disabled={isBuying || completed || !tokenAddr}
                            >
                              {completed ? (owned ? 'BOUGHT' : 'DONE') : isBuying ? 'Buying…' : `BUY ${BUY_AMOUNT_USDC_DISPLAY}`}
            </button>
                          </div>
                        </div>

                        {!completed && noticeByLinkId[link.id] && (
                          <div className="mt-3 text-sm text-blue-700 font-bold">{noticeByLinkId[link.id]}</div>
                        )}
                        {!completed && err && <div className="mt-3 text-sm text-red-600 font-bold">{err}</div>}
                </div>
              </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {postModalUrl ? (
        <InAppBrowserModal url={postModalUrl} title="Read the post" onClose={() => setPostModalUrl(null)} />
      ) : null}
    </Layout>
  );
}


