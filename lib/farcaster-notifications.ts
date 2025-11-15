/**
 * Функции для отправки уведомлений через Farcaster Mini App SDK
 * После успешных транзакций для вирусного распространения
 */

export interface NotificationOptions {
  title: string;
  text: string;
  url?: string;
  imageUrl?: string;
}

/**
 * Отправить уведомление через Farcaster Mini App SDK
 * @param options - Параметры уведомления
 * @returns Результат отправки
 */
export async function sendNotification(options: NotificationOptions): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (typeof window === 'undefined') {
      return {
        success: false,
        error: 'SDK доступен только на клиенте',
      };
    }

    // Проверяем, что мы в iframe Farcaster Mini App
    const isInFarcasterFrame = window.self !== window.top;
    if (!isInFarcasterFrame) {
      console.log('ℹ️ [NOTIFICATION] Not in Farcaster frame, skipping notification');
      return {
        success: false,
        error: 'Not in Farcaster Mini App',
      };
    }

    // Динамический импорт SDK
    const { sdk } = await import('@farcaster/miniapp-sdk');

    // Проверяем доступность SDK и actions
    if (!sdk || !sdk.actions) {
      console.warn('⚠️ [NOTIFICATION] SDK or actions not available');
      return {
        success: false,
        error: 'SDK actions not available',
      };
    }

    // Пробуем разные методы отправки уведомлений (в зависимости от версии SDK)
    try {
      // Метод 1: Если есть прямой метод sendNotification
      if (typeof (sdk.actions as any).sendNotification === 'function') {
        await (sdk.actions as any).sendNotification({
          title: options.title,
          text: options.text,
          url: options.url,
          imageUrl: options.imageUrl,
        });
        console.log('✅ [NOTIFICATION] Sent via sendNotification');
        return { success: true };
      }

      // Метод 2: Если есть метод notify
      if (typeof (sdk.actions as any).notify === 'function') {
        await (sdk.actions as any).notify({
          title: options.title,
          message: options.text,
          url: options.url,
          imageUrl: options.imageUrl,
        });
        console.log('✅ [NOTIFICATION] Sent via notify');
        return { success: true };
      }

      // Метод 3: Если есть метод createNotification
      if (typeof (sdk.actions as any).createNotification === 'function') {
        await (sdk.actions as any).createNotification({
          title: options.title,
          text: options.text,
          url: options.url,
          imageUrl: options.imageUrl,
        });
        console.log('✅ [NOTIFICATION] Sent via createNotification');
        return { success: true };
      }

      // Метод 4: Используем openUrl как fallback для redirect с информацией
      if (sdk.actions.openUrl && options.url) {
        // Если нет прямого метода notification, используем openUrl как альтернативу
        console.log('ℹ️ [NOTIFICATION] Direct notification method not available, using openUrl fallback');
        await sdk.actions.openUrl({ url: options.url });
        return { success: true };
      }

      console.warn('⚠️ [NOTIFICATION] No notification method available in SDK');
      return {
        success: false,
        error: 'No notification method available',
      };
    } catch (sdkError: any) {
      console.error('❌ [NOTIFICATION] SDK error:', sdkError);
      return {
        success: false,
        error: sdkError.message || 'Failed to send notification',
      };
    }
  } catch (error: any) {
    console.error('❌ [NOTIFICATION] Error sending notification:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Отправить уведомление о успешной покупке токенов
 * @param mctAmount - Количество купленных MCT токенов
 * @param usdcAmount - Количество потраченных USDC
 * @param txHash - Хеш транзакции (если доступен)
 * @param username - Имя пользователя Farcaster
 */
export async function sendTokenPurchaseNotification(
  mctAmount: number,
  usdcAmount: number,
  txHash?: string,
  username?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const title = '🎉 MCT Tokens Purchased!';
  const text = `${username ? `@${username} ` : ''}successfully purchased ${mctAmount.toFixed(4)} MCT tokens for ${usdcAmount} USDC${txHash ? ` on Base` : ''}`;
  
  // Формируем URL для просмотра транзакции или мини-приложения
  const url = txHash 
    ? `https://basescan.org/tx/${txHash}`
    : typeof window !== 'undefined' 
      ? window.location.origin 
      : '';

  return await sendNotification({
    title,
    text,
    url,
    imageUrl: '/mrs-crypto.png', // Логотип приложения
  });
}

/**
 * Отправить уведомление о успешном выполнении задачи
 * @param username - Имя пользователя Farcaster
 * @param completedTasks - Количество выполненных задач
 * @param totalTasks - Общее количество задач
 */
export async function sendTaskCompletionNotification(
  username: string,
  completedTasks: number,
  totalTasks: number
): Promise<{
  success: boolean;
  error?: string;
}> {
  const title = '✅ Tasks Completed!';
  const text = `@${username} completed ${completedTasks}/${totalTasks} tasks! Keep going! 🚀`;
  
  const url = typeof window !== 'undefined' ? window.location.origin : '';

  return await sendNotification({
    title,
    text,
    url,
    imageUrl: '/mrs-crypto.png',
  });
}

