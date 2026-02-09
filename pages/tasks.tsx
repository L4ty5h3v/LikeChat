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
import type { LinkSubmission, TaskType, TaskProgress } from '@/types';

export default function Tasks() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const { user, isLoading: authLoading, isInitialized } = useFarcasterAuth();
  const [activity, setActivity] = useState<TaskType | null>(null);
  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [showPublishedSuccess, setShowPublishedSuccess] = useState(false);
  const [verificationMessages, setVerificationMessages] = useState<Array<{ linkId: string; message: string; neynarUrl?: string }>>([]);
  const [apiAccessBlocked, setApiAccessBlocked] = useState(false);
  const [apiAccessBlockedMessage, setApiAccessBlockedMessage] = useState<string | null>(null);
  // Состояние openedTasks только в памяти (не сохраняется в localStorage)
  // Сбрасывается при каждой загрузке страницы, чтобы можно было открывать ссылки снова
  const [openedTasks, setOpenedTasks] = useState<Record<string, boolean>>({});
  // Храним состояние ошибок для заданий (используем useRef для сохранения между рендерами)
  const taskErrorsRef = useRef<Record<string, boolean>>({});
  // Храним активные polling интервалы для очистки
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  // ⚠️ КРИТИЧНО: Храним verified задания в ref, чтобы они не терялись при обновлениях
  const verifiedTasksRef = useRef<Set<string>>(new Set());

  const stopAllPolling = () => {
    Object.values(pollingIntervalsRef.current).forEach((intervalId) => {
      if (typeof intervalId === 'number') {
        clearInterval(intervalId);
      } else {
        clearTimeout(intervalId as any);
      }
    });
    pollingIntervalsRef.current = {};
  };

  useEffect(() => {
    if (!apiAccessBlocked) return;
    stopAllPolling();
    // Снимаем "verifying" чтобы UI не зависал
    setTasks(prev => prev.map(t => ({ ...t, verifying: false })));
    setVerifying(false);
  }, [apiAccessBlocked]);

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

      setActivity(savedActivity as TaskType);
      
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
      
      // Обновляем список задач с более щадящим интервалом.
      // Частые запросы могут триггерить Vercel Security Checkpoint (403 + HTML), который ломает API внутри miniapp iframe.
      const REFRESH_MS = 15000; // 15 секунд

      const tick = () => {
        if (apiAccessBlocked) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        loadTasks(user.fid, false);
      };

      const interval = setInterval(tick, REFRESH_MS);
      const onVis = () => tick();
      document.addEventListener('visibilitychange', onVis);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVis);
      };
    }
  }, [router, user, authLoading, isInitialized, apiAccessBlocked]);

  // ⚠️ КРИТИЧНО: Автоматически запускаем polling для всех открытых заданий после загрузки
  useEffect(() => {
    if (!user?.fid || !activity || tasks.length === 0) return;
    if (apiAccessBlocked) return;

    // Запускаем polling для всех открытых заданий, которые еще не выполнены
    tasks.forEach((task) => {
      // ⚠️ КРИТИЧНО: Пропускаем задания с completed && verified - проверки для них прекращены
      const isCompleted = task.completed && task.verified;
      if (isCompleted) {
        return; // Пропускаем - проверки прекращены
      }
      
      const isOpened = task.opened || openedTasks[task.link_id] === true;
      
      // Запускаем polling только если задание открыто, но еще не выполнено
      if (isOpened && task.cast_url) {
        // Проверяем, не запущен ли уже polling для этого задания
        if (!pollingIntervalsRef.current[task.link_id]) {
          console.log(`🔄 [AUTO-POLLING] Starting polling for opened task ${task.link_id}`);
          startPollingForActivity(task.cast_url, task.link_id, task.task_type || activity);
        }
      }
    });
  }, [tasks, user?.fid, activity, openedTasks, apiAccessBlocked]);

  const loadTasks = async (userFid: number, showLoading: boolean = true) => {
    if (apiAccessBlocked) return;
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Получаем выбранную активность для фильтрации
      const currentActivity = activity || (typeof window !== 'undefined' ? localStorage.getItem('selected_activity') : null);
      
      // Fetch links from API endpoint (server-side) с фильтрацией по taskType
      const taskTypeParam = currentActivity ? `&taskType=${currentActivity}` : '';
      const parseJsonOrCheckpoint = async (res: Response, label: string) => {
        const ct = res.headers.get('content-type') || '';
        const isCheckpoint =
          res.status === 403 &&
          (res.headers.get('x-vercel-mitigated') === 'challenge' ||
            res.headers.has('x-vercel-challenge-token') ||
            ct.includes('text/html'));

        if (isCheckpoint) {
          setApiAccessBlocked(true);
          setApiAccessBlockedMessage(
            '⚠️ API blocked by Vercel Security Checkpoint (bot/challenge protection). This breaks tasks loading and verification inside Farcaster miniapp iframe.\n\nFix in Vercel Dashboard: disable bot/challenge protection OR add an allow rule for /api/*.'
          );
          console.error(`🚫 [TASKS] Vercel Security Checkpoint blocking ${label}:`, {
            status: res.status,
            contentType: ct,
            vercelMitigated: res.headers.get('x-vercel-mitigated'),
          });
          return null;
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`[${label}] HTTP ${res.status}. ${txt.slice(0, 120)}`);
        }
        if (!ct.includes('application/json')) {
          const txt = await res.text().catch(() => '');
          throw new Error(`[${label}] Non-JSON response (${ct}). ${txt.slice(0, 120)}`);
        }
        return await res.json();
      };

      const linksResponse = await fetch(`/api/tasks?t=${Date.now()}${taskTypeParam}`);
      const linksData = await parseJsonOrCheckpoint(linksResponse, '/api/tasks');
      if (!linksData) return;
      const links = linksData.links || [];
      
      // Получаем прогресс пользователя через API endpoint
      const progressResponse = await fetch(`/api/user-progress?userFid=${userFid}&t=${Date.now()}`);
      const progressData = await parseJsonOrCheckpoint(progressResponse, '/api/user-progress');
      if (!progressData) return;
      const progress = progressData.progress || null;
      const completedLinks = progress?.completed_links || [];
      
      console.log(`📊 [TASKS] Loading progress from API:`, {
        userFid,
        completedLinksCount: completedLinks.length,
        completedLinks: completedLinks,
        activity: currentActivity,
        progressFromAPI: progress,
      });

      // ⚠️ ФИЛЬТРАЦИЯ: Фильтруем по taskType на фронтенде (на случай если backend не отфильтровал)
      let filteredLinks = links;
      if (currentActivity && links.length > 0) {
        filteredLinks = links.filter((link: LinkSubmission) => {
          // Поддержка как task_type (новое), так и activity_type (старое) для обратной совместимости
          const linkTaskType = link.task_type || (link as any).activity_type;
          const matches = linkTaskType === currentActivity;
          if (!matches) {
            console.warn(`⚠️ [TASKS] Link ${link.id} filtered out - task_type: ${linkTaskType}, expected: ${currentActivity}`);
          }
          return matches;
        });
        console.log(`🔍 [TASKS] Frontend filtering: ${links.length} links → ${filteredLinks.length} links (activity: ${currentActivity})`);
        
        // ⚠️ ВАЖНО: Строгая фильтрация - показываем только ссылки нужного типа, даже если список пустой
        // Не показываем все ссылки, если нет ссылок нужного типа - это нарушает разделение по типам
      } else {
        // Если activity не выбрана, показываем все ссылки
        console.log(`📋 [TASKS] No activity filter - showing all ${links.length} links`);
      }
      
      console.log(`✅ [TASKS] Final filtered links count: ${filteredLinks.length}`);

      // Сбрасываем состояние opened при загрузке задач, чтобы можно было открывать ссылки снова
      // НЕ сбрасываем openedTasks в рамках одной сессии - сохраняем состояние открытых ссылок
      // setOpenedTasks({});
      
      // ⚠️ КРИТИЧНО: Сохраняем текущие состояния задач для сохранения verifying и error
      const currentTasksMap = new Map(tasks.map(t => [t.link_id, t]));
      
      // ⚠️ КРИТИЧНО: Обновляем verifiedTasksRef из текущего состояния
      tasks.forEach(task => {
        if (task.completed && task.verified) {
          verifiedTasksRef.current.add(task.link_id);
        }
      });
      
      const taskList: TaskProgress[] = filteredLinks.map((link: LinkSubmission, index: number) => {
        // Prefer server-resolved full hash when available; fall back to extracting from URL.
        const castHash = (link as any).cast_hash || extractCastHash(link.cast_url) || '';
        const isCompleted = completedLinks.includes(link.id);
        const isOpened = openedTasks[link.id] === true;
        
        // ⚠️ КРИТИЧНО: Проверяем verifiedTasksRef ПЕРВЫМ - это источник истины
        // Если задание в verifiedTasksRef, оно ВСЕГДА completed && verified
        const isVerifiedInRef = verifiedTasksRef.current.has(link.id);
        
        // ⚠️ КРИТИЧНО: Если задание уже было проверено (в ref или в текущем состоянии),
        // НЕ перезаписываем это состояние - проверки для него прекращаются
        const currentTask = currentTasksMap.get(link.id);
        const wasVerifiedInState = currentTask?.completed === true && currentTask?.verified === true;
        const wasVerified = isVerifiedInRef || wasVerifiedInState;
        
        // Логируем для отладки
        if (isVerifiedInRef) {
          console.log(`🔒 [LOAD] Task ${link.id} is in verifiedTasksRef - preserving completed state`);
        }
        if (wasVerifiedInState && !isVerifiedInRef) {
          console.log(`🔒 [LOAD] Task ${link.id} was verified in state - adding to ref`);
          verifiedTasksRef.current.add(link.id);
        }
        
        // ⚠️ КРИТИЧНО: Задача считается выполненной только если она verified ИЛИ completed через API
        // НЕ считаем открытые задачи выполненными автоматически - это будет проверено через API
        const finalCompleted = wasVerified ? true : isCompleted;
        const finalVerified = wasVerified ? true : isCompleted;
        
        // ⚠️ КРИТИЧНО: Если задание выполнено, удаляем ошибку из taskErrorsRef
        if (finalCompleted && finalVerified) {
          delete taskErrorsRef.current[link.id];
        }
        
        // ⚠️ КРИТИЧНО: Если задание verified, добавляем в ref для постоянного хранения
        if (finalCompleted && finalVerified && !isVerifiedInRef) {
          verifiedTasksRef.current.add(link.id);
          console.log(`✅ [LOAD] Added task ${link.id} to verifiedTasksRef`);
        }
        
        // ⚠️ КРИТИЧНО: Для completed && verified заданий - проверки прекращаются
        // Сохраняем состояние как есть, не меняем error, verifying и т.д.
        if (finalCompleted && finalVerified) {
          return {
            link_id: link.id,
            cast_url: link.cast_url,
            cast_hash: castHash,
            task_type: link.task_type,
            user_fid_required: userFid,
            username: link.username,
            pfp_url: link.pfp_url,
            completed: true, // Проверки прекращены
            verified: true, // Проверки прекращены
            opened: isOpened,
            error: false, // Нет ошибок у выполненных заданий
            verifying: false, // Не проверяем выполненные задания
            _originalIndex: index,
          };
        }
        
        // Для невыполненных заданий сохраняем обычную логику
        const hasStoredError = taskErrorsRef.current[link.id] === true;
        const shouldHaveError = hasStoredError && !isOpened && !finalCompleted;
        const preservingVerifying = currentTask?.verifying === true && !finalCompleted;
        const preservingError = isOpened ? false : (shouldHaveError);
        
        return {
          link_id: link.id,
          cast_url: link.cast_url,
          cast_hash: castHash,
          task_type: link.task_type,
          user_fid_required: userFid,
          username: link.username,
          pfp_url: link.pfp_url,
          completed: finalCompleted,
          verified: finalVerified,
          opened: isOpened,
          error: preservingError,
          verifying: preservingVerifying,
          _originalIndex: index,
        };
      });
      // УБРАНА СОРТИРОВКА: Задания остаются в исходном порядке очереди, выполненные не перемещаются вниз

      // Считаем количество завершенных заданий ТОЛЬКО для текущего типа активности
      const completedCountForActivity = taskList.filter(task => task.completed).length;

      // ⚠️ КРИТИЧНО: Проверяем, если все задачи завершены - обновляем состояние и делаем редирект с задержкой
      const allTasksVerifiedInList = taskList.length > 0 && taskList.every((task) => task.completed && task.verified);
      if (allTasksVerifiedInList && user) {
        const linkPublishedSession = sessionStorage.getItem('link_published');
        const linkPublishedLocal = localStorage.getItem('link_published');
        if (linkPublishedSession !== 'true' && linkPublishedLocal !== 'true') {
          // ⚠️ КРИТИЧНО: Обновляем состояние, чтобы показать зеленые кнопки
          console.log(`✅ [TASKS] Setting tasks to state: ${taskList.length} tasks (all verified)`);
          setTasks(taskList);
          setCompletedCount(completedCountForActivity);
          
          // ⚠️ КРИТИЧНО: Задержка 2 секунды, чтобы зеленая кнопка светилась дольше
          setTimeout(() => {
            console.log('🚀 [TASKS] All tasks verified, redirecting to wallet after showing green buttons');
            window.location.href = '/buyToken';
          }, 2000); // 2 секунды чтобы показать зеленые кнопки
          return; // Прекращаем выполнение, НЕ вызываем дальнейшие обновления
        }
      }

      console.log(`✅ [TASKS] Setting tasks to state: ${taskList.length} tasks`);
      setTasks(taskList);
      setCompletedCount(completedCountForActivity);
      
      // ⚠️ КРИТИЧНО: После загрузки задач запускаем polling для открытых заданий
      // Это нужно делать после setTasks, чтобы tasks были обновлены
      // Используем setTimeout чтобы дать время React обновить состояние
      setTimeout(() => {
        taskList.forEach((task) => {
          const isOpened = task.opened || openedTasks[task.link_id] === true;
          const isCompleted = task.completed && task.verified;
          
          // Запускаем polling только если задание открыто, но еще не выполнено
          if (isOpened && !isCompleted && task.cast_url && activity) {
            // Проверяем, не запущен ли уже polling для этого задания
            if (!pollingIntervalsRef.current[task.link_id]) {
              console.log(`🔄 [LOAD-POLLING] Starting polling for opened task ${task.link_id}`);
              startPollingForActivity(task.cast_url, task.link_id, task.task_type || activity);
            }
          }
        });
      }, 100);
      
      // Логируем для отладки
      if (taskList.length === 0) {
        console.warn(`⚠️ [TASKS] No tasks to display!`, {
          linksFromAPI: links.length,
          filteredLinks: filteredLinks.length,
          currentActivity,
          taskTypes: links.map((l: LinkSubmission) => l.task_type || (l as any).activity_type),
        });
      }
      
      console.log(`✅ Loaded ${taskList.length} tasks, ${completedCountForActivity} completed for activity ${currentActivity}`);
      console.log(`📋 Task links:`, taskList.map((t, i) => ({
        index: i + 1,
        link_id: t.link_id,
        username: t.username,
        cast_url: t.cast_url?.substring(0, 40) + '...',
        completed: t.completed,
      })));
      console.log(`🔍 [TASKS] Activity filter: ${currentActivity || 'NONE'}, Raw links from API: ${links.length}, Filtered links: ${filteredLinks.length}, Final tasks: ${taskList.length}`);
      console.log(`📊 [TASKS] Task types in loaded links:`, links.map((l: LinkSubmission) => l.task_type));
      
      // Проверяем: если все задания завершены, проверяем прогресс и делаем автоматический редирект
      // ⚠️ ВАЖНО: Проверяем, не опубликована ли уже ссылка пользователем, чтобы избежать бесконечного редиректа
      // ⚠️ КРИТИЧНО: Проверяем, что все задания действительно выполнены И проверены (зеленые кнопки)
      // Если кнопки зеленые (completed && verified), значит проверка уже пройдена, редирект сразу
      const allTasksCompleted = completedLinks.length >= taskList.length;
      const allTasksVerified = taskList.length > 0 && taskList.every((task) => task.completed && task.verified);
      
      console.log('🔍 [TASKS] Redirect check:', {
        allTasksCompleted,
        allTasksVerified,
        tasksCount: taskList.length,
        completedCount: completedLinks.length,
        verifiedTasks: taskList.filter(t => t.completed && t.verified).length,
        taskStates: taskList.map(t => ({ id: t.link_id, completed: t.completed, verified: t.verified }))
      });
      
      // ⚠️ КРИТИЧНО: Если все задачи завершены и проверены (зеленые кнопки) - редирект СРАЗУ на кошелек
      // НЕМЕДЛЕННЫЙ редирект без Promise.all, без setTimeout, без промежуточных состояний
      if (allTasksCompleted && allTasksVerified && taskList.length > 0 && user) {
        // ⚠️ КРИТИЧЕСКАЯ ПРОВЕРКА: Только проверяем флаг link_published (синхронно)
        // Это предотвращает редирект на /submit, если ссылка уже опубликована
        const linkPublishedSession = sessionStorage.getItem('link_published');
        const linkPublishedLocal = localStorage.getItem('link_published');
        if (linkPublishedSession === 'true' || linkPublishedLocal === 'true') {
          console.log(`✅ [TASKS] Link already published, skipping redirect`);
          return; // Прекращаем выполнение, не делаем редирект
        }
        
        // ⚠️ КРИТИЧНО: СРАЗУ редирект без задержек, без Promise.all, без промежуточных состояний
        // Используем window.location.href для немедленного редиректа
        console.log(`🚀 IMMEDIATE redirect to /buyToken (all tasks verified - green buttons)`);
        window.location.href = '/buyToken';
        return; // Прекращаем выполнение, не вызываем setTasks
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
    // ⚠️ КРИТИЧНО: Убираем ошибку при открытии задачи
    delete taskErrorsRef.current[linkId];
    // Также обновляем в tasks для немедленного отображения
    // ⚠️ КРИТИЧНО: НЕ устанавливаем completed: true сразу - это будет сделано после проверки через API
    // Логика:
    // - Если проверка через API не прошла (ошибка API) → зеленая (completed: true)
    // - Если проверка прошла, но лайка нет → красная (error: true)
    // - Если проверка прошла и лайк есть → зеленая (completed: true)
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.link_id === linkId) {
          // Если задание уже completed && verified, не меняем его состояние
          if (task.completed && task.verified) {
            return task; // Возвращаем как есть
          }
          // Задача открыта, но completed будет установлен после проверки через API
          return { ...task, opened: true, error: false };
        }
        return task;
      })
    );
  };

  // Polling для автоматической проверки активности после открытия ссылки
  const startPollingForActivity = (castUrl: string, linkId: string, activityType: TaskType) => {
    if (apiAccessBlocked) return;
    if (!user?.fid) return;

    // ⚠️ КРИТИЧНО: Проверяем, не выполнено ли уже задание - если да, проверки прекращаем
    const currentTask = tasks.find(t => t.link_id === linkId);
    if (currentTask?.completed && currentTask?.verified) {
      console.log(`⏹️ [POLLING] Task ${linkId} already completed and verified, skipping polling`);
      return; // Проверки прекращены
    }

    // Если уже есть активный polling для этой ссылки, не создаем новый
    if (pollingIntervalsRef.current[linkId]) {
      console.log(`⚠️ [POLLING] Polling already active for link ${linkId}`);
      return;
    }

    console.log(`🔄 [POLLING] Starting polling for link ${linkId}`, { castUrl, activityType });
    
    // Ждем 7 секунд перед первой проверкой (даем время на индексацию)
    const initialDelay = 7000; // 7 секунд
    
    const timeoutId = setTimeout(() => {
      let pollCount = 0;
      const maxPolls = 10; // Максимум 10 проверок (5 минут)
      const pollInterval = 30000; // Проверяем каждые 30 секунд
      
      const pollIntervalId = setInterval(async () => {
        if (apiAccessBlocked) {
          clearInterval(pollIntervalId);
          delete pollingIntervalsRef.current[linkId];
          return;
        }
        pollCount++;
        console.log(`🔄 [POLLING] Poll attempt ${pollCount}/${maxPolls} for link ${linkId}`);
        
        // ⚠️ КРИТИЧНО: Проверяем, не выполнено ли уже задание - если да, прекращаем проверки
        const currentTask = tasks.find(t => t.link_id === linkId);
        if (currentTask?.completed && currentTask?.verified) {
          console.log(`⏹️ [POLLING] Task ${linkId} already completed and verified, stopping polling`);
          clearInterval(pollIntervalId);
          delete pollingIntervalsRef.current[linkId];
          return; // Проверки прекращены
        }
        
        try {
          const result = await verifyActivity({
            castHash: '',
            castUrl: castUrl,
            activityType: activityType,
            viewerFid: user.fid,
          });
          
          // ⚠️ КРИТИЧНО: Проверяем, что задача была открыта перед тем, как помечать её как выполненную
          const isOpened = openedTasks[linkId] === true;
          
          if (result.completed && isOpened) {
            console.log(`✅ [POLLING] Activity found for link ${linkId} and task is opened!`);
            
            // Помечаем ссылку как выполненную в базе СНАЧАЛА
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
            
            // Убираем ошибку, если она была
            delete taskErrorsRef.current[linkId];
            
            // ⚠️ КРИТИЧНО: Добавляем в verifiedTasksRef ПЕРЕД обновлением состояния
            verifiedTasksRef.current.add(linkId);
            console.log(`✅ [POLLING] Added task ${linkId} to verifiedTasksRef`);
            
            // Останавливаем polling
            clearInterval(pollIntervalId);
            delete pollingIntervalsRef.current[linkId];
            
            // ⚠️ КРИТИЧНО: Сначала обновляем состояние текущей задачи как завершенной
            // Это нужно для того, чтобы кнопка стала зеленой сразу после проверки
            setTasks(prevTasks =>
              prevTasks.map(task =>
                task.link_id === linkId
                  ? { ...task, completed: true, verified: true, verifying: false, error: false }
                  : task
              )
            );
            
            // ⚠️ КРИТИЧНО: Проверяем через API, все ли задачи завершены, ПЕРЕД вызовом loadTasks
            // Это предотвращает промежуточные рендеры через loadTasks
            if (user?.fid) {
              try {
                // Проверяем прогресс через API напрямую
                const progressResponse = await fetch(`/api/user-progress?userFid=${user.fid}&t=${Date.now()}`);
                const progressCt = progressResponse.headers.get('content-type') || '';
                if (!progressResponse.ok || !progressCt.includes('application/json')) {
                  console.warn('[POLLING] Progress response is not JSON / not OK, skipping completion check', {
                    status: progressResponse.status,
                    contentType: progressCt,
                  });
                  return;
                }
                const progressData = await progressResponse.json();
                const progress = progressData.progress || null;
                const completedLinks = progress?.completed_links || [];
                
                // Получаем список всех задач
                const currentActivity = activity || (typeof window !== 'undefined' ? localStorage.getItem('selected_activity') : null);
                const taskTypeParam = currentActivity ? `&taskType=${currentActivity}` : '';
                const linksResponse = await fetch(`/api/tasks?t=${Date.now()}${taskTypeParam}`);
                const linksCt = linksResponse.headers.get('content-type') || '';
                if (!linksResponse.ok || !linksCt.includes('application/json')) {
                  console.warn('[POLLING] Links response is not JSON / not OK, skipping completion check', {
                    status: linksResponse.status,
                    contentType: linksCt,
                  });
                  return;
                }
                const linksData = await linksResponse.json();
                const links = linksData.links || [];
                
                // Фильтруем по активности
                let filteredLinks = links;
                if (currentActivity && links.length > 0) {
                  filteredLinks = links.filter((link: LinkSubmission) => {
                    const linkTaskType = link.task_type || (link as any).activity_type;
                    return linkTaskType === currentActivity;
                  });
                }
                
                // Проверяем, все ли задачи завершены
                const allTasksCompleted = filteredLinks.length > 0 && filteredLinks.every((link: LinkSubmission) => 
                  completedLinks.includes(link.id)
                );
                
                if (allTasksCompleted) {
                  const linkPublishedSession = sessionStorage.getItem('link_published');
                  const linkPublishedLocal = localStorage.getItem('link_published');
                  if (linkPublishedSession !== 'true' && linkPublishedLocal !== 'true') {
                    // ⚠️ КРИТИЧНО: Задержка 2 секунды, чтобы зеленая кнопка светилась дольше
                    // НЕ вызываем loadTasks, чтобы не было промежуточных рендеров
                    setTimeout(() => {
                      console.log('🚀 [POLLING] All tasks completed (checked via API), redirecting to wallet after showing green buttons');
                      window.location.href = '/buyToken';
                    }, 2000); // 2 секунды чтобы показать зеленые кнопки
                    return; // Прекращаем выполнение, НЕ вызываем loadTasks
                  }
                }
              } catch (e) {
                console.error('[POLLING] Error checking all tasks completion:', e);
              }
              
              // ⚠️ КРИТИЧНО: НЕ вызываем loadTasks после того как задание помечено как completed
              // Состояние уже обновлено через setTasks выше, не нужно перезагружать из БД
              // Это предотвращает перезапись verified состояния
            }
            return; // Выходим из интервала
          } else if (result.completed && !isOpened) {
            // Если активность найдена, но задача не открыта - это ошибка
            console.log(`⚠️ [POLLING] Activity found for link ${linkId}, but task is not opened!`);
            taskErrorsRef.current[linkId] = true;
            setTasks(prevTasks =>
              prevTasks.map(task =>
                task.link_id === linkId
                  ? { ...task, error: true, verifying: false }
                  : task
              )
            );
          } else if (!result.completed && isOpened) {
            // ⚠️ КРИТИЧНО: Логика для открытой задачи:
            // 1. Если проверка через API не прошла (result.isError) → зеленая кнопка (считаем выполненной)
            // 2. Если проверка прошла (!result.isError), но лайка нет (!result.completed) → красная кнопка (ошибка)
            if (result.isError) {
              // Если API заблокирован чекпоинтом — НЕ помечаем как completed и не продолжаем бомбить API
              if ((result as any).blocked || apiAccessBlocked) {
                console.warn(`🚫 [POLLING] API blocked for link ${linkId}. Stopping polling without marking completed.`);
                clearInterval(pollIntervalId);
                delete pollingIntervalsRef.current[linkId];
                setTasks(prevTasks =>
                  prevTasks.map(task =>
                    task.link_id === linkId
                      ? { ...task, verifying: false, error: false }
                      : task
                  )
                );
                return;
              }
              // Проверка через API не прошла (ошибка API), но ссылка открыта → зеленая кнопка
              console.log(`✅ [POLLING] Task ${linkId} is opened, but API check failed. Marking as completed (green).`);
              delete taskErrorsRef.current[linkId];
              verifiedTasksRef.current.add(linkId);
              setTasks(prevTasks =>
                prevTasks.map(task =>
                  task.link_id === linkId
                    ? { ...task, completed: true, verified: true, error: false, verifying: false }
                    : task
                )
              );
              // Останавливаем polling
              clearInterval(pollIntervalId);
              delete pollingIntervalsRef.current[linkId];
            } else {
              // Проверка прошла успешно, но лайка нет - это ошибка (красная кнопка)
              console.log(`❌ [POLLING] Task ${linkId} is opened, but activity not found. Showing error (red).`);
              taskErrorsRef.current[linkId] = true;
              setTasks(prevTasks =>
                prevTasks.map(task =>
                  task.link_id === linkId
                    ? { ...task, completed: false, verified: true, error: true, verifying: false } // verified: true чтобы показать, что проверка прошла, но лайка нет
                    : task
                )
              );
              // Останавливаем polling, так как проверка завершена
              clearInterval(pollIntervalId);
              delete pollingIntervalsRef.current[linkId];
            }
          } else if (pollCount >= maxPolls) {
            console.log(`⏰ [POLLING] Max polls reached for link ${linkId}, stopping`);
            clearInterval(pollIntervalId);
            delete pollingIntervalsRef.current[linkId];
          }
        } catch (error) {
          console.error(`❌ [POLLING] Error during poll for link ${linkId}`, error);
          // ⚠️ КРИТИЧНО: Если задача открыта, НЕ устанавливаем ошибку при исключении
          const isOpened = openedTasks[linkId] === true;
          if (!isOpened) {
            // Устанавливаем ошибку только если задача НЕ открыта
            taskErrorsRef.current[linkId] = true;
            setTasks(prevTasks =>
              prevTasks.map(task =>
                task.link_id === linkId
                  ? { ...task, error: true, verifying: false }
                  : task
              )
            );
          } else {
            console.log(`⏳ [POLLING] Task ${linkId} is opened, skipping error on exception`);
          }
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

  // Тестовая функция для проверки открытия ссылок (доступна в консоли)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).testOpenLink = async (testUrl?: string) => {
        const url = testUrl || 'https://farcaster.xyz/vitalik/0x1234567890abcdef';
        console.log('🧪 [TEST] Testing link opening:', url);
        console.log('🧪 [TEST] User Agent:', navigator.userAgent);
        console.log('🧪 [TEST] Is in Farcaster frame:', window.self !== window.top);
        
        await handleOpenLink(url, 'test-link-id');
      };
      
      console.log('✅ [TEST] Test function available: window.testOpenLink(url)');
    }
  }, []);

  // Открыть ссылку
  const handleOpenLink = async (castUrl: string, linkId: string, castHashFromTask?: string) => {
    if (apiAccessBlocked) {
      console.warn('🚫 [OPEN] API is blocked; skipping polling start to avoid extra requests');
    }
    // ⚠️ КРИТИЧНО: Проверяем, не выполнено ли уже задание - если да, не запускаем polling
    const currentTask = tasks.find(t => t.link_id === linkId);
    if (currentTask?.completed && currentTask?.verified) {
      console.log(`⏹️ [OPEN] Task ${linkId} already completed and verified, skipping polling`);
      // Просто открываем ссылку, но не запускаем polling
    } else {
      // Отмечаем задачу как открытую
      markOpened(linkId);
      
      // Запускаем polling для автоматической проверки
      if (activity && !apiAccessBlocked) {
        startPollingForActivity(castUrl, linkId, activity);
      }
    }
    
    // Используем SDK для открытия ссылки в Farcaster (работает на всех платформах, включая iOS)
    try {
      // Проверяем, что мы в Farcaster Mini App
      const isInFarcasterFrame = typeof window !== 'undefined' && window.self !== window.top;
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // Проверяем sandbox атрибуты iframe (если доступны)
      let iframeSandbox = null;
      try {
        if (typeof window !== 'undefined' && window.frameElement) {
          const iframe = window.frameElement as HTMLIFrameElement;
          iframeSandbox = iframe.getAttribute('sandbox');
        }
      } catch (e) {
        // Игнорируем ошибки доступа к frameElement (CORS)
      }
      
      console.log(`🔍 [OPEN] Opening link: ${castUrl}`, {
        isInFarcasterFrame,
        isIOS,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        iframeSandbox: iframeSandbox || 'not accessible (CORS)',
      });
      
      // Важно: на iOS Farcaster miniapp может быть НЕ в iframe. Поэтому пробуем SDK всегда.
      {
        // КРИТИЧНО: Сначала пробуем SDK методы - они должны работать правильно
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        try {
          if (sdk?.actions?.ready) {
            await sdk.actions.ready();
          }
        } catch (e) {
          // Игнорируем ошибку ready()
        }
        
        // Определяем версию iOS для совместимости со старыми версиями
        const iosVersion = isIOS ? (() => {
          const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
          return match ? parseFloat(`${match[1]}.${match[2]}`) : null;
        })() : null;
        
        // Метод 1: viewCast с hash (для кастов Farcaster - открывает в приложении, лучше для iOS)
        // Приоритет для кастов Farcaster, особенно на iOS 16 и ниже (где deep linking глючит)
        if (sdk?.actions?.viewCast) {
          try {
            const { extractCastHash } = await import('@/lib/neynar');
            const isFullHash = (h: string | null) => !!h && /^0x[a-fA-F0-9]{40}$/.test(h);

            // Сначала пробуем извлечь hash напрямую (если URL уже содержит полный 0x…64).
            let castHash = castHashFromTask || extractCastHash(castUrl);

            // Важно: на клиенте нет NEYNAR_API_KEY, поэтому резолвим через сервер.
            if (!isFullHash(castHash)) {
              console.log(`🔍 [OPEN] Hash is missing or not full, resolving via server API: ${castUrl}`, { extracted: castHash });
              try {
                const resp = await fetch('/api/resolve-cast-hash', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ castUrl }),
                });
                const data = await resp.json();
                if (data?.success && typeof data.hash === 'string') {
                  castHash = data.hash;
                } else {
                  console.warn('⚠️ [OPEN] Server hash resolution failed:', data?.error || data);
                }
              } catch (e: any) {
                console.warn('⚠️ [OPEN] Server hash resolution request failed:', e?.message || e);
              }
            }
            if (castHash) {
              console.log(`🔍 [OPEN] Trying viewCast with hash: ${castHash} (iOS version: ${iosVersion || 'unknown'})`);
              await (sdk.actions.viewCast as any)({ hash: castHash });
              console.log(`✅ [OPEN] Opened via viewCast: ${castHash}`);
              return;
            } else {
              console.warn(`⚠️ [OPEN] Could not extract or resolve cast hash from URL: ${castUrl}`);
            }
          } catch (e: any) {
            console.warn('⚠️ [OPEN] viewCast failed:', e?.message);
          }
        }
        
        // Метод 2: openUrl через SDK с target для выхода из iframe на iOS
        if (sdk?.actions?.openUrl) {
          try {
            // Для iOS используем target: 'system' чтобы открыть в системном браузере/приложении
            // Это выводит ссылку за пределы iframe, где Farcaster app может её подхватить
            const target = isIOS ? 'system' : undefined;
            console.log(`🔍 [OPEN] Trying SDK openUrl with target: ${target || 'default'} (iOS version: ${iosVersion || 'unknown'})`);
            await (sdk.actions.openUrl as any)({ url: castUrl, ...(target && { target }) });
            console.log(`✅ [OPEN] Opened via SDK openUrl: ${castUrl}`);
            return;
          } catch (e: any) {
            console.warn('⚠️ [OPEN] SDK openUrl failed, trying fallback:', e?.message);
            // Если target: 'system' не сработал, пробуем 'top'
            if (isIOS) {
              try {
                console.log(`🔍 [OPEN] Trying openUrl with target: 'top' as fallback`);
                await (sdk.actions.openUrl as any)({ url: castUrl, target: 'top' });
                console.log(`✅ [OPEN] Opened via SDK openUrl with target:top: ${castUrl}`);
                return;
              } catch (e2: any) {
                console.warn('⚠️ [OPEN] SDK openUrl with target:top failed:', e2?.message);
              }
            }
          }
        }
        
        // Метод 3: Для iOS - прямой выход из iframe (только если SDK не сработал)
        if (isIOS && isInFarcasterFrame) {
          console.log('📱 [OPEN] iOS: SDK methods failed, trying direct iframe exit');
          
          // Попробуем window.top.location.href
          if (window.top && window.top !== window.self) {
            try {
              window.top.location.href = castUrl;
              console.log(`✅ [OPEN] iOS: Opened via window.top.location.href: ${castUrl}`);
              return;
            } catch (e: any) {
              console.warn('⚠️ [OPEN] iOS: window.top.location.href blocked:', e?.message);
              try {
                window.top.location.replace(castUrl);
                console.log(`✅ [OPEN] iOS: Opened via window.top.location.replace: ${castUrl}`);
                return;
              } catch (e2: any) {
                console.warn('⚠️ [OPEN] iOS: window.top.location.replace blocked:', e2?.message);
              }
            }
          }
          
          // Попробуем window.open с _top
          try {
            const newWindow = window.open(castUrl, '_top');
            if (newWindow) {
              console.log(`✅ [OPEN] iOS: Opened via window.open(_top): ${castUrl}`);
              return;
            }
          } catch (e: any) {
            console.warn('⚠️ [OPEN] iOS: window.open(_top) failed:', e?.message);
          }
          
          // Попробуем временную ссылку
          try {
            const link = document.createElement('a');
            link.href = castUrl;
            link.target = '_top';
            link.rel = 'noopener noreferrer';
            link.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
              try {
                document.body.removeChild(link);
              } catch {}
            }, 100);
            console.log(`✅ [OPEN] iOS: Opened via temporary link(_top): ${castUrl}`);
            return;
          } catch (e: any) {
            console.warn('⚠️ [OPEN] iOS: Temporary link failed:', e?.message);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ [OPEN] Failed to open via SDK/postMessage, falling back:', error);
    }
    
    // Fallback: если SDK недоступен, используем обычное открытие
    // Определяем, мобильное ли устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isIOS) {
      // На iOS пытаемся использовать deeplink для открытия в приложении Farcaster
      // Формат: farcaster://cast?url=... или fc://cast?url=...
      const farcasterDeeplink = `farcaster://cast?url=${encodeURIComponent(castUrl)}`;
      
      console.log(`🔗 [OPEN] iOS detected, trying deeplink: ${farcasterDeeplink}`);
      console.log(`📱 [OPEN] User Agent: ${navigator.userAgent}`);
      
      // Пытаемся открыть через deeplink
      try {
        // Создаем скрытую ссылку для iOS deeplink
        const link = document.createElement('a');
        link.href = farcasterDeeplink;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`✅ [OPEN] iOS deeplink triggered: ${farcasterDeeplink}`);
        
        // Если deeplink не сработает, через 1.5 секунды откроем веб-версию
        setTimeout(() => {
          console.log(`⏰ [OPEN] Fallback: opening web version after deeplink timeout`);
          window.open(castUrl, '_blank');
        }, 1500);
      } catch (deeplinkError) {
        console.warn('⚠️ [OPEN] Deeplink failed, opening web version:', deeplinkError);
        window.open(castUrl, '_blank');
      }
    } else if (isMobile) {
      // На Android и других мобильных устройствах
      const farcasterUrl = `farcaster://cast?url=${encodeURIComponent(castUrl)}`;
      window.location.href = farcasterUrl;
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
    activityType: TaskType;
    viewerFid: number;
  }): Promise<{ completed: boolean; userMessage?: string; hashWarning?: string; isError?: boolean; blocked?: boolean; neynarExplorerUrl?: string }> => {
    try {
      // Добавляем небольшую задержку для обновления данных в Neynar API после unlike+like
      // Это особенно важно для лайков, так как API может обновляться с задержкой
      if (activityType === 'like') {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 секунды задержки для обновления API
      }
      
      const requestBody = {
        castUrl: castUrl || castHash, // Передаем весь URL
        userFid: viewerFid,
        taskType: activityType, // Используем taskType для API
      };
      
      console.log('[CLIENT] verifyActivity: Sending request:', requestBody);
      console.log('[CLIENT] verifyActivity: viewerFid type:', typeof viewerFid, 'value:', viewerFid);
      
      // Отправляем castUrl (весь URL, даже с "...")
      const response = await fetch('/api/verify-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[CLIENT] verifyActivity: Response status:', response.status, response.statusText);

      const ct = response.headers.get('content-type') || '';
      const isCheckpoint =
        response.status === 403 &&
        (response.headers.get('x-vercel-mitigated') === 'challenge' ||
          response.headers.has('x-vercel-challenge-token') ||
          ct.includes('text/html'));

      if (isCheckpoint) {
        setApiAccessBlocked(true);
        setApiAccessBlockedMessage(
          '⚠️ Verification API blocked by Vercel Security Checkpoint (bot/challenge protection).\n\nFix in Vercel Dashboard: disable bot/challenge protection OR add an allow rule for /api/*.'
        );
        return {
          completed: false,
          userMessage:
            'Verification service is blocked by Vercel Security Checkpoint. Please disable Vercel bot/challenge protection (or allow /api/*), then retry.',
          isError: true,
          blocked: true,
        };
      }

      if (!ct.includes('application/json')) {
        return {
          completed: false,
          userMessage: `Error checking activity (status ${response.status}).`,
          isError: true,
          neynarExplorerUrl: castUrl ? `https://explorer.neynar.com/search?q=${encodeURIComponent(castUrl)}` : undefined,
        };
      }

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
        userMessage: data.completed ? undefined : 'Error: Action not found.',
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
    
    // ⚠️ КРИТИЧНО: Проверяем ПЕРЕД началом проверки - если все задачи уже завершены, сразу редирект
    const allTasksVerified = tasks.length > 0 && tasks.every((task) => task.completed && task.verified);
    if (allTasksVerified && user) {
      const linkPublishedSession = sessionStorage.getItem('link_published');
      const linkPublishedLocal = localStorage.getItem('link_published');
      if (linkPublishedSession !== 'true' && linkPublishedLocal !== 'true') {
        console.log('🚀 [VERIFY] All tasks already verified (green buttons), redirecting IMMEDIATELY');
        window.location.href = '/buyToken';
        return; // Прекращаем выполнение, не запускаем проверку
      }
    }
    
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
      // ⚠️ КРИТИЧНО: Сохраняем error состояние и устанавливаем его ТОЛЬКО для неоткрытых и невыполненных задач
      setTasks(prevTasks => 
        prevTasks.map(task => {
          const isOpened = task.opened || openedTasks[task.link_id] === true;
          // Если задача выполнена, ошибки быть не должно
          if (task.completed && task.verified) {
            return {
              ...task, 
              verifying: true,
              error: false // Выполненные задачи не должны показывать ошибку
            };
          }
          // ⚠️ КРИТИЧНО: НЕ устанавливаем ошибку автоматически для неоткрытых задач
          // Ошибка должна устанавливаться только после реальной проверки через API
          // Для открытых задач НЕ устанавливаем error, чтобы кнопка оставалась синей
          const finalError = isOpened ? false : (task.error || taskErrorsRef.current[task.link_id] === true);
          return {
            ...task, 
            verifying: true,
            // Устанавливаем error ТОЛЬКО для неоткрытых задач
            error: finalError
          };
        })
      );

      // ✅ Параллельная проверка всех задач через Promise.all
      const messages: Array<{ linkId: string; message: string; neynarUrl?: string }> = [];
      const updatedTasks: TaskProgress[] = await Promise.all(
        tasks.map(async (task: TaskProgress) => {
          // ⚠️ КРИТИЧНО: Пропускаем задания с completed && verified - проверки для них прекращены
          // Также проверяем verifiedTasksRef - если задача уже была проверена ранее, пропускаем
          const isAlreadyVerified = task.completed && task.verified;
          const isInVerifiedRef = verifiedTasksRef.current.has(task.link_id);
          
          if (isAlreadyVerified || isInVerifiedRef) {
            console.log(`⏹️ [VERIFY] Task ${task.link_id} already completed and verified (${isAlreadyVerified ? 'in state' : 'in ref'}), skipping verification`);
            // Убеждаемся, что задача в ref
            if (!isInVerifiedRef) {
              verifiedTasksRef.current.add(task.link_id);
            }
            return {
              ...task,
              completed: true,
              verified: true,
              verifying: false,
              error: false,
            } as TaskProgress; // Возвращаем как выполненную, проверки прекращены
          }
          
          try {
            // ✅ Отправляем castUrl (весь URL, даже с "...")
            // API сам разрешит URL через getFullCastHash
          if (!task.cast_url) {
            console.warn(`⚠️ Task ${task.link_id} has no cast_url, skipping verification (link kept, no error shown)`);
            messages.push({
              linkId: task.link_id,
              message: 'Missing cast link. Please check the link format.',
            });
            
            // Ведём себя как с обычной невыполненной задачей: не completed, без error,
            // просто пропускаем проверку.
            return {
              ...task,
              completed: false,
              verified: false,
              verifying: false,
              error: false,
              opened: task.opened || openedTasks[task.link_id] === true,
            } as TaskProgress;
          }

            console.log(`[CLIENT] handleVerifyAll: Verifying task ${task.link_id}`, {
              castUrl: task.cast_url,
              activityType: task.task_type || activity,
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
              activityType: task.task_type || activity,
              viewerFid: user.fid, // ✅ используем текущего пользователя
            });
            
            console.log(`[CLIENT] handleVerifyAll: Result for task ${task.link_id}:`, {
              completed: result.completed,
              isError: result.isError,
              userMessage: result.userMessage,
              castHash: result.hashWarning
            });

            // ⚠️ КРИТИЧНО: Если задача не была открыта, она НЕ может быть выполнена, даже если активность найдена
            const isOpened = task.opened || openedTasks[task.link_id] === true;
            
            // ⚠️ КРИТИЧНО: Логика для открытой задачи:
            // 1. Если проверка через API не прошла (result.isError) → зеленая кнопка (считаем выполненной)
            // 2. Если проверка прошла (!result.isError), но лайка нет (!result.completed) → красная кнопка (ошибка)
            // 3. Если проверка прошла и лайк поставлен → зеленая кнопка
            const finalCompleted = isOpened ? (
              result.isError ? true : result.completed // Если ошибка API → выполнена, иначе зависит от result.completed
            ) : result.completed; // Если не открыта, только если result.completed
            
            // Определяем, была ли ошибка
            // Ошибка только если: проверка прошла успешно (!result.isError), но лайка нет (!result.completed)
            // НЕ ошибка если: result.isError (ошибка API) - в этом случае считаем выполненной
            // ⚠️ КРИТИЧНО: Если result.completed = true, то ошибки быть не должно
            // Ошибка только если: проверка прошла успешно (!result.isError), но лайка нет (!result.completed), и задача открыта
            const hasError = finalCompleted ? false : (
              (!result.isError) && 
              (!result.completed) && 
              isOpened // Проверка прошла, но лайка нет, и задача открыта - это ошибка
            );
            
            console.log(`🔍 [VERIFY] Task ${task.link_id} verification:`, {
              isOpened,
              resultCompleted: result.completed,
              finalCompleted,
              hasError,
              resultIsError: result.isError
            });
            
            // Если каст не найден (error: true), больше НЕ удаляем ссылку из базы.
            // Ссылка остаётся в очереди, задача помечается как с ошибкой.

            // Собираем сообщения об ошибках для пользователя
            if (!finalCompleted) {
              if (!isOpened) {
                messages.push({
                  linkId: task.link_id,
                  message: 'Task not opened. Please open the task first.',
                });
              } else if (!result.completed && result.userMessage) {
                messages.push({
                  linkId: task.link_id,
                  message: result.userMessage,
                  neynarUrl: result.neynarExplorerUrl,
                });
              }
            }

            // Логируем предупреждения о hash
            if (result.hashWarning) {
              console.warn(`⚠️ [VERIFY] Hash warning for task ${task.link_id}:`, result.hashWarning);
            }

            // Если задача выполнена (открыта И активность найдена) - сохраняем в БД и в ref
            if (finalCompleted) {
              // ⚠️ КРИТИЧНО: Добавляем в verifiedTasksRef сразу после проверки
              verifiedTasksRef.current.add(task.link_id);
              console.log(`✅ [VERIFY] Added task ${task.link_id} to verifiedTasksRef`);
              
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

            // Сохраняем состояние ошибки в taskErrorsRef для сохранения между перезагрузками
            if (hasError) {
              taskErrorsRef.current[task.link_id] = true;
              console.log(`🔴 [VERIFY] Stored error for task ${task.link_id}`, {
                hasError,
                resultCompleted: result.completed,
                resultIsError: result.isError,
                isOpened,
                finalCompleted
              });
            } else {
              // Убираем ошибку, если задание выполнено или проверка не показала ошибку
              delete taskErrorsRef.current[task.link_id];
              console.log(`✅ [VERIFY] Removed error for task ${task.link_id}`, {
                hasError,
                resultCompleted: result.completed,
                resultIsError: result.isError,
                isOpened,
                finalCompleted
              });
            }
            
            // ⚠️ КРИТИЧНО: Если задача открыта и проверка через API не прошла (ошибка API), 
            // устанавливаем verified: true и completed: true (зеленая кнопка)
            // Если проверка прошла, но лайка нет, устанавливаем verified: true и error: true (красная кнопка)
            // verified должен быть true если:
            // 1. Задача открыта И (ошибка API ИЛИ лайк есть) - т.е. shouldBeVerified
            // 2. ИЛИ задача выполнена (finalCompleted = true)
            // 3. ИЛИ проверка прошла (!result.isError) - чтобы показать, что проверка была выполнена
            const shouldBeVerified = isOpened && (result.isError || result.completed);
            const shouldBeCompleted = isOpened ? (result.isError ? true : result.completed) : result.completed;
            
            // ⚠️ КРИТИЧНО: verified должен быть true если:
            // - shouldBeVerified (открыта и (ошибка API или лайк есть))
            // - ИЛИ finalCompleted (задача выполнена)
            // - ИЛИ проверка прошла (!result.isError) - чтобы показать, что проверка была выполнена
            // Это позволяет отличить случай "проверка прошла, но лайка нет" (error: true, verified: true) от "проверка не прошла" (completed: true, verified: true)
            const finalVerified = shouldBeVerified || finalCompleted || (!result.isError && isOpened);
            
            return {
              ...task,
              completed: shouldBeCompleted,
              verified: finalVerified, // verified только если shouldBeVerified или finalCompleted без ошибки
              verifying: false,
              error: hasError,
              opened: isOpened, // Сохраняем состояние opened
            } as TaskProgress;
          } catch (err: any) {
            console.error('❌ Neynar API error for task:', task.link_id, err);
            messages.push({
              linkId: task.link_id,
              message: 'Error checking activity. Please try again in 1-2 minutes.',
            });
            // Сохраняем состояние ошибки в taskErrorsRef
            taskErrorsRef.current[task.link_id] = true;
            console.log(`🔴 [VERIFY] Stored error for task ${task.link_id} (exception)`, taskErrorsRef.current);
            
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
      // ВАЖНО: Убеждаемся, что выполненные задачи не имеют ошибок
      const finalUpdatedTasks = updatedTasks.map(task => ({
        ...task,
        error: task.completed ? false : task.error // Выполненные задачи не должны показывать ошибку
      }));
      
      // ⚠️ КРИТИЧНО: Считаем задачу выполненной, если она completed ИЛИ opened (пользователь открыл и выполнил действие)
      // Это исправляет проблему, когда все ссылки пройдены, но проверка через API не прошла
      const newCompletedCount = finalUpdatedTasks.filter(t => t.completed || t.opened).length;
      
      // ⚠️ КРИТИЧНО: Проверяем ПЕРЕД setTasks - если все задачи завершены, обновляем состояние и делаем редирект с задержкой
      const allTasksCompleted = newCompletedCount === finalUpdatedTasks.length && finalUpdatedTasks.length > 0;
      const allTasksVerified = finalUpdatedTasks.every((task) => task.completed && task.verified);
      
      if (allTasksCompleted && allTasksVerified && user) {
        const linkPublishedSession = sessionStorage.getItem('link_published');
        const linkPublishedLocal = localStorage.getItem('link_published');
        if (linkPublishedSession !== 'true' && linkPublishedLocal !== 'true') {
          // ⚠️ КРИТИЧНО: Обновляем состояние, чтобы показать зеленые кнопки
          setTasks(finalUpdatedTasks);
          setCompletedCount(newCompletedCount);
          
          // ⚠️ КРИТИЧНО: Задержка 2 секунды, чтобы зеленая кнопка светилась дольше
          // НЕ вызываем loadTasks, чтобы не было промежуточных рендеров
          setTimeout(() => {
            console.log('🚀 [VERIFY] All tasks verified, redirecting to wallet after showing green buttons');
            window.location.href = '/buyToken';
          }, 2000); // 2 секунды чтобы показать зеленые кнопки
          return; // Прекращаем выполнение, НЕ вызываем loadTasks
        }
      }

      // ⚠️ КРИТИЧНО: Если не все задачи завершены, обновляем состояние нормально
      setTasks(finalUpdatedTasks);
      setCompletedCount(newCompletedCount);

      console.log(`📊 [VERIFY] Verification complete: ${newCompletedCount}/${updatedTasks.length} completed`);

      // ✅ Если все выполнены - редирект на покупку токена (НЕ перезагружаем задачи, чтобы кнопки остались зелеными)
      // ⚠️ КРИТИЧНО: Проверяем, что все задания выполнены И открыты И нет ошибок
      const allCompleted = finalUpdatedTasks.every((t) => t.completed);
      // ВАЖНО: Проверяем, что ВСЕ задания открыты (независимо от выполнения)
      const allOpened = finalUpdatedTasks.every((t) => t.opened === true);
      const hasErrors = finalUpdatedTasks.some((t) => t.error);
      
      console.log('🔍 [VERIFY] Redirect check after verification:', {
        allCompleted,
        allOpened,
        hasErrors,
        tasksCount: finalUpdatedTasks.length,
        openedCount: finalUpdatedTasks.filter(t => t.opened).length,
        taskStates: finalUpdatedTasks.map(t => ({ id: t.link_id, opened: t.opened, completed: t.completed, error: t.error }))
      });
      
      // ⚠️ КРИТИЧНО: НЕ перезагружаем задачи после проверки, чтобы сохранить состояние verified
      // Состояние уже обновлено через setTasks выше, не нужно перезагружать из БД
      // Это предотвращает "мигание" состояния - задания остаются в проверенном состоянии
      // После проверки состояние фиксируется и не меняется до следующей загрузки страницы
      
      setVerifying(false);
      
      // ⚠️ КРИТИЧНО: Проверяем, что все задачи либо completed, либо opened (пользователь их прошел)
      const allTasksCompletedOrOpened = finalUpdatedTasks.every(t => t.completed || t.opened);
      
      if (!allTasksCompletedOrOpened) {
        // Показываем предупреждение с детальными сообщениями
        const incompleteCount = finalUpdatedTasks.filter(t => !t.completed && !t.opened).length;
        let message = `You have not completed all tasks. Check the remaining ${incompleteCount} link(s).\n\n`;
        
        if (messages.length > 0) {
          message += 'Details:\n';
          messages.forEach((msg, idx) => {
            message += `\n${idx + 1}. ${msg.message}`;
            if (msg.neynarUrl) {
              message += `\n   Check: ${msg.neynarUrl}`;
            }
          });
        }
        
        console.warn(message);
        // NOTE: Do not show a blocking popup on mobile (iOS in particular).
        // Users reported this alert prevents smooth navigation; keep details in console only.
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
                <h3 className="text-2xl font-black mb-1">Congratulations!</h3>
                <p className="text-lg font-bold">Your link has been published!</p>
                <p className="text-sm text-green-100 mt-1">It is now available in the task list.</p>
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
            <p className="text-lg md:text-xl text-white text-opacity-90 max-w-2xl mx-auto">
              <span>Open each link and perform the task:</span>
              {' '}
              <span className="font-bold text-yellow-300 text-xl md:text-2xl">
                {activity === 'like' && '❤️ LIKE'}
                {activity === 'recast' && '🔄 RECAST'}
              </span>
            </p>
          </div>

          {apiAccessBlocked && apiAccessBlockedMessage && (
            <div className="mb-8 bg-red-600/90 text-white rounded-2xl shadow-2xl p-6 border-2 border-white/30">
              <div className="font-black text-xl mb-2">🚫 API BLOCKED</div>
              <div className="text-sm md:text-base whitespace-pre-line">{apiAccessBlockedMessage}</div>
            </div>
          )}



          {/* Список заданий */}
          <div className="space-y-6 mb-12">
            {tasks.length === 0 ? (
              <div className="text-center py-12 bg-white bg-opacity-10 backdrop-blur-md rounded-2xl border border-white/30 shadow-2xl">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-2xl font-bold text-white mb-2">No tasks available</h3>
                <p className="text-white text-opacity-80 mb-6">
                  {activity 
                    ? `No ${activity} tasks found. Please check back later.`
                    : 'No tasks found. Please select a task type first.'}
                </p>
                {!activity && (
                  <button
                    onClick={() => router.push('/')}
                    className="btn-gold-glow px-6 py-3 font-bold text-white"
                  >
                    Go to Home Page
                  </button>
                )}
              </div>
            ) : (
              tasks.map((task, index) => {
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
                    onOpen={() => handleOpenLink(task.cast_url, task.link_id, task.cast_hash)}
                  />
                );
              })
            )}
          </div>

          {/* Модная кнопка проверки */}
          <div className="sticky bottom-8 bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white border-opacity-20">
            <button
              onClick={handleVerifyAll}
              disabled={verifying}
              className={`btn-gold-glow w-full px-12 py-8 text-white font-black text-2xl md:text-3xl ${verifying ? 'disabled' : ''}`}
            >
              {/* Переливающийся эффект */}
              {!verifying && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 z-10"></div>
              )}
              <div className="flex items-center justify-center gap-4 relative z-20">
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

