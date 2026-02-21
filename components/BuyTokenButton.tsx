import { useCallback } from 'react';

// $MCT token on Base chain (CAIP-19 format)
const MCT_TOKEN = 'eip155:8453/erc20:0x04D388DA70C32FC5876981097c536c51c8d3D236';
const MCT_UNISWAP_URL = 'https://app.uniswap.org/swap?outputCurrency=0x04D388DA70C32FC5876981097c536c51c8d3D236&chain=base';

interface BuyTokenButtonProps {
  onComplete?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
  showLabel?: boolean;
}

export default function BuyTokenButton({ 
  onComplete, 
  className = '',
  variant = 'primary',
  showLabel = true 
}: BuyTokenButtonProps) {
  const handleBuyToken = useCallback(async () => {
    // Check if we're in Farcaster context
    const isInFarcasterFrame = typeof window !== 'undefined' && window.self !== window.top;
    console.log('🔍 [BuyTokenButton] Context check:', { isInFarcasterFrame });

    try {
      // Try Farcaster SDK swap (native wallet experience)
      const { sdk } = await import('@farcaster/miniapp-sdk');
      
      console.log('🔄 [BuyTokenButton] SDK loaded:', { 
        hasSDK: !!sdk, 
        hasActions: !!sdk?.actions,
        hasSwapToken: !!sdk?.actions?.swapToken,
        actions: sdk?.actions ? Object.keys(sdk.actions) : []
      });

      if (!sdk || !sdk.actions) {
        throw new Error('SDK or actions not available');
      }

      // Ensure SDK is ready before using swapToken (only if not already called)
      if (sdk.actions.ready && typeof sdk.actions.ready === 'function') {
        try {
          // Check if ready was already called
          if (!(window as any).__FARCASTER_READY_CALLED__) {
            await sdk.actions.ready();
            (window as any).__FARCASTER_READY_CALLED__ = true;
            console.log('✅ [BuyTokenButton] SDK ready() called');
          } else {
            console.log('ℹ️ [BuyTokenButton] SDK ready() already called, skipping');
          }
        } catch (readyError) {
          console.warn('⚠️ [BuyTokenButton] SDK ready() failed:', readyError);
        }
      }

      if (sdk.actions.swapToken) {
        console.log('🪙 [BuyTokenButton] Calling swapToken with:', MCT_TOKEN);
        try {
          const result = await sdk.actions.swapToken({
            buyToken: MCT_TOKEN,
          });
          console.log('✅ [BuyTokenButton] Swap completed:', result);
          // Swap completed or cancelled
          if (onComplete) {
            onComplete();
          }
          return;
        } catch (swapError: any) {
          console.error('❌ [BuyTokenButton] swapToken call failed:', swapError);
          // If swap was cancelled by user, don't show error
          if (swapError?.message?.includes('cancelled') || swapError?.message?.includes('user')) {
            console.log('ℹ️ [BuyTokenButton] Swap cancelled by user');
            return;
          }
          throw swapError;
        }
      } else {
        console.warn('⚠️ [BuyTokenButton] swapToken not available in SDK actions');
        throw new Error('swapToken not available');
      }
    } catch (e: any) {
      // Not in Farcaster context or SDK not available
      console.error('❌ [BuyTokenButton] Farcaster SDK swap error:', e?.message || e);
      console.log('🔄 [BuyTokenButton] Falling back to Uniswap');
    }

    // Fallback: open Uniswap in browser (for non-FC users)
    console.log('🌐 [BuyTokenButton] Opening Uniswap:', MCT_UNISWAP_URL);
    window.open(MCT_UNISWAP_URL, '_blank');
    if (onComplete) {
      // Wait a bit before calling onComplete to allow user to interact with Uniswap
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  }, [onComplete]);

  const baseClasses = variant === 'primary' 
    ? 'btn-gold-glow px-5 sm:px-8 py-3.5 sm:py-4 text-white font-bold text-sm sm:text-lg animate-scale-in active:scale-[0.98] transition-transform hover:shadow-2xl hover:shadow-yellow-500/50'
    : 'px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors';

  return (
    <div className="text-center">
      <button
        onClick={handleBuyToken}
        className={`${baseClasses} ${className} relative`}
      >
        <span className="relative z-20 drop-shadow-lg">🪙 Buy $MCT Token</span>
      </button>
      {showLabel && (
        <p className="text-white text-opacity-60 text-xs mt-1.5">
          Support Mrs. Crypto
        </p>
      )}
    </div>
  );
}
