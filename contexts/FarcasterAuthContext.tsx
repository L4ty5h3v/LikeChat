// Контекст для хранения состояния авторизации Farcaster
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { FarcasterUser } from '@/types';

interface FarcasterAuthContextType {
  user: FarcasterUser | null;
  setUser: (user: FarcasterUser | null) => void;
  isLoading: boolean;
  isInitialized: boolean;
}

const FarcasterAuthContext = createContext<FarcasterAuthContextType | undefined>(undefined);

export const useFarcasterAuth = () => {
  const context = useContext(FarcasterAuthContext);
  if (!context) {
    throw new Error('useFarcasterAuth must be used within FarcasterAuthProvider');
  }
  return context;
};

interface FarcasterAuthProviderProps {
  children: ReactNode;
}

export const FarcasterAuthProvider: React.FC<FarcasterAuthProviderProps> = ({ children }) => {
  const [user, setUserState] = useState<FarcasterUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Инициализация: загружаем user из localStorage и пытаемся получить из SDK
  useEffect(() => {
    const initializeAuth = async () => {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        console.log('🔍 [AUTH-CONTEXT] Initializing Farcaster auth...');
        
        // 1. Загружаем из localStorage
        const savedUser = localStorage.getItem('farcaster_user');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            console.log('✅ [AUTH-CONTEXT] Found user in localStorage:', {
              fid: parsedUser.fid,
              username: parsedUser.username,
            });
            
            // Валидируем данные пользователя
            if (parsedUser.fid && typeof parsedUser.fid === 'number') {
              setUserState(parsedUser);
              console.log('✅ [AUTH-CONTEXT] User loaded from localStorage:', parsedUser);
            } else {
              console.warn('⚠️ [AUTH-CONTEXT] Invalid user data in localStorage:', parsedUser);
              localStorage.removeItem('farcaster_user');
            }
          } catch (parseError) {
            console.error('❌ [AUTH-CONTEXT] Failed to parse user from localStorage:', parseError);
            localStorage.removeItem('farcaster_user');
          }
        }

        // 2. Пытаемся получить из SDK context (обновляем, если доступно)
        try {
          const isInFarcasterFrame = window.self !== window.top;
          if (isInFarcasterFrame) {
            const { sdk } = await import('@farcaster/miniapp-sdk');
            const context = await sdk.context;
            
            console.log('📊 [AUTH-CONTEXT] SDK context received:', {
              hasContext: !!context,
              hasUser: !!context?.user,
              userFid: context?.user?.fid,
            });
            
            if (context?.user && context.user.fid) {
              const sdkUser: FarcasterUser = {
                fid: Number(context.user.fid),
                username: context.user.username || `user_${context.user.fid}`,
                pfp_url: (context.user as any).pfp?.url || (context.user as any).pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${context.user.fid}`,
                display_name: (context.user as any).displayName || context.user.username || `User ${context.user.fid}`,
              };
              
              console.log('✅ [AUTH-CONTEXT] User from SDK context:', {
                fid: sdkUser.fid,
                username: sdkUser.username,
              });
              
              // Обновляем user, если SDK предоставил данные
              setUserState(sdkUser);
              
              // Сохраняем в localStorage
              localStorage.setItem('farcaster_user', JSON.stringify(sdkUser));
              console.log('✅ [AUTH-CONTEXT] User saved to localStorage from SDK');
            }
          }
        } catch (sdkError: any) {
          console.log('ℹ️ [AUTH-CONTEXT] SDK not available:', sdkError.message);
          // Не критично, продолжаем с данными из localStorage
        }
      } catch (error: any) {
        console.error('❌ [AUTH-CONTEXT] Error initializing auth:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
        console.log('✅ [AUTH-CONTEXT] Auth initialization complete:', {
          hasUser: !!user,
          userFid: user?.fid,
        });
      }
    };

    initializeAuth();
  }, []); // Только при монтировании

  // Функция для установки user с автоматическим сохранением в localStorage
  const setUser = (newUser: FarcasterUser | null) => {
    console.log('🔧 [AUTH-CONTEXT] Setting user:', {
      hasUser: !!newUser,
      fid: newUser?.fid,
      username: newUser?.username,
    });
    
    setUserState(newUser);
    
    if (typeof window !== 'undefined') {
      if (newUser) {
        // Валидируем данные перед сохранением
        if (newUser.fid && typeof newUser.fid === 'number') {
          localStorage.setItem('farcaster_user', JSON.stringify(newUser));
          console.log('✅ [AUTH-CONTEXT] User saved to localStorage:', {
            fid: newUser.fid,
            username: newUser.username,
          });
        } else {
          console.error('❌ [AUTH-CONTEXT] Invalid user data, not saving:', newUser);
        }
      } else {
        localStorage.removeItem('farcaster_user');
        console.log('🗑️ [AUTH-CONTEXT] User removed from localStorage');
      }
    }
  };

  return (
    <FarcasterAuthContext.Provider
      value={{
        user,
        setUser,
        isLoading,
        isInitialized,
      }}
    >
      {children}
    </FarcasterAuthContext.Provider>
  );
};

