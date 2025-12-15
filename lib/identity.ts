import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';

/**
 * Разрешение "имени пользователя" по адресу кошелька.
 *
 * Источник: ENS (mainnet). Для многих Base-кошельков Basename тоже является ENS-именем,
 * поэтому этого достаточно как авто-определение.
 *
 * Если имени нет — возвращаем null и UI использует shortAddress().
 */
const mainnetClient = createPublicClient({
  chain: mainnet,
  // Public RPC, достаточно для read-only ENS.
  transport: http('https://cloudflare-eth.com'),
});

export async function resolveNameAndAvatar(address: Address): Promise<{ name: string | null; avatarUrl: string | null }> {
  try {
    const name = await mainnetClient.getEnsName({ address });
    if (!name) return { name: null, avatarUrl: null };

    let avatarUrl: string | null = null;
    try {
      avatarUrl = await mainnetClient.getEnsAvatar({ name });
    } catch {
      avatarUrl = null;
    }

    return { name, avatarUrl };
  } catch {
    return { name: null, avatarUrl: null };
  }
}


