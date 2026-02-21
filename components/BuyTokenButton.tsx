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
    try {
      // Try Farcaster SDK swap (native wallet experience)
      const { sdk } = await import('@farcaster/miniapp-sdk');
      if (sdk?.actions?.swapToken) {
        const result = await sdk.actions.swapToken({
          buyToken: MCT_TOKEN,
        });
        // Swap completed or cancelled
        if (onComplete) {
          onComplete();
        }
        return;
      }
    } catch (e) {
      // Not in Farcaster context or SDK not available
      console.log('Farcaster SDK swap not available, falling back to Uniswap:', e);
    }

    // Fallback: open Uniswap in browser (for non-FC users)
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
