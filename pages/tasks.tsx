// Страница задач: прохождение 10 ссылок
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import TaskCard from '@/components/TaskCard';
import ProgressBar from '@/components/ProgressBar';
import Button from '@/components/Button';
import { getAllLinks } from '@/lib/db-config';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
import { extractCastHash } from '@/lib/neynar';
import type { LinkSubmission, ActivityType, TaskProgress } from '@/types';

export default function Tasks() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const { user, isLoading: authLoading, isInitialized } = useFarcasterAuth();
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [incompleteLinks, setIncompleteLinks] = useState<string[]>([]);
  const [showPublishedSuccess, setShowPublishedSuccess] = useState(false);
  const [verificationMessages, setVerificationMessages] = useState<Array<{ linkId: string; message: string; neynarUrl?: string }>>([]);
  // Загружаем openedTasks из localStorage при инициализации
  const [openedTasks, setOpenedTasks] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('opened_tasks');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        console.warn('Failed to load opened tasks from localStorage:', e);
        return {};
      }
    }
    return {};
  });

  // Загрузка данных
  useEffect(() => {
    console.log('🔍 [TASKS] Component mounted, checking auth...', {
      hasUser: !!user,
      userFid: user?.fid,
      authLoading,
      isInitialized,
    });
    
    // Проверяем, что код выполняется на клиенте
    if (typeof window !== 'undefined') {
      // Ждём инициализации авторизации
      if (!isInitialized) {
        console.log('⏳ [TASKS] Waiting for auth initialization...');
        return;
      }
      
      // Проверяем наличие user
      if (!user || !user.fid) {
        console.error('❌ [TASKS] No user found, redirecting to home...');
        router.push('/');
        return;
      }
      
      const savedActivity = localStorage.getItem('selected_activity');
      if (!savedActivity) {
        console.error('❌ [TASKS] No activity selected, redirecting to home...');
        router.push('/');
        return;
      }

      setActivity(savedActivity as ActivityType);
      
      console.log('✅ [TASKS] User and activity loaded:', {
        fid: user.fid,
        username: user.username,
        activity: savedActivity,
      });
      
      // Проверяем, есть ли параметр published в URL (после публикации ссылки)
      const urlParams = new URLSearchParams(window.location.search);
      const justPublished = urlParams.get('published') === 'true';
      
      if (justPublished) {
        setShowPublishedSuccess(true);
        // Устанавливаем флаг в sessionStorage, чтобы предотвратить повторные редиректы
        sessionStorage.setItem('link_published', 'true');
        // Убираем параметр из URL
        window.history.replaceState({}, '', '/tasks');
        // Скрываем уведомление через 5 секунд
        setTimeout(() => {
          setShowPublishedSuccess(false);
        }, 5000);
        
        // Принудительно обновляем список сразу и несколько раз подряд для быстрого появления ссылки
        loadTasks(user.fid, true);
        setTimeout(() => loadTasks(user.fid, false), 1000);
        setTimeout(() => loadTasks(user.fid, false), 2000);
        setTimeout(() => loadTasks(user.fid, false), 3000);
      } else {
        loadTasks(user.fid, true);
      }
      
      // Обновляем список задач каждые 2 секунды (быстрее для более оперативного отображения новых ссылок)
      const interval = setInterval(() => {
        loadTasks(user.fid, false);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [router, user, authLoading, isInitialized]);

  const loadTasks = async (userFid: number, showLoading: boolean = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Получаем выбранную активность для фильтрации
      const currentActivity = activity || (typeof window !== 'undefined' ? localStorage.getItem('selected_activity') : null);
      
      // Fetch links from API endpoint (server-side) с фильтрацией по activityType
      const activityParam = currentActivity ? `&activityType=${currentActivity}` : '';
      const linksResponse = await fetch(`/api/tasks?t=${Date.now()}${activityParam}`);
      const linksData = await linksResponse.json();
      const links = linksData.links || [];
      
      // Получаем прогресс пользователя через API endpoint
      const progressResponse = await fetch(`/api/user-progress?userFid=${userFid}&t=${Date.now()}`);
      const progressData = await progressResponse.json();
      const progress = progressData.progress || null;
      const completedLinks = progress?.completed_links || [];
      
      console.log(`📊 [TASKS] Loading progress from API:`, {
        userFid,
        completedLinksCount: completedLinks.length,
        completedLinks: completedLinks,
        activity: currentActivity,
        progressFromAPI: progress,
      });

      // ⚠️ ДОПОЛНИТЕЛЬНАЯ ФИЛЬТРАЦИЯ: Фильтруем по activityType на фронтенде (на случай если backend не отфильтровал)
      let filteredLinks = links;
      if (currentActivity) {
        filteredLinks = links.filter((link: LinkSubmission) => {
          const matches = link.activity_type === currentActivity;
          if (!matches) {
            console.warn(`⚠️ [TASKS] Link ${link.id} filtered out - activity_type: ${link.activity_type}, expected: ${currentActivity}`);
          }
          return matches;
        });
        console.log(`🔍 [TASKS] Frontend filtering: ${links.length} links → ${filteredLinks.length} links (activity: ${currentActivity})`);
      }

      const taskList: TaskProgress[] = filteredLinks.map((link: LinkSubmission) => {
        const castHash = extractCastHash(link.cast_url) || '';
        return {
          link_id: link.id,
          cast_url: link.cast_url,
          cast_hash: castHash,
          activity_type: link.activity_type,
          user_fid_required: userFid, // FID текущего пользователя
          username: link.username,
          pfp_url: link.pfp_url,
          completed: completedLinks.includes(link.id),
          verified: completedLinks.includes(link.id),
          opened: openedTasks[link.id] === true, // Сохраняем состояние opened из локального состояния
        };
      });

      // Считаем количество завершенных заданий ТОЛЬКО для текущего типа активности
      const completedCountForActivity = taskList.filter(task => task.completed).length;

      setTasks(taskList);
      setCompletedCount(completedCountForActivity);
      
      console.log(`✅ Loaded ${taskList.length} tasks, ${completedCountForActivity} completed for activity ${currentActivity}`);
      console.log(`📋 Task links:`, taskList.map((t, i) => ({
        index: i + 1,
        link_id: t.link_id,
        username: t.username,
        cast_url: t.cast_url?.substring(0, 40) + '...',
        completed: t.completed,
      })));
      console.log(`🔍 [TASKS] Activity filter: ${currentActivity || 'NONE'}, Raw links from API: ${links.length}, Filtered links: ${filteredLinks.length}, Final tasks: ${taskList.length}`);
      console.log(`📊 [TASKS] Activity types in loaded links:`, links.map((l: LinkSubmission) => l.activity_type));
      
      // Проверяем: если все задания завершены, проверяем прогресс и делаем автоматический редирект
      // ⚠️ ВАЖНО: Проверяем, не опубликована ли уже ссылка пользователем, чтобы избежать бесконечного редиректа
      if (completedLinks.length >= taskList.length && taskList.length > 0 && user) {
        // ⚠️ КРИТИЧЕСКАЯ ПРОВЕРКА: Сначала проверяем флаг link_published из хранилища
        // Это предотвращает редирект на /submit, если ссылка уже опубликована (даже если БД еще не обновилась)
        const linkPublishedSession = sessionStorage.getItem('link_published');
        const linkPublishedLocal = localStorage.getItem('link_published');
        if (linkPublishedSession === 'true' || linkPublishedLocal === 'true') {
          console.log(`✅ [TASKS] Link already published (from storage), skipping auto-redirect check completely`);
          return; // Прекращаем выполнение, не делаем никаких проверок и редиректов
        }
        
        console.log(`🎯 All tasks completed! Checking user progress for auto-redirect...`);
        
        // Проверяем прогресс пользователя и наличие опубликованной ссылки
        Promise.all([
          fetch(`/api/user-progress?userFid=${user.fid}&t=${Date.now()}`).then(r => r.json()).then(d => d.progress),
          getAllLinks(),
        ]).then(([progress, allLinks]) => {
          if (progress) {
            // Еще раз проверяем флаг перед проверкой в БД (на случай если он установился пока выполнялся запрос)
            const flagCheckSession = sessionStorage.getItem('link_published');
            const flagCheckLocal = localStorage.getItem('link_published');
            if (flagCheckSession === 'true' || flagCheckLocal === 'true') {
              console.log(`✅ [TASKS] Link published flag detected during DB check, skipping redirect`);
              return;
            }
            
            // Проверяем, есть ли уже опубликованная ссылка от этого пользователя
            const userHasPublishedLink = allLinks.some((link: LinkSubmission) => link.user_fid === user.fid);
            
            console.log(`📊 User progress:`, {
              completed_links: progress.completed_links?.length || 0,
              token_purchased: progress.token_purchased,
              user_has_published_link: userHasPublishedLink,
            });
            
            // Если ссылка уже опубликована - не делаем редирект, пользователь может остаться на /tasks
            if (userHasPublishedLink) {
              console.log(`✅ [TASKS] User already published a link (from DB), staying on /tasks page`);
              // Устанавливаем флаг в хранилище для будущих проверок
              sessionStorage.setItem('link_published', 'true');
              localStorage.setItem('link_published', 'true');
              return; // Прекращаем выполнение, не делаем редирект
            }
            
            // Если все задания завершены, но токен не куплен → редирект на /buyToken
            if (!progress.token_purchased) {
              console.log(`🚀 Redirecting to /buyToken (token not purchased)`);
              setTimeout(() => {
                router.replace('/buyToken'); // Используем replace для предотвращения возврата назад
              }, 2000);
            }
            // Если все задания завершены и токен куплен, но ссылка еще не опубликована → редирект на /submit
            // ⚠️ ВАЖНО: Делаем редирект только один раз, не при каждом вызове loadTasks
            else if (progress.token_purchased && !userHasPublishedLink) {
              // Финальная проверка флага перед редиректом
              const finalFlagCheckSession = sessionStorage.getItem('link_published');
              const finalFlagCheckLocal = localStorage.getItem('link_published');
              if (finalFlagCheckSession === 'true' || finalFlagCheckLocal === 'true') {
                console.log(`ℹ️ [TASKS] Link already published (final check), skipping redirect to /submit`);
                return;
              }
              
              // Проверяем, не делали ли мы уже редирект (используем флаг в sessionStorage)
              const redirectDone = sessionStorage.getItem('redirect_to_submit_done');
              if (!redirectDone) {
                console.log(`🚀 Redirecting to /submit (all tasks completed, token purchased, link not published yet)`);
                sessionStorage.setItem('redirect_to_submit_done', 'true');
                setTimeout(() => {
                  router.replace('/submit'); // Используем replace для предотвращения возврата назад
                }, 2000);
              } else {
                console.log(`ℹ️ [TASKS] Redirect to /submit already done in this session, skipping`);
              }
            }
          }
        }).catch((error) => {
          console.error('❌ [TASKS] Error checking user progress for auto-redirect:', error);
        });
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Отметить задачу как открытую
  const markOpened = (linkId: string) => {
    setOpenedTasks(prev => {
      const updated = { ...prev, [linkId]: true };
      // Сохраняем в localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('opened_tasks', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save opened tasks to localStorage:', e);
        }
      }
      return updated;
    });
    // Также обновляем в tasks для немедленного отображения
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.link_id === linkId ? { ...task, opened: true } : task
      )
    );
  };

  // Открыть ссылку
  const handleOpenLink = (castUrl: string, linkId: string) => {
    // Отмечаем задачу как открытую
    markOpened(linkId);
    
    // Определяем, мобильное ли устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // На мобильных устройствах пытаемся открыть в приложении Warpcast
      // Формат: warpcast://cast?url=...
      const warpcastUrl = `warpcast://cast?url=${encodeURIComponent(castUrl)}`;
      
      // Пытаемся открыть в приложении
      window.location.href = warpcastUrl;
      
      // Если приложение не установлено, через 2 секунды открываем веб-версию
      setTimeout(() => {
        window.open(castUrl, '_blank');
      }, 2000);
    } else {
      // На компьютере открываем веб-версию Warpcast
      window.open(castUrl, '_blank');
    }
  };

  // ❌ Убрано: handleToggleTask - нет ручных чекбоксов, только автоматическая проверка через VERIFY ALL TASKS

  // ✅ Обёртка для проверки активности через API
  const verifyActivity = async ({
    castHash,
    castUrl,
    activityType,
    viewerFid,
  }: {
    castHash: string;
    castUrl?: string;
    activityType: ActivityType;
    viewerFid: number;
  }): Promise<{ completed: boolean; userMessage?: string; hashWarning?: string; isError?: boolean; neynarExplorerUrl?: string }> => {
    try {
      const response = await fetch('/api/verify-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          castHash,
          castUrl: castUrl || castHash, // Передаем castUrl если есть, иначе castHash
          userFid: viewerFid,
          activityType,
        }),
      });

      const data = await response.json();
      
      // Если HTTP ошибка (не 200) - это реальная ошибка
      if (!response.ok) {
        return { 
          completed: false,
          userMessage: data.error || data.message || 'Ошибка при проверке активности. Попробуйте ещё раз.',
          isError: true,
        };
      }

      // Если success: false - это ошибка (не удалось расширить hash и т.д.)
      if (!data.success) {
        return { 
          completed: false,
          userMessage: data.error || data.hint || 'Ошибка при проверке активности. Попробуйте ещё раз.',
          isError: true,
        };
      }

      // success: true - проверка прошла успешно, но completed может быть false (активность не найдена)
      return { 
        completed: data.completed || false,
        userMessage: data.completed ? undefined : 'Активность не найдена в сети. Убедитесь, что вы выполнили действие через официальный клиент Farcaster. Попробуйте ещё раз через 1-2 минуты.',
        isError: false, // Это не ошибка, просто активность не найдена
      };
    } catch (error: any) {
      console.error('❌ Neynar API error:', error);
      return { 
        completed: false,
        userMessage: 'Ошибка при проверке активности. Попробуйте ещё раз через 1-2 минуты.',
      };
    }
  };

  // Проверить выполнение всех заданий (правильный алгоритм с Promise.all)
  const handleVerifyAll = async () => {
    console.log('🔍 [VERIFY] Starting verification process...');
    
    // Проверяем наличие user из контекста
    if (!user || !user.fid) {
      console.error('❌ [VERIFY] User is null or missing FID!');
      alert('Ошибка: данные пользователя не найдены. Пожалуйста, авторизуйтесь заново.');
      router.push('/');
      return;
    }

    if (!activity) {
      console.error('❌ [VERIFY] Missing activity');
      return;
    }

    setVerifying(true);

    try {
      console.log(`🔍 [VERIFY] Processing ALL ${tasks.length} tasks in parallel...`);

      // ✅ Сначала помечаем все задачи как проверяемые
      setTasks(prevTasks => 
        prevTasks.map(task => ({ ...task, verifying: true, error: false }))
      );

      // ✅ Параллельная проверка всех задач через Promise.all
      const messages: Array<{ linkId: string; message: string; neynarUrl?: string }> = [];
      const updatedTasks: TaskProgress[] = await Promise.all(
        tasks.map(async (task: TaskProgress) => {
          try {
            // ✅ Важный момент: viewerFid = текущий пользователь (кто проверяет)
            // Проверяем наличие cast_hash перед использованием
            // Явно типизируем task.cast_hash, чтобы TypeScript понимал тип
            const castHash: string = task.cast_hash || '';
            if (!castHash) {
              console.warn(`⚠️ Task ${task.link_id} has no cast_hash, skipping verification`);
              messages.push({
                linkId: task.link_id,
                message: 'Не удалось извлечь hash из ссылки. Проверьте формат ссылки. Требуется полный URL (например, https://warpcast.com/username/0x...) или полный hash (0x + 40 символов).',
              });
              return {
                ...task,
                completed: false,
                verified: true,
                verifying: false,
                error: true, // Ошибка: нет hash
                opened: task.opened || openedTasks[task.link_id] === true,
              } as TaskProgress;
            }

            // Проверяем, что hash не обрезан
            // Если hash короткий, пытаемся использовать полный URL из cast_url
            let hashToVerify = castHash;
            if (castHash.length < 10 || (castHash.length < 42 && castHash.includes('...'))) {
              console.warn(`⚠️ Task ${task.link_id} has truncated hash: ${castHash}`);
              
              // Пытаемся извлечь hash из полного URL, если он есть
              if (task.cast_url && task.cast_url.length > 50) {
                const fullHash = extractCastHash(task.cast_url);
                if (fullHash && fullHash.length >= 10 && !fullHash.includes('...')) {
                  console.log(`✅ [VERIFY] Using full hash from cast_url: ${fullHash.substring(0, 20)}...`);
                  hashToVerify = fullHash;
                } else {
                  messages.push({
                    linkId: task.link_id,
                    message: 'Hash обрезан. Требуется полный URL или полный hash (0x + 40 hex символов). Скопируйте полную ссылку из Warpcast.',
                  });
                  return {
                    ...task,
                    completed: false,
                    verified: true,
                    verifying: false,
                    error: true,
                    opened: task.opened || openedTasks[task.link_id] === true,
                  } as TaskProgress;
                }
              } else {
                messages.push({
                  linkId: task.link_id,
                  message: 'Hash обрезан. Требуется полный URL или полный hash (0x + 40 hex символов). Скопируйте полную ссылку из Warpcast.',
                });
                return {
                  ...task,
                  completed: false,
                  verified: true,
                  verifying: false,
                  error: true,
                  opened: task.opened || openedTasks[task.link_id] === true,
                } as TaskProgress;
              }
            }

            // Передаем также cast_url для автоматического разрешения коротких ссылок
            const result = await verifyActivity({
              castHash: hashToVerify,
              castUrl: task.cast_url, // Передаем полный URL для разрешения коротких ссылок
              activityType: task.activity_type || activity,
              viewerFid: user.fid, // ✅ используем текущего пользователя
            });

            // Определяем, была ли ошибка (cast не найден)
            const hasError = result.isError || (!result.completed && (
              result.userMessage?.includes('не найден') || 
              result.userMessage?.includes('Cast не найден') ||
              result.userMessage?.includes('Неверный формат')
            ));

            // Собираем сообщения об ошибках для пользователя
            if (!result.completed && result.userMessage) {
              messages.push({
                linkId: task.link_id,
                message: result.userMessage,
                neynarUrl: result.neynarExplorerUrl,
              });
            }

            // Логируем предупреждения о hash
            if (result.hashWarning) {
              console.warn(`⚠️ [VERIFY] Hash warning for task ${task.link_id}:`, result.hashWarning);
            }

            // Если задача выполнена - сохраняем в БД
            if (result.completed) {
              try {
                const markResponse = await fetch('/api/mark-completed', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    userFid: user.fid,
                    linkId: task.link_id,
                  }),
                });

                if (markResponse.ok) {
                  const markData = await markResponse.json();
                  if (markData.success) {
                    console.log(`✅ Marked link ${task.link_id} as completed in DB`);
                  }
                }
              } catch (markError) {
                console.error(`❌ Failed to mark link ${task.link_id} as completed:`, markError);
                // Не прерываем процесс, но логируем ошибку
              }
            }

            return {
              ...task,
              completed: result.completed,
              verified: true,
              verifying: false,
              error: hasError,
              opened: task.opened || openedTasks[task.link_id] === true, // Сохраняем состояние opened
            } as TaskProgress;
          } catch (err: any) {
            console.error('❌ Neynar API error for task:', task.link_id, err);
            messages.push({
              linkId: task.link_id,
              message: 'Ошибка при проверке активности. Попробуйте ещё раз через 1-2 минуты.',
            });
            return {
              ...task,
              completed: false,
              verified: true, // Помечаем как проверенное, но не выполненное
              verifying: false,
              error: true, // Ошибка при проверке
              opened: task.opened || openedTasks[task.link_id] === true,
            } as TaskProgress;
          }
        })
      );

      // Сохраняем сообщения для отображения пользователю
      setVerificationMessages(messages);

      // Обновляем состояние
      const newCompletedCount = updatedTasks.filter(t => t.completed).length;
      
      setTasks(updatedTasks);
      setCompletedCount(newCompletedCount);
      setIncompleteLinks(updatedTasks.filter(t => !t.completed).map(t => t.cast_url));

      console.log(`📊 [VERIFY] Verification complete: ${newCompletedCount}/${updatedTasks.length} completed`);

      // ✅ Перезагружаем задачи из API для получения актуальных данных
      if (newCompletedCount > 0) {
        setTimeout(() => {
          loadTasks(user.fid, false);
        }, 1000);
      }

      // ✅ Если все выполнены - редирект на покупку токена
      const allCompleted = updatedTasks.every((t) => t.completed);
      if (allCompleted && updatedTasks.length > 0) {
        console.log(`✅ All tasks completed! (${newCompletedCount}/${updatedTasks.length})`);
        setTimeout(() => {
          router.push('/buyToken');
        }, 1500);
      } else if (newCompletedCount < updatedTasks.length) {
        // Показываем предупреждение с детальными сообщениями
        const incompleteCount = updatedTasks.length - newCompletedCount;
        let message = `Вы не выполнили все задания. Проверьте оставшиеся ${incompleteCount} ссылок.\n\n`;
        
        if (messages.length > 0) {
          message += 'Детали:\n';
          messages.forEach((msg, idx) => {
            message += `\n${idx + 1}. ${msg.message}`;
            if (msg.neynarUrl) {
              message += `\n   Проверьте: ${msg.neynarUrl}`;
            }
          });
        }
        
        console.warn(message);
        alert(message);
      }
    } catch (error: any) {
      console.error('❌ Error verifying tasks:', error);
      alert(`Ошибка при проверке заданий: ${error.message || 'Unknown error'}\n\nПроверьте консоль браузера для деталей.`);
    } finally {
      setVerifying(false);
    }
  };


  if (loading) {
    return (
      <Layout title="Loading Tasks...">
        <div className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
          <div className="relative z-10 flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <p className="text-white text-xl font-bold">Loading Tasks...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Multi Like - Tasks">
      {/* Уведомление о публикации ссылки */}
      {showPublishedSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down max-w-md w-full mx-4">
          <div className="bg-gradient-to-r from-success to-green-500 text-white rounded-2xl shadow-2xl p-6 border-4 border-white">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="text-5xl animate-bounce">🎉</div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black mb-1">Поздравляем!</h3>
                <p className="text-lg font-bold">Ваша ссылка опубликована!</p>
                <p className="text-sm text-green-100 mt-1">Она теперь доступна в списке заданий.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section с градиентом */}
      <div className="relative min-h-screen overflow-hidden">
        {/* Анимированный градиент фон */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent animate-gradient bg-300%"></div>
        
        {/* Геометрические фигуры */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white bg-opacity-10 rounded-full animate-float"></div>
        <div className="absolute bottom-32 left-20 w-24 h-24 bg-white bg-opacity-15 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          {/* Заголовок в стиле модного сайта */}
          <div className="text-center mb-16">
            <h1 className="text-7xl md:text-9xl font-black text-white mb-8 font-display leading-none tracking-tight">
              TASKS
            </h1>
            <div className="flex items-center justify-center gap-6 mb-10">
              <div className="w-24 h-1 bg-white"></div>
              <div className="flex items-center gap-4">
                {/* Фото Миссис Крипто */}
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                  <Image
                    src="/images/mrs-crypto.jpg"
                    alt="Mrs. Crypto"
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                    priority
                    unoptimized
                  />
                </div>
              </div>
              <div className="w-24 h-1 bg-white"></div>
            </div>
            <p className="text-2xl md:text-4xl text-white font-bold mb-6 tracking-wide">
              COMPLETE YOUR ACTIVITY TASKS
            </p>
            <p className="text-2xl md:text-3xl text-white text-opacity-90 max-w-2xl mx-auto">
              <span className="whitespace-nowrap">Open each link and perform activity:</span>
              {' '}
              <span className="font-bold text-yellow-300 text-3xl md:text-4xl whitespace-nowrap">
                {activity === 'like' && '❤️ LIKE'}
                {activity === 'recast' && '🔄 RECAST'}
                {activity === 'comment' && '💬 COMMENT'}
              </span>
            </p>
          </div>

          {/* Модная карточка прогресса */}
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-12 border border-white border-opacity-20 mt-32">
            <ProgressBar completed={completedCount} total={tasks.length} tasks={tasks} />
          </div>

          {/* Предупреждение о невыполненных заданиях */}
          {incompleteLinks.length > 0 && (
            <div className="bg-gradient-to-r from-warning/20 to-orange-500/20 backdrop-blur-sm border-2 border-warning rounded-2xl p-8 mb-8 shadow-xl">
              <h3 className="font-black text-yellow-800 mb-4 flex items-center gap-3 text-2xl md:text-3xl">
                <span className="text-3xl md:text-4xl">⚠️</span>
                INCOMPLETE TASKS ({incompleteLinks.length})
              </h3>
              <p className="text-yellow-800 mb-4 font-bold text-lg md:text-xl">
                The following links were not completed:
              </p>
              <ul className="space-y-3">
                {incompleteLinks.map((link, index) => (
                  <li key={index} className="text-yellow-900 truncate bg-white bg-opacity-50 px-4 py-3 rounded-lg text-base md:text-lg">
                    • {link}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Сообщения о проблемах с верификацией */}
          {verificationMessages.length > 0 && (
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm border-2 border-red-500 rounded-2xl p-8 mb-8 shadow-xl">
              <h3 className="font-black text-red-800 mb-4 flex items-center gap-3 text-2xl md:text-3xl">
                <span className="text-3xl md:text-4xl">ℹ️</span>
                ИНФОРМАЦИЯ О ПРОВЕРКЕ ({verificationMessages.length})
              </h3>
              <div className="space-y-4">
                {verificationMessages.map((msg, index) => {
                  const task = tasks.find(t => t.link_id === msg.linkId);
                  return (
                    <div key={index} className="bg-white bg-opacity-70 rounded-lg p-4">
                      <p className="text-red-900 font-bold text-base md:text-lg mb-2">
                        {task ? `Ссылка: ${task.cast_url.substring(0, 50)}...` : `Задача #${index + 1}`}
                      </p>
                      <p className="text-red-800 text-sm md:text-base mb-2">
                        {msg.message}
                      </p>
                      {msg.neynarUrl && (
                        <a
                          href={msg.neynarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm md:text-base font-semibold"
                        >
                          🔍 Проверить в Neynar Explorer →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Список заданий */}
          <div className="space-y-6 mb-12">
            {tasks.map((task, index) => {
              // Объединяем opened из состояния tasks и openedTasks
              const taskWithOpened = {
                ...task,
                opened: task.opened || openedTasks[task.link_id] === true,
              };
              return (
                <TaskCard
                  key={task.link_id}
                  task={taskWithOpened}
                  index={index}
                  onOpen={() => handleOpenLink(task.cast_url, task.link_id)}
                />
              );
            })}
          </div>

          {/* Модная кнопка проверки */}
          <div className="sticky bottom-8 bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white border-opacity-20">
            <button
              onClick={handleVerifyAll}
              disabled={verifying}
              className={`
                relative group w-full px-12 py-8 rounded-2xl text-white font-black text-2xl md:text-3xl
                transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                backdrop-blur-sm border border-white border-opacity-20
                shadow-2xl shadow-primary/50 bg-gradient-to-r from-primary/80 via-red-600/80 to-accent/80 hover:from-red-500/90 hover:via-purple-500/90 hover:to-accent/90
              `}
            >
              <div className="flex items-center justify-center gap-4">
                {verifying ? (
                  <>
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    <span>VERIFYING...</span>
                  </>
                ) : (
                  <>
                    <span>VERIFY COMPLETION</span>
                    <span className="text-4xl md:text-5xl">🔍</span>
                  </>
                )}
              </div>
              {!verifying && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}
            </button>

            {tasks.length > 0 && completedCount === tasks.length && (
              <div className="text-center mt-8">
                <p className="text-black font-black text-2xl md:text-3xl mb-4">
                  Excellent! All tasks completed! 🎉
                </p>
                <p className="text-gray-700 text-lg font-semibold">
                  Redirecting to next step...
                </p>
                <div className="flex justify-center mt-4">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

