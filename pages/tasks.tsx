// Tasks page (Base): buy a post-token for BUY_AMOUNT_USDC_DISPLAY, onchain verification via balanceOf
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import Avatar from '@/components/Avatar';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import type { LinkSubmission } from '@/types';
import { useAccount, usePublicClient, useReadContracts } from 'wagmi';
import { erc20Abi, parseEther, parseUnits, type Address } from 'viem';
import { BUY_AMOUNT_USDC_DECIMAL, BUY_AMOUNT_USDC_DISPLAY, REQUIRED_BUYS_TO_PUBLISH } from '@/lib/app-config';
import { useSwapToken, useIsInMiniApp } from '@coinbase/onchainkit/minikit';

const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const BUY_AMOUNT_USDC = parseUnits(BUY_AMOUNT_USDC_DECIMAL, 6);

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
  const isInMiniApp = useIsInMiniApp();

  const [links, setLinks] = useState<LinkSubmission[]>([]);
  const [completedLinkIds, setCompletedLinkIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [buyingLinkId, setBuyingLinkId] = useState<string | null>(null);
  const [errorByLinkId, setErrorByLinkId] = useState<Record<string, string>>({});

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

  const refresh = async () => {
    setLoading(true);
    try {
      // Always load links (they are global, not user-specific)
      const linksRes = await fetch(`/api/tasks?t=${Date.now()}&taskType=support`);
      const linksJson = await linksRes.json();
      setLinks(Array.isArray(linksJson.links) ? linksJson.links : []);

      // Load per-user progress only when we have a real fid (MiniKit/Base App)
      if (hasFid) {
        const progressRes = await fetch(`/api/user-progress?userFid=${user!.fid}&t=${Date.now()}`);
        const progressJson = await progressRes.json();
        const progress = progressJson.progress || null;
        setCompletedLinkIds(Array.isArray(progress?.completed_links) ? progress.completed_links : []);
      } else {
        setCompletedLinkIds([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) {
      router.push('/');
      return;
    }

    refresh();

    // Убираем polling (страница не должна "дёргаться" каждые 5 секунд).
    // Обновляем данные только при возврате во вкладку/приложение.
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user?.fid]);

  const tokenContracts = useMemo(() => {
    if (!address) return [];
    return links
      .filter((l) => isAddress(l.token_address))
      .map((l) => ({
        address: l.token_address as Address,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [address] as const,
      }));
  }, [links, address]);

  const { data: balances, refetch: refetchBalances } = useReadContracts({
    contracts: tokenContracts,
    query: {
      enabled: !!address && tokenContracts.length > 0,
    },
  });

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
    const ids = new Set<string>(completedLinkIds);
    for (const id of ownedLinkIds) ids.add(id);
    return ids.size;
  }, [completedLinkIds, ownedLinkIds]);

  const canPublish = completedCount >= REQUIRED_BUYS_TO_PUBLISH && hasFid;

  const handleBuy = async (link: LinkSubmission) => {
    if (!isConnected || !address) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Connect your wallet first.' }));
      return;
    }
    // In some WebViews chainId can be undefined; treat it as NOT Base to avoid generating broken txs.
    if (chainId !== 8453) {
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
    if (!isInMiniApp) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Open this mini-app inside Base App to buy.' }));
      return;
    }

    setErrorByLinkId((p) => ({ ...p, [link.id]: '' }));
    setBuyingLinkId(link.id);

    try {
      // Preflight: user needs Base ETH for gas + BUY_AMOUNT_USDC_DISPLAY USDC for the swap
      const [ethBalance, usdcBalance] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({
          address: USDC_CONTRACT_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        }),
      ]);

      if (usdcBalance < BUY_AMOUNT_USDC) {
        throw new Error(`Not enough USDC. You need at least ${BUY_AMOUNT_USDC_DISPLAY} USDC on Base.`);
      }
      // Very lightweight gas check (swap UI will estimate precisely)
      if (ethBalance < parseEther('0.00001')) {
        throw new Error('Not enough Base ETH for gas. Please add a little ETH on Base.');
      }

      // BUY flow for Base App tokens:
      // base.app tokens are typically purchased via Swap (USDC -> token), not via token.buy().
      // So we open the swap form pre-selected; then we verify balanceOf after the user returns.
      await swapTokenAsync({
        sellToken: `eip155:8453/erc20:${USDC_CONTRACT_ADDRESS}`,
        buyToken: `eip155:8453/erc20:${link.token_address as Address}`,
        sellAmount: BUY_AMOUNT_USDC.toString(), // 0.10 USDC = "100000"
      });

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
          args: [address],
        });
        if (newBal > 0n) break;
      }
      if (newBal <= 0n) {
        throw new Error('Swap opened. Complete the swap in wallet, then return here and refresh the page.');
      }

      // mark completed in DB
      if (hasFid) {
        await fetch('/api/mark-completed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userFid: user?.fid, linkId: link.id }),
        });
      }

      setCompletedLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
      // Обновим кеш балансов для UI (не критично для верификации)
      refetchBalances();
    } catch (e: any) {
      const raw = (e?.shortMessage || e?.message || 'Buy error').toString();
      const msg =
        raw.toLowerCase().includes('user rejected') || raw.toLowerCase().includes('rejected the request')
          ? 'Transaction cancelled in wallet.'
          : raw;
      setErrorByLinkId((p) => ({ ...p, [link.id]: msg }));
    } finally {
      setBuyingLinkId(null);
    }
  };

  const openPostLink = (url: string) => {
    if (typeof window === 'undefined') return;
    // In Base App / in-app WebViews, window.open can be blocked. Prefer same-tab navigation.
    try {
      window.location.href = url;
    } catch {
      // no-op
    }
  };

  if (loading) {
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
              Buy a post-token for <span className="font-black text-yellow-300">{BUY_AMOUNT_USDC_DISPLAY}</span> on {REQUIRED_BUYS_TO_PUBLISH} posts.
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
              </div>
              {canPublish ? (
                <Button onClick={() => router.push('/submit')}>Publish</Button>
              ) : (
                <Button onClick={() => router.push('/submit')} disabled>
                  {hasFid ? `Publish (need ${REQUIRED_BUYS_TO_PUBLISH})` : 'Publish (open in Base App)'} 
                </Button>
              )}
            </div>
          </div>

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
                const bal = tokenAddr ? balanceByToken.get(tokenAddr.toLowerCase()) ?? 0n : 0n;
                const owned = bal > 0n;
                const completed = completedLinkIds.includes(link.id) || owned;
                const isBuying = buyingLinkId === link.id;
                const err = errorByLinkId[link.id];

                return (
                  <div key={link.id} className="bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-white/30">
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
                            <div className="text-xs text-gray-600 truncate max-w-[240px] sm:max-w-[420px]" title={link.cast_url}>
                              {compactUrl(link.cast_url)}
                            </div>
                            {tokenAddr && (
                              <div className="text-xs text-gray-500 truncate mt-1" title={tokenAddr}>
                                Token: {shortHex(tokenAddr)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <a
                              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold"
                              href={link.cast_url}
                              onClick={(e) => {
                                // Some WebViews ignore target=_blank and/or block window.open.
                                // Force navigation on click.
                                e.preventDefault();
                                openPostLink(link.cast_url);
                              }}
                              rel="noopener noreferrer"
                            >
                              Open
                            </a>
                            <button
                              className={`px-4 py-2 rounded-xl font-bold text-white ${completed ? 'bg-green-600' : 'bg-gradient-to-r from-primary via-secondary to-accent'}`}
                              onClick={() => handleBuy(link)}
                              disabled={isBuying || completed || !tokenAddr}
                            >
                              {completed ? 'Done' : isBuying ? 'Buying…' : `BUY ${BUY_AMOUNT_USDC_DISPLAY}`}
                            </button>
                          </div>
                        </div>

                        {err && <div className="mt-3 text-sm text-red-600 font-bold">{err}</div>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}


