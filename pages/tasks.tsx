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
  // Состояние openedTasks только в памяти (не сохраняется в localStorage)
  // Сбрасывается при каждой загрузке страницы, чтобы можно было открывать ссылки снова
  const [openedTasks, setOpenedTasks] = useState<Record<string, boolean>>({});
  // Храним состояние ошибок для заданий (используем useRef для сохранения между рендерами)
  const taskErrorsRef = useRef<Record<string, boolean>>({});
  // Храним активные polling интервалы для очистки
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  // ⚠️ КРИТИЧНО: Храним verified задания в ref, чтобы они не терялись при обновлениях
  const verifiedTasksRef = useRef<Set<string>>(new Set());

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
      
      // Обновляем список задач каждые 2 секунды (быстрее для более оперативного отображения новых ссылок)
      // ⚠️ КРИТИЧНО: loadTasks сохраняет состояние verified заданий, поэтому можно безопасно обновлять
      // ⚠️ КРИТИЧНО: Интервал обновления не перезаписывает verified состояние благодаря логике в loadTasks
      const interval = setInterval(() => {
        loadTasks(user.fid, false);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [router, user, authLoading, isInitialized]);

  // ⚠️ КРИТИЧНО: Автоматически запускаем polling для всех открытых заданий после загрузки
  useEffect(() => {
    if (!user?.fid || !activity || tasks.length === 0) return;

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
  }, [tasks, user?.fid, activity, openedTasks]);

  const loadTasks = async (userFid: number, showLoading: boolean = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Получаем выбранную активность для фильтрации
      const currentActivity = activity || (typeof window !== 'undefined' ? localStorage.getItem('selected_activity') : null);
      
      // Fetch links from API endpoint (server-side) с фильтрацией по taskType
      const taskTypeParam = currentActivity ? `&taskType=${currentActivity}` : '';
      const linksResponse = await fetch(`/api/tasks?t=${Date.now()}${taskTypeParam}`);
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
        const castHash = extractCastHash(link.cast_url) || '';
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
        
        const finalCompleted = wasVerified ? true : isCompleted;
        const finalVerified = wasVerified ? true : isCompleted;
        
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
    // ⚠️ КРИТИЧНО: Убираем ошибку при открытии задачи, чтобы кнопка стала синей
    delete taskErrorsRef.current[linkId];
    // Также обновляем в tasks для немедленного отображения
    // ⚠️ КРИТИЧНО: Не меняем состояние completed && verified заданий
    setTasks(prevTasks => 
      prevTasks.map(task => {
        if (task.link_id === linkId) {
          // Если задание уже completed && verified, не меняем его состояние
          if (task.completed && task.verified) {
            return task; // Возвращаем как есть
          }
          return { ...task, opened: true, error: false };
        }
        return task;
      })
    );
  };

  // Polling для автоматической проверки активности после открытия ссылки
  const startPollingForActivity = (castUrl: string, linkId: string, activityType: TaskType) => {
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
                const progressData = await progressResponse.json();
                const progress = progressData.progress || null;
                const completedLinks = progress?.completed_links || [];
                
                // Получаем список всех задач
                const currentActivity = activity || (typeof window !== 'undefined' ? localStorage.getItem('selected_activity') : null);
                const taskTypeParam = currentActivity ? `&taskType=${currentActivity}` : '';
                const linksResponse = await fetch(`/api/tasks?t=${Date.now()}${taskTypeParam}`);
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
            // ⚠️ КРИТИЧНО: Если задача открыта, но активность еще не найдена - НЕ устанавливаем error
            // Просто продолжаем polling, не меняя цвет кнопки с синего на красный
            console.log(`⏳ [POLLING] Task ${linkId} is opened, but activity not found yet. Continuing polling...`);
            // НЕ устанавливаем error, оставляем кнопку синей
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

  // Открыть ссылку
  const handleOpenLink = (castUrl: string, linkId: string) => {
    // ⚠️ КРИТИЧНО: Проверяем, не выполнено ли уже задание - если да, не запускаем polling
    const currentTask = tasks.find(t => t.link_id === linkId);
    if (currentTask?.completed && currentTask?.verified) {
      console.log(`⏹️ [OPEN] Task ${linkId} already completed and verified, skipping polling`);
      // Просто открываем ссылку, но не запускаем polling
    } else {
      // Отмечаем задачу как открытую
      markOpened(linkId);
      
      // Запускаем polling для автоматической проверки
      if (activity) {
        startPollingForActivity(castUrl, linkId, activity);
      }
    }
    
    // Определяем, мобильное ли устройство
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Открываем ссылку как есть (Base), без farcaster:// протокола
    window.open(castUrl, '_blank');
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
  }): Promise<{ completed: boolean; userMessage?: string; hashWarning?: string; isError?: boolean; neynarExplorerUrl?: string }> => {
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
            
            // ⚠️ КРИТИЧНО: Задача может быть выполнена ТОЛЬКО если она была открыта И активность найдена
            const finalCompleted = isOpened && result.completed;
            
            // Определяем, была ли ошибка (cast не найден или активность не найдена)
            // ВАЖНО: Если задача выполнена (finalCompleted === true), ошибки быть не должно
            // Ошибка только если:
            // 1. Реальная ошибка API (result.isError === true)
            // 2. Проверка прошла успешно, но активность не найдена И задача не открыта
            // ⚠️ НЕ устанавливаем ошибку просто потому, что задача не открыта - это нормально
            const hasError = finalCompleted ? false : (
              result.isError || 
              (!isOpened && !result.completed && !result.isError) // Только если проверка прошла, но активность не найдена И задача не открыта
            );
            
            console.log(`🔍 [VERIFY] Task ${task.link_id} verification:`, {
              isOpened,
              resultCompleted: result.completed,
              finalCompleted,
              hasError,
              resultIsError: result.isError
            });
            
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
              console.log(`🔴 [VERIFY] Stored error for task ${task.link_id}`, taskErrorsRef.current);
            } else {
              // Убираем ошибку, если задание выполнено
              delete taskErrorsRef.current[task.link_id];
              console.log(`✅ [VERIFY] Removed error for task ${task.link_id}`, taskErrorsRef.current);
            }
            
            return {
              ...task,
              completed: finalCompleted, // ⚠️ Используем finalCompleted, а не result.completed
              verified: true,
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
      
      const newCompletedCount = finalUpdatedTasks.filter(t => t.completed).length;
      
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
      
      if (newCompletedCount < updatedTasks.length) {
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
            <p className="text-lg md:text-xl text-white text-opacity-90 max-w-2xl mx-auto">
              <span>Open each link and perform the task:</span>
              {' '}
              <span className="font-bold text-yellow-300 text-xl md:text-2xl">
                {activity === 'like' && '❤️ LIKE'}
                {activity === 'recast' && '🔄 RECAST'}
              </span>
            </p>
          </div>



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
                    onOpen={() => handleOpenLink(task.cast_url, task.link_id)}
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

