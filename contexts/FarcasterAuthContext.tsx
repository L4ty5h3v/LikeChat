// Контекст для хранения состояния авторизации Farcaster
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { FarcasterUser } from '@/types';

interface FarcasterAuthContextType {
  user: FarcasterUser | null;
  setUser: (user: FarcasterUser | null) => void;
  logout: () => void;
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

  // ⚠️ КРИТИЧНО: useEffect для загрузки user из localStorage при монтировании
  useEffect(() => {
    const loadUserFromStorage = () => {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        console.log('🔍 [AUTH-CONTEXT] Loading user from localStorage on mount...');
        const savedUserStr = localStorage.getItem('farcaster_user');
        
        if (!savedUserStr) {
          console.log('ℹ️ [AUTH-CONTEXT] No user found in localStorage');
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        try {
          const savedUser: FarcasterUser = JSON.parse(savedUserStr);
          
          // Валидация: проверяем, что fid валидный
          if (savedUser && savedUser.fid && typeof savedUser.fid === 'number' && savedUser.fid > 0) {
            console.log('✅ [AUTH-CONTEXT] Valid user loaded from localStorage:', {
              fid: savedUser.fid,
              username: savedUser.username,
            });
            setUserState(savedUser);
          } else {
            console.warn('⚠️ [AUTH-CONTEXT] Invalid user data in localStorage (invalid fid):', savedUser);
            localStorage.removeItem('farcaster_user');
          }
        } catch (parseError) {
          console.error('❌ [AUTH-CONTEXT] Failed to parse user from localStorage:', parseError);
          localStorage.removeItem('farcaster_user');
        }
      } catch (error: any) {
        console.error('❌ [AUTH-CONTEXT] Error loading user from localStorage:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    loadUserFromStorage();
  }, []); // Только при монтировании

  // Обновляем user из SDK context после монтирования (если доступно)
  useEffect(() => {
    const syncWithSDK = async () => {
      if (typeof window === 'undefined' || !isInitialized) {
        return;
      }

      try {
        const isInFarcasterFrame = window.self !== window.top;
        if (!isInFarcasterFrame) {
          console.log('ℹ️ [AUTH-CONTEXT] Not in Farcaster frame, skipping SDK sync');
          return;
        }

        const { sdk } = await import('@farcaster/miniapp-sdk');
        const context = await sdk.context;
        
        console.log('📊 [AUTH-CONTEXT] SDK context sync:', {
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
      } catch (sdkError: any) {
        console.log('ℹ️ [AUTH-CONTEXT] SDK sync not available:', sdkError.message);
      }
    };

    if (isInitialized) {
      syncWithSDK();
    }
  }, [isInitialized]);

  // Функция для установки user с автоматическим сохранением в localStorage
  const setUser = (newUser: FarcasterUser | null) => {
    console.log('🔧 [AUTH-CONTEXT] Setting user:', {
      hasUser: !!newUser,
      fid: newUser?.fid,
      username: newUser?.username,
    });
    
    // Валидируем перед установкой
    if (newUser && (!newUser.fid || typeof newUser.fid !== 'number' || newUser.fid <= 0)) {
      console.error('❌ [AUTH-CONTEXT] Invalid user data, not setting:', newUser);
      return;
    }
    
    setUserState(newUser);
    
    if (typeof window !== 'undefined') {
      if (newUser) {
        // Валидируем данные перед сохранением
        if (newUser.fid && typeof newUser.fid === 'number' && newUser.fid > 0) {
          const userJson = JSON.stringify(newUser);
          localStorage.setItem('farcaster_user', userJson);
          console.log('✅ [AUTH-CONTEXT] User saved to localStorage:', {
            fid: newUser.fid,
            username: newUser.username,
          });
        } else {
          console.error('❌ [AUTH-CONTEXT] Invalid user data, not saving:', newUser);
        }
      } else {
        // Если newUser null, очищаем localStorage
        logout();
      }
    }
  };

  // Функция для logout/disconnect - очищает все данные
  const logout = () => {
    console.log('🚪 [AUTH-CONTEXT] Logout called - clearing user data...');
    setUserState(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('farcaster_user');
      localStorage.removeItem('selected_activity');
      console.log('✅ [AUTH-CONTEXT] All user data cleared from localStorage');
    }
  };

  return (
    <FarcasterAuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        isLoading,
        isInitialized,
      }}
    >
      {children}
    </FarcasterAuthContext.Provider>
  );
};

