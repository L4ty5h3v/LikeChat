// Страница задач (Base): купить post-token на $0.01 USDC, проверка только onchain через balanceOf
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import Button from '@/components/Button';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import type { LinkSubmission } from '@/types';
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from 'wagmi';
import { erc20Abi, parseUnits, type Address } from 'viem';

const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const BUY_AMOUNT_USDC = parseUnits('0.01', 6);

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

export default function TasksPage() {
  const router = useRouter();
  const { user, isInitialized } = useFarcasterAuth();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [links, setLinks] = useState<LinkSubmission[]>([]);
  const [completedLinkIds, setCompletedLinkIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [buyingLinkId, setBuyingLinkId] = useState<string | null>(null);
  const [errorByLinkId, setErrorByLinkId] = useState<Record<string, string>>({});

  // Всегда работаем в режиме support
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('selected_activity', 'support');
  }, []);

  const refresh = async () => {
    if (!user?.fid) return;
      setLoading(true);
    try {
      const [linksRes, progressRes] = await Promise.all([
        fetch(`/api/tasks?t=${Date.now()}&taskType=support`),
        fetch(`/api/user-progress?userFid=${user.fid}&t=${Date.now()}`),
      ]);
      const linksJson = await linksRes.json();
      const progressJson = await progressRes.json();
      setLinks(Array.isArray(linksJson.links) ? linksJson.links : []);

      const progress = progressJson.progress || null;
      setCompletedLinkIds(Array.isArray(progress?.completed_links) ? progress.completed_links : []);
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

  const completedCount = completedLinkIds.length;
  const canPublish = completedCount >= 10;

  const handleBuy = async (link: LinkSubmission) => {
    if (!isConnected || !address) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Сначала подключите кошелёк.' }));
      return;
    }
    if (chainId && chainId !== 8453) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Переключите сеть на Base (8453).' }));
      return;
    }
    if (!isAddress(link.token_address)) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'У поста нет корректного token address.' }));
      return;
    }
    if (!publicClient) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: 'Public client не доступен.' }));
      return;
    }

    setErrorByLinkId((p) => ({ ...p, [link.id]: '' }));
    setBuyingLinkId(link.id);

    try {
      // 1) approve USDC -> spender = tokenAddress
      const approveHash = await writeContractAsync({
        address: USDC_CONTRACT_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [link.token_address as Address, BUY_AMOUNT_USDC],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 2) buy() on post token
      const buyHash = await writeContractAsync({
        address: link.token_address as Address,
        abi: postTokenBuyAbi,
        functionName: 'buy',
        args: [],
      });
      await publicClient.waitForTransactionReceipt({ hash: buyHash });

      // 3) onchain verify balanceOf > 0
      // Важно: не полагаться на состояние balances/refetchBalances (оно обновляется асинхронно).
      // Читаем баланс напрямую из RPC сразу после покупки.
      const newBal = await publicClient.readContract({
        address: link.token_address as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      if (newBal <= 0n) {
        throw new Error('Покупка прошла, но balanceOf всё ещё 0. Попробуйте обновить страницу через 10-20 сек.');
      }

      // 4) mark completed in DB
      await fetch('/api/mark-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userFid: user?.fid, linkId: link.id }),
      });

      setCompletedLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
      // Обновим кеш балансов для UI (не критично для верификации)
      refetchBalances();
    } catch (e: any) {
      setErrorByLinkId((p) => ({ ...p, [link.id]: e?.message || 'Ошибка покупки' }));
    } finally {
      setBuyingLinkId(null);
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
    <Layout title="Tasks - Support">
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-display leading-none tracking-tight">
              SUPPORT
            </h1>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-20 h-1 bg-white"></div>
              <div className="w-20 h-1 bg-white"></div>
            </div>
            <p className="text-white text-opacity-90 text-lg">
              Купите post-token на <span className="font-black text-yellow-300">$0.01</span> для 10 постов.
            </p>
          </div>

          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-6 mb-8">
              <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-primary shadow-lg">
                <Image src="/images/mrs-crypto.jpg" alt="Mrs. Crypto" width={64} height={64} className="w-full h-full object-cover" unoptimized />
              </div>
              <div className="flex-1">
                <div className="text-gray-900 font-black text-xl">Прогресс</div>
                <div className="text-gray-600">
                  Куплено пост-токенов: <span className="font-black">{completedCount}</span>/10
                </div>
              </div>
              {canPublish ? (
                <Button onClick={() => router.push('/submit')}>Публиковать</Button>
              ) : (
                <Button onClick={() => router.push('/submit')} disabled>
                  Публиковать (нужно 10)
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {links.length === 0 ? (
              <div className="text-center py-12 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl border border-white/30 shadow-2xl">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-2xl font-bold text-white mb-2">Нет заданий</h3>
                <p className="text-white text-opacity-80">Пока никто не добавил посты.</p>
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
                  <div key={link.id} className="bg-white bg-opacity-95 backdrop-blur-sm rounded-2xl shadow-xl p-5 border border-white/30">
                    <div className="flex items-start gap-4">
                      {link.pfp_url ? (
                        <img src={link.pfp_url} alt={link.username} className="w-12 h-12 rounded-full border-2 border-primary" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-black text-gray-900 truncate">@{link.username}</div>
                            <div className="text-xs text-gray-600 break-all">{link.cast_url}</div>
                            {tokenAddr && <div className="text-xs text-gray-500 break-all mt-1">Token: {tokenAddr}</div>}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold"
                              onClick={() => window.open(link.cast_url, '_blank', 'noopener,noreferrer')}
                            >
                              Открыть
                            </button>
                            <button
                              className={`px-4 py-2 rounded-xl font-bold text-white ${completed ? 'bg-green-600' : 'bg-gradient-to-r from-primary via-secondary to-accent'}`}
                              onClick={() => handleBuy(link)}
                              disabled={isBuying || completed || !tokenAddr}
                            >
                              {completed ? 'Готово' : isBuying ? 'Покупка…' : 'Buy $0.01'}
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


