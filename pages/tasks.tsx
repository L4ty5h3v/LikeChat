// Страница задач: прохождение 10 ссылок
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import TaskCard from '@/components/TaskCard';
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
  const [showPublishedSuccess, setShowPublishedSuccess] = useState(false);
  const [verificationMessages, setVerificationMessages] = useState<Array<{ linkId: string; message: string; neynarUrl?: string }>>([]);
  // Состояние openedTasks только в памяти (не сохраняется в localStorage)
  // Сбрасывается при каждой загрузке страницы, чтобы можно было открывать ссылки снова
  const [openedTasks, setOpenedTasks] = useState<Record<string, boolean>>({});
  // Храним активные polling интервалы для очистки
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

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

      // Сбрасываем состояние opened при загрузке задач, чтобы можно было открывать ссылки снова
      // НЕ сбрасываем openedTasks в рамках одной сессии - сохраняем состояние открытых ссылок
      // setOpenedTasks({});
      
      const taskList: TaskProgress[] = filteredLinks.map((link: LinkSubmission, index: number) => {
        const castHash = extractCastHash(link.cast_url) || '';
        const isCompleted = completedLinks.includes(link.id);
        const isOpened = openedTasks[link.id] === true;
        // Если задание не открыто и не выполнено - это ошибка (должно быть красным)
        const hasError = !isOpened && !isCompleted;
        
        return {
          link_id: link.id,
          cast_url: link.cast_url,
          cast_hash: castHash,
          activity_type: link.activity_type,
          user_fid_required: userFid, // FID текущего пользователя
          username: link.username,
          pfp_url: link.pfp_url,
          completed: isCompleted,
          verified: isCompleted,
          opened: isOpened,
          error: hasError, // Устанавливаем error для неоткрытых и невыполненных заданий
          _originalIndex: index, // Сохраняем оригинальный индекс для стабильной сортировки
        };
      }).sort((a: TaskProgress, b: TaskProgress) => {
        // Сохраняем порядок с сервера (новые первыми), но добавляем стабильную сортировку
        // Сначала по статусу выполнения (невыполненные первыми)
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1; // Невыполненные первыми
        }
        // Если статус одинаковый, сохраняем оригинальный порядок с сервера
        return (a as any)._originalIndex - (b as any)._originalIndex;
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
      // ⚠️ КРИТИЧНО: Проверяем, что все задания действительно выполнены И открыты И нет ошибок
      const allTasksCompleted = completedLinks.length >= taskList.length;
      const allTasksOpened = taskList.length > 0 && taskList.every((task) => task.opened || task.completed);
      const hasErrors = taskList.some((task) => task.error);
      
      // НЕ делаем редирект, если есть ошибки (неоткрытые задания)
      if (allTasksCompleted && allTasksOpened && !hasErrors && taskList.length > 0 && user) {
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
            
            // Если все задания завершены → редирект на /buyToken (независимо от статуса токена)
            console.log(`🚀 Redirecting to /buyToken (all tasks completed)`);
              setTimeout(() => {
                router.replace('/buyToken'); // Используем replace для предотвращения возврата назад
              }, 2000);
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

  // Отметить задачу как открытую (только в памяти, не сохраняем в localStorage)
  // Это позволяет открывать ссылки снова при следующей загрузке страницы
  const markOpened = (linkId: string) => {
    setOpenedTasks(prev => ({ ...prev, [linkId]: true }));
    // Также обновляем в tasks для немедленного отображения
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.link_id === linkId ? { ...task, opened: true } : task
      )
    );
  };

  // Polling для автоматической проверки активности после открытия ссылки
  const startPollingForActivity = (castUrl: string, linkId: string, activityType: ActivityType) => {
    if (!user?.fid) return;

    // Если уже есть активный polling для этой ссылки, не создаем новый
    if (pollingIntervalsRef.current[linkId]) {
      console.log(`⚠️ [POLLING] Polling already active for link ${linkId}`);
      return;
    }

    console.log(`🔄 [POLLING] Starting polling for link ${linkId}`, { castUrl, activityType });
    
    // Ждем 30 секунд перед первой проверкой (даем время на индексацию)
    const initialDelay = 30000; // 30 секунд
    
    const timeoutId = setTimeout(() => {
      let pollCount = 0;
      const maxPolls = 10; // Максимум 10 проверок (5 минут)
      const pollInterval = 30000; // Проверяем каждые 30 секунд
      
      const pollIntervalId = setInterval(async () => {
        pollCount++;
        console.log(`🔄 [POLLING] Poll attempt ${pollCount}/${maxPolls} for link ${linkId}`);
        
        try {
          const result = await verifyActivity({
            castHash: '',
            castUrl: castUrl,
            activityType: activityType,
            viewerFid: user.fid,
          });
          
          if (result.completed) {
            console.log(`✅ [POLLING] Activity found for link ${linkId}!`);
            
            // Обновляем задачу как выполненную (НЕ останавливаем polling сразу)
            setTasks(prevTasks =>
              prevTasks.map(task =>
                task.link_id === linkId
                  ? { ...task, completed: true, verified: true, verifying: false, error: false }
                  : task
              )
            );
            
            // Помечаем ссылку как выполненную в базе
            try {
              const markResponse = await fetch('/api/mark-completed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userFid: user.fid, linkId }),
              });
              
              if (!markResponse.ok) {
                console.error(`[POLLING] Failed to mark link as completed: ${markResponse.status} ${markResponse.statusText}`);
              } else {
                console.log(`✅ [POLLING] Link ${linkId} marked as completed in DB`);
              }
            } catch (e) {
              console.error('[POLLING] Error marking link as completed', e);
            }
            
            // Останавливаем polling только после успешного сохранения
            clearInterval(pollIntervalId);
            delete pollingIntervalsRef.current[linkId];
            return; // Выходим из интервала
          } else if (pollCount >= maxPolls) {
            console.log(`⏰ [POLLING] Max polls reached for link ${linkId}, stopping`);
            clearInterval(pollIntervalId);
            delete pollingIntervalsRef.current[linkId];
          }
        } catch (error) {
          console.error(`❌ [POLLING] Error during poll for link ${linkId}`, error);
          if (pollCount >= maxPolls) {
            clearInterval(pollIntervalId);
            delete pollingIntervalsRef.current[linkId];
          }
        }
      }, pollInterval);
      
      // Сохраняем ID интервала для очистки
      pollingIntervalsRef.current[linkId] = pollIntervalId;
    }, initialDelay);
    
    // Сохраняем timeout ID тоже для очистки
    pollingIntervalsRef.current[`${linkId}_timeout`] = timeoutId as any;
  };

  // Очистка всех polling интервалов при размонтировании
  useEffect(() => {
    return () => {
      Object.values(pollingIntervalsRef.current).forEach(intervalId => {
        if (typeof intervalId === 'number') {
          clearInterval(intervalId);
        } else {
          clearTimeout(intervalId);
        }
      });
      pollingIntervalsRef.current = {};
    };
  }, []);

  // Открыть ссылку
  const handleOpenLink = (castUrl: string, linkId: string) => {
    // Отмечаем задачу как открытую
    markOpened(linkId);
    
    // Запускаем polling для автоматической проверки
    if (activity) {
      startPollingForActivity(castUrl, linkId, activity);
    }
    
    // Определяем, мобильное ли устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // На мобильных устройствах пытаемся открыть в приложении Farcaster
      // Формат: farcaster://cast?url=...
      const farcasterUrl = `farcaster://cast?url=${encodeURIComponent(castUrl)}`;
      
      // Пытаемся открыть в приложении
      window.location.href = farcasterUrl;
      
      // Если приложение не установлено, через 2 секунды открываем веб-версию
      setTimeout(() => {
        window.open(castUrl, '_blank');
      }, 2000);
    } else {
      // На компьютере открываем веб-версию Farcaster
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
      const requestBody = {
        castUrl: castUrl || castHash, // Передаем весь URL
        userFid: viewerFid,
        activityType,
      };
      
      console.log('[CLIENT] verifyActivity: Sending request:', requestBody);
      console.log('[CLIENT] verifyActivity: viewerFid type:', typeof viewerFid, 'value:', viewerFid);
      
      // Отправляем castUrl (весь URL, даже с "...")
      const response = await fetch('/api/verify-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[CLIENT] verifyActivity: Response status:', response.status, response.statusText);

      const data = await response.json();
      
      // Если HTTP ошибка (не 200) - это реальная ошибка
      if (!response.ok) {
        return { 
          completed: false,
          userMessage: data.error || data.message || 'Error checking activity. Please try again.',
          isError: true,
        };
      }

      // Если success: false - это ошибка (не удалось расширить hash и т.д.)
      if (!data.success) {
        return { 
          completed: false,
          userMessage: data.error || data.hint || 'Error checking activity. Please try again.',
          isError: true,
        };
      }

      // success: true - проверка прошла успешно, но completed может быть false (активность не найдена)
      return { 
        completed: data.completed || false,
        userMessage: data.completed ? undefined : 'Activity not found on the network. Make sure you performed the action through the official Farcaster client. Please try again in 1-2 minutes.',
        isError: false, // Это не ошибка, просто активность не найдена
      };
    } catch (error: any) {
      console.error('❌ Neynar API error:', error);
      return { 
        completed: false,
        userMessage: 'Error checking activity. Please try again in 1-2 minutes.',
      };
    }
  };

  // Проверить выполнение всех заданий (правильный алгоритм с Promise.all)
  const handleVerifyAll = async () => {
    console.log('🔍 [VERIFY] Starting verification process...');
    
    // Проверяем наличие user из контекста
    if (!user || !user.fid) {
      console.error('❌ [VERIFY] User is null or missing FID!');
      alert('Error: user data not found. Please authorize again.');
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
            // ✅ Отправляем castUrl (весь URL, даже с "...")
            // API сам разрешит URL через getFullCastHash
            if (!task.cast_url) {
              console.warn(`⚠️ Task ${task.link_id} has no cast_url, skipping verification`);
              messages.push({
                linkId: task.link_id,
                message: 'Отсутствует ссылка на cast. Проверьте формат ссылки.',
              });
              
              // Удаляем ссылку из базы данных
              try {
                const deleteResponse = await fetch('/api/delete-link', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ linkId: task.link_id }),
                });
                
                if (deleteResponse.ok) {
                  console.log(`🗑️ Deleted link ${task.link_id} (no cast_url)`);
                  // Удаляем задание из списка задач
                  setTasks(prevTasks => prevTasks.filter(t => t.link_id !== task.link_id));
                  // Перезагружаем список задач через 1 секунду, чтобы получить новую ссылку
                  setTimeout(() => {
                    if (user?.fid) {
                      loadTasks(user.fid, false);
                    }
                  }, 1000);
                } else {
                  console.warn(`⚠️ Failed to delete link ${task.link_id}: ${deleteResponse.status}`);
                }
              } catch (e) {
                console.error(`❌ Failed to delete link ${task.link_id}:`, e);
              }
              
              return {
                ...task,
                completed: false,
                verified: true,
                verifying: false,
                error: true,
                opened: task.opened || openedTasks[task.link_id] === true,
              } as TaskProgress;
            }

            console.log(`[CLIENT] handleVerifyAll: Verifying task ${task.link_id}`, {
              castUrl: task.cast_url,
              activityType: task.activity_type || activity,
              userFid: user.fid,
              userFidType: typeof user.fid,
              userObject: { fid: user.fid, username: user.username }
            });
            
            // ВАЖНО: Проверяем, что FID правильный
            if (!user.fid || user.fid !== 799806) {
              console.warn(`[CLIENT] handleVerifyAll: WARNING - User FID is ${user.fid}, expected 799806`);
            }
            
            const result = await verifyActivity({
              castHash: '', // Не используется, передаем castUrl
              castUrl: task.cast_url, // ВАЖНО: передаем весь URL для разрешения
              activityType: task.activity_type || activity,
              viewerFid: user.fid, // ✅ используем текущего пользователя
            });
            
            console.log(`[CLIENT] handleVerifyAll: Result for task ${task.link_id}:`, {
              completed: result.completed,
              isError: result.isError,
              userMessage: result.userMessage,
              castHash: result.hashWarning
            });

            // Определяем, была ли ошибка (cast не найден или активность не найдена)
            // Если активность не найдена (completed: false), это тоже ошибка для визуального отображения
            // Также если задача не была открыта и не выполнена, это ошибка
            // Для комментариев: если completed: false, это ошибка (комментарий не найден)
            const hasError = result.isError || 
                            (!result.completed && result.userMessage) || 
                            (!task.opened && !result.completed) ||
                            (!result.completed && !result.isError); // Если проверка прошла, но активность не найдена - это ошибка
            
            // Если каст не найден (error: true), удаляем ссылку из базы данных
            if (result.isError) {
              try {
                const deleteResponse = await fetch('/api/delete-link', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ linkId: task.link_id }),
                });
                
                if (deleteResponse.ok) {
                  console.log(`🗑️ Deleted link ${task.link_id} (cast not found)`);
                  // Удаляем задание из списка задач
                  setTasks(prevTasks => prevTasks.filter(t => t.link_id !== task.link_id));
                  // Перезагружаем список задач через 1 секунду, чтобы получить новую ссылку
                  setTimeout(() => {
                    if (user?.fid) {
                      loadTasks(user.fid, false);
                    }
                  }, 1000);
                } else {
                  console.warn(`⚠️ Failed to delete link ${task.link_id}: ${deleteResponse.status}`);
                }
              } catch (e) {
                console.error(`❌ Error deleting link ${task.link_id}:`, e);
              }
            }

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
              message: 'Error checking activity. Please try again in 1-2 minutes.',
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

      console.log(`📊 [VERIFY] Verification complete: ${newCompletedCount}/${updatedTasks.length} completed`);

      // ✅ Если все выполнены - редирект на покупку токена (НЕ перезагружаем задачи, чтобы кнопки остались зелеными)
      // ⚠️ КРИТИЧНО: Проверяем, что все задания выполнены И открыты И нет ошибок
      const allCompleted = updatedTasks.every((t) => t.completed);
      const allOpened = updatedTasks.every((t) => t.opened || t.completed); // Открыты или выполнены
      const hasErrors = updatedTasks.some((t) => t.error);
      
      // НЕ делаем редирект, если есть ошибки (неоткрытые задания)
      if (allCompleted && allOpened && !hasErrors && updatedTasks.length > 0) {
        console.log(`✅ All tasks completed! (${newCompletedCount}/${updatedTasks.length})`);
        // НЕ перезагружаем задачи, чтобы кнопки остались зелеными
        setTimeout(() => {
          router.replace('/buyToken'); // Используем replace вместо push
        }, 2000);
      } else if (newCompletedCount > 0 && newCompletedCount < updatedTasks.length) {
        // Перезагружаем задачи только если не все выполнены
        setTimeout(() => {
          loadTasks(user.fid, false);
        }, 1000);
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
      alert(`Error verifying tasks: ${error.message || 'Unknown error'}\n\nCheck browser console for details.`);
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


          {/* Сообщения о проблемах с верификацией */}
          {verificationMessages.length > 0 && (
            <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm border-2 border-red-500 rounded-2xl p-8 mb-8 shadow-xl">
              <h3 className="font-black text-red-800 mb-4 flex items-center gap-3 text-2xl md:text-3xl">
                <span className="text-3xl md:text-4xl">ℹ️</span>
                VERIFICATION INFO ({verificationMessages.length})
              </h3>
              <div className="space-y-4">
                {verificationMessages.map((msg, index) => {
                  const task = tasks.find(t => t.link_id === msg.linkId);
                  return (
                    <div key={index} className="bg-white bg-opacity-70 rounded-lg p-4">
                      <p className="text-red-900 font-bold text-base md:text-lg mb-2">
                        {task ? `Link: ${task.cast_url.substring(0, 50)}...` : `Task #${index + 1}`}
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
                          🔍 Check in Neynar Explorer →
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

