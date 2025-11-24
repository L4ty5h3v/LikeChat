// Страница для отображения топ-20 пользователей по клеймам предсказаний
'use client';

import { useState, useEffect } from 'react';

interface FortuneUser {
  fid: number;
  username?: string;
  current_streak: number;
  longest_streak: number;
  last_fortune_claim_date?: string;
  total_fortune_claims: number;
  claim_count: number;
  token_purchased: boolean;
}

export default function TopFortuneUsers() {
  const [users, setUsers] = useState<FortuneUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalClaims, setTotalClaims] = useState(0);

  useEffect(() => {
    fetchTopUsers();
  }, []);

  const fetchTopUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/top-fortune-users?limit=20');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalClaims(data.total_claims || 0);
      } else {
        setError(data.message || 'Ошибка при загрузке данных');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          🍪 Топ-20 пользователей по клеймам предсказаний
        </h1>
        <p className="text-gray-300 text-center mb-8">
          Всего пользователей с клеймами: {total} | Всего клеймов: {totalClaims}
        </p>

        {users.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 text-center text-white">
            <p className="text-xl">Пользователи с клеймами не найдены</p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user, index) => (
              <div
                key={user.fid}
                className="bg-white/10 backdrop-blur-lg rounded-lg p-6 hover:bg-white/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl font-bold text-yellow-400 w-12 text-center">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="text-white text-xl font-semibold">
                        FID: {user.fid}
                        {user.username && (
                          <span className="text-gray-300 ml-2">(@{user.username})</span>
                        )}
                      </div>
                      <div className="text-gray-300 mt-1">
                        Клеймов: <span className="text-white font-semibold">{user.claim_count}</span>
                        {' | '}
                        Стрик: <span className="text-white font-semibold">{user.current_streak}</span>
                        {' | '}
                        Рекорд: <span className="text-white font-semibold">{user.longest_streak}</span>
                        {user.last_fortune_claim_date && (
                          <>
                            {' | '}
                            Последний клейм: <span className="text-white font-semibold">{user.last_fortune_claim_date}</span>
                          </>
                        )}
                        {user.token_purchased && (
                          <span className="ml-2 text-green-400">✓ Токен куплен</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={fetchTopUsers}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Обновить
          </button>
        </div>

        <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">📋 Список FID (для копирования)</h2>
          <div className="bg-black/30 rounded p-4 font-mono text-sm text-gray-300 overflow-x-auto">
            {users.map((user, index) => (
              <div key={user.fid} className="mb-1">
                {index + 1}. FID: {user.fid} | Клеймов: {user.claim_count} | Стрик: {user.current_streak} | Рекорд: {user.longest_streak}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


