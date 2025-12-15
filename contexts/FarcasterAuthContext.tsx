// Контекст для хранения состояния авторизации (Base)
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { BaseUser } from '@/types';

interface FarcasterAuthContextType {
  user: BaseUser | null;
  setUser: (user: BaseUser | null) => void;
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
  const [user, setUserState] = useState<BaseUser | null>(null);
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
        const savedUserStr = localStorage.getItem('base_user');
        
        if (!savedUserStr) {
          console.log('ℹ️ [AUTH-CONTEXT] No user found in localStorage');
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        try {
          const savedUser: BaseUser = JSON.parse(savedUserStr);
          
          // Валидация для Base: допускаем fid === 0, главное чтобы был username или address
          if (savedUser && (savedUser.username || (savedUser as any).address)) {
            console.log('✅ [AUTH-CONTEXT] Valid user loaded from localStorage:', {
              fid: savedUser.fid,
              username: savedUser.username,
            });
            setUserState(savedUser);
          } else {
            console.warn('⚠️ [AUTH-CONTEXT] Invalid user data in localStorage:', savedUser);
            localStorage.removeItem('base_user');
          }
        } catch (parseError) {
          console.error('❌ [AUTH-CONTEXT] Failed to parse user from localStorage:', parseError);
          localStorage.removeItem('base_user');
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

  // Упрощено: без SDK синхронизации

  // Функция для установки user с автоматическим сохранением в localStorage
  const setUser = (newUser: BaseUser | null) => {
    console.log('🔧 [AUTH-CONTEXT] Setting user:', {
      hasUser: !!newUser,
      fid: newUser?.fid,
      username: newUser?.username,
    });
    
    // Валидируем перед установкой
    // Для Base допускаем fid === 0
    
    setUserState(newUser);
    
    if (typeof window !== 'undefined') {
      if (newUser) {
        // Для Base сохраняем всегда (если есть хоть какие-то идентификаторы)
        const userJson = JSON.stringify(newUser);
        localStorage.setItem('base_user', userJson);
        console.log('✅ [AUTH-CONTEXT] User saved to localStorage:', {
          fid: newUser.fid,
          username: newUser.username,
          address: (newUser as any).address,
        });
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
      localStorage.removeItem('base_user');
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

