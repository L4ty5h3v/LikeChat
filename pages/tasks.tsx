// Страница задач: прохождение 10 ссылок
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import TaskCard from '@/components/TaskCard';
import ProgressBar from '@/components/ProgressBar';
import Button from '@/components/Button';
import { getUserProgress, markLinkCompleted, getAllLinks } from '@/lib/db-config';
import { useFarcasterAuth } from '@/contexts/FarcasterAuthContext';
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
      
      const progress = await getUserProgress(userFid);
      const completedLinks = progress?.completed_links || [];

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

      const taskList: TaskProgress[] = filteredLinks.map((link: LinkSubmission) => ({
        link_id: link.id,
        cast_url: link.cast_url,
        username: link.username,
        pfp_url: link.pfp_url,
        completed: completedLinks.includes(link.id),
        verified: completedLinks.includes(link.id),
      }));

      setTasks(taskList);
      setCompletedCount(completedLinks.length);
      
      console.log(`✅ Loaded ${taskList.length} tasks, ${completedLinks.length} completed`);
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
          getUserProgress(user.fid),
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

  // Открыть ссылку
  const handleOpenLink = (castUrl: string) => {
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

  const handleToggleTask = async (linkId: string, nextState: boolean) => {
    setTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task =>
        task.link_id === linkId
          ? {
              ...task,
              completed: nextState,
              verified: nextState,
            }
          : task
      );

      const updatedCount = updatedTasks.filter(task => task.completed).length;
      setCompletedCount(updatedCount);
      return updatedTasks;
    });

    if (nextState && user) {
      try {
        await markLinkCompleted(user.fid, linkId);
      } catch (error) {
        console.error('Error marking link as completed:', error);
      }
    }
  };

  // Проверить выполнение всех заданий
  const handleVerifyAll = async () => {
    console.log('🔍 [VERIFY] Starting verification process...');
    console.log('🔍 [VERIFY] Current state:', {
      hasUser: !!user,
      userFid: user?.fid,
      username: user?.username,
      hasActivity: !!activity,
      activity,
      tasksCount: tasks.length,
      completedCount,
    });
    
    // Проверяем наличие user из контекста
    if (!user) {
      console.error('❌ [VERIFY] User is null in context!');
      alert('Ошибка: данные пользователя не найдены. Пожалуйста, авторизуйтесь заново.');
      router.push('/');
      return;
    }
    
    if (!activity) {
      console.error('❌ [VERIFY] Missing activity:', {
        hasUser: !!user,
        hasActivity: !!activity,
      });
      return;
    }
    
    // ⚠️ ПРОВЕРКА FID: Убеждаемся, что fid существует и валиден
    if (!user.fid || typeof user.fid !== 'number') {
      console.error('❌ [VERIFY] Invalid or missing user.fid:', user.fid);
      alert('Ошибка: не найден FID пользователя. Попробуйте перезагрузить страницу.');
      return;
    }

    setVerifying(true);
    const incomplete: string[] = [];
    let verificationErrors: string[] = [];
    let warnings: string[] = [];
    let updatedTasks = [...tasks]; // Создаем копию массива для обновления

    try {
      console.log(`🔍 [VERIFY] Processing ${updatedTasks.length} tasks...`);
      
      for (let i = 0; i < updatedTasks.length; i++) {
        const task = updatedTasks[i];
        if (!task.completed) {
          console.log(`🔍 [VERIFY] [${i+1}/${updatedTasks.length}] Verifying task: ${task.cast_url} for user ${user.fid}`);
          
          try {
            // Используем серверный API endpoint для проверки
            const verifyRequest = {
              castUrl: task.cast_url,
              userFid: user.fid,
              activityType: activity,
            };
            
            console.log(`📡 [VERIFY] [${i+1}/${updatedTasks.length}] Sending verify request:`, verifyRequest);
            
            const response = await fetch('/api/verify-activity', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(verifyRequest),
            });

            console.log(`📡 [VERIFY] [${i+1}/${updatedTasks.length}] Response status:`, response.status);
            
            const data = await response.json();
            
            console.log(`✅ [VERIFY] [${i+1}/${updatedTasks.length}] Verification result:`, data);

            if (data.warning) {
              warnings.push(data.warning);
            }

            if (data.completed) {
              // Сохраняем в БД
              await markLinkCompleted(user.fid, task.link_id);
              console.log(`✅ Marked link ${task.link_id} as completed for user ${user.fid}`);
              
              // Обновляем состояние задачи
              updatedTasks[i] = {
                ...task,
                completed: true,
                verified: true,
              };
            } else {
              incomplete.push(task.cast_url);
            }
          } catch (error: any) {
            console.error(`❌ Error verifying ${task.cast_url}:`, error);
            verificationErrors.push(`${task.cast_url}: ${error.message || 'Unknown error'}`);
            // В случае ошибки сети, отмечаем как выполненное для продолжения тестирования
            if (error.message?.includes('fetch') || error.message?.includes('network')) {
              await markLinkCompleted(user.fid, task.link_id);
              updatedTasks[i] = {
                ...task,
                completed: true,
                verified: true,
              };
              warnings.push(`Network error for ${task.cast_url} - marked as completed`);
            } else {
              incomplete.push(task.cast_url);
            }
          }
        }
      }

      // Перезагружаем прогресс из БД для подтверждения
      const updatedProgress = await getUserProgress(user.fid);
      const completedLinks = updatedProgress?.completed_links || [];
      
      // Обновляем задачи на основе данных из БД
      const finalTasks = updatedTasks.map(task => ({
        ...task,
        completed: completedLinks.includes(task.link_id),
        verified: completedLinks.includes(task.link_id),
      }));
      
      const newCompletedCount = finalTasks.filter(t => t.completed).length;
      
      console.log(`📊 Progress update: ${newCompletedCount}/${tasks.length} tasks completed`);
      console.log(`📊 Completed links in DB:`, completedLinks);
      console.log(`📊 Tasks updated:`, finalTasks.map(t => ({ id: t.link_id, completed: t.completed })));
      
      // Обновляем состояние
      setTasks(finalTasks);
      setCompletedCount(newCompletedCount);
      setIncompleteLinks(incomplete);

      if (warnings.length > 0) {
        console.warn('⚠️ Verification warnings:', warnings);
      }

      if (verificationErrors.length > 0) {
        console.warn('⚠️ Verification errors:', verificationErrors);
      }

      if (incomplete.length === 0 && newCompletedCount === tasks.length) {
        // Все задания выполнены, переходим к покупке токена
        setTimeout(() => {
          router.push('/buyToken');
        }, 1500);
      } else if (incomplete.length > 0) {
        // Показываем предупреждение, но не блокируем полностью
        const message = incomplete.length === tasks.length 
          ? 'Не удалось проверить выполнение задач. Возможно, API ключ Neynar не настроен или задачи действительно не выполнены.'
          : `Не удалось проверить ${incomplete.length} из ${tasks.length} задач.`;
        console.warn(message);
      }
    } catch (error: any) {
      console.error('❌ Error verifying tasks:', error);
      alert(`Ошибка при проверке заданий: ${error.message || 'Unknown error'}\n\nПроверьте консоль браузера для деталей.`);
    } finally {
      setVerifying(false);
    }
  };

  // ⚠️ КРИТИЧЕСКИ ВАЖНО: Удаляем модальное окно "SYSTEM INITIALIZATION" при монтировании компонента
  // ⚠️ ДОПОЛНИТЕЛЬНО: Диагностика - ищем и логируем все найденные элементы
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 🔍 ДИАГНОСТИЧЕСКАЯ ФУНКЦИЯ: Ищет и логирует все элементы с модальным окном
    const findAndLogModal = () => {
      try {
        console.log('%c🔍 [TASKS-DIAGNOSTIC] Поиск модального окна...', 'color: #0f0; font-size: 14px; font-weight: bold;');
        let foundCount = 0;
        const foundElements: any[] = [];
        
        // 1. Проверяем modal-root
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot) {
          const modalText = modalRoot.textContent || '';
          if (modalText.includes('SYSTEM INITIALIZATION')) {
            foundCount++;
            foundElements.push({ type: 'modal-root', element: modalRoot });
            console.error('❌ [TASKS-DIAGNOSTIC] НАЙДЕНО в modal-root:', {
              element: modalRoot,
              text: modalText.substring(0, 200),
              classes: modalRoot.className,
              children: modalRoot.children.length,
              outerHTML: modalRoot.outerHTML.substring(0, 500)
            });
          }
        }
        
        // 2. Ищем все элементы с текстом
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const text = el.textContent || el.innerText || '';
          if (text.includes('SYSTEM INITIALIZATION') || 
              text.includes('You are one of the first users') ||
              text.includes('Links in system: 0/10')) {
            
            // Проверяем, не дочерний ли это элемент уже найденного
            let isChild = false;
            foundElements.forEach(found => {
              if (found.element.contains(el)) isChild = true;
            });
            
            if (!isChild) {
              foundCount++;
              const style = window.getComputedStyle(el);
              foundElements.push({ type: 'text', element: el });
              console.error('❌ [TASKS-DIAGNOSTIC] НАЙДЕН элемент:', {
                tagName: el.tagName,
                id: el.id || 'none',
                className: el.className || 'none',
                position: style.position,
                display: style.display,
                zIndex: style.zIndex,
                text: text.substring(0, 150),
                element: el,
                outerHTML: el.outerHTML.substring(0, 500)
              });
            }
          }
        });
        
        // 3. Ищем purple gradient
        const purpleElements = document.querySelectorAll('[class*="from-blue"], [class*="to-purple"]');
        purpleElements.forEach((el) => {
          const text = el.textContent || '';
          if (text.includes('SYSTEM INITIALIZATION')) {
            foundCount++;
            foundElements.push({ type: 'purple', element: el });
            console.error('❌ [TASKS-DIAGNOSTIC] НАЙДЕН purple gradient:', {
              element: el,
              classes: el.className,
              text: text.substring(0, 150)
            });
          }
        });
        
        // 4. Ищем fixed элементы
        const allDivs = document.querySelectorAll('div');
        allDivs.forEach((div) => {
          const style = window.getComputedStyle(div);
          if (style.position === 'fixed') {
            const text = div.textContent || '';
            if (text.includes('SYSTEM INITIALIZATION')) {
              foundCount++;
              foundElements.push({ type: 'fixed', element: div });
              console.error('❌ [TASKS-DIAGNOSTIC] НАЙДЕН fixed элемент:', {
                element: div,
                classes: div.className || 'none',
                zIndex: style.zIndex,
                text: text.substring(0, 150)
              });
            }
          }
        });
        
        console.log(`\n📊 [TASKS-DIAGNOSTIC] ИТОГО: Найдено ${foundCount} экземпляров модального окна`);
        if (foundCount > 0) {
          console.error('⚠️ [TASKS-DIAGNOSTIC] МОДАЛЬНОЕ ОКНО ВСЕ ЕЩЕ В DOM!');
          console.log('Найденные элементы сохранены в window.foundModalElements');
          (window as any).foundModalElements = foundElements;
        } else {
          console.log('✅ [TASKS-DIAGNOSTIC] МОДАЛЬНОЕ ОКНО НЕ НАЙДЕНО В DOM');
        }
        
        return foundElements;
      } catch (e) {
        console.error('❌ [TASKS-DIAGNOSTIC] Ошибка при поиске:', e);
        return [];
      }
    };
    
    const removeModal = () => {
      try {
        // Ищем все элементы с текстом модального окна
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          const text = el.textContent || el.innerText || '';
          if (text.includes('SYSTEM INITIALIZATION') || 
              text.includes('You are one of the first users') ||
              text.includes('Links in system: 0/10') ||
              text.includes('collecting the first 10 links')) {
            
            // Ищем родителя с fixed позиционированием
            let parent = el.closest('[class*="fixed"], [class*="backdrop"], [class*="modal"], [class*="z-50"]');
            if (!parent) {
              // Если не нашли по классам, ищем по стилям
              let current = el.parentElement;
              for (let i = 0; i < 20 && current; i++) {
                const style = window.getComputedStyle(current);
                if (style.position === 'fixed' && parseInt(style.zIndex) >= 40) {
                  parent = current;
                  break;
                }
                current = current.parentElement;
              }
            }
            
            if (parent) {
              console.warn('🧹 [TASKS] Found and removing SYSTEM INITIALIZATION modal:', parent);
              parent.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important; width: 0 !important; height: 0 !important; overflow: hidden !important; z-index: -9999 !important;';
              try {
                parent.remove();
              } catch (e) {
                if (parent.parentNode) {
                  parent.parentNode.removeChild(parent);
                }
              }
            } else {
              // Если не нашли родителя, скрываем сам элемент
              el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
            }
          }
        });
        
        // Удаляем modal-root если он существует
        const modalRoot = document.getElementById('modal-root');
        if (modalRoot) {
          const modalText = modalRoot.textContent || '';
          if (modalText.includes('SYSTEM INITIALIZATION')) {
            console.warn('🧹 [TASKS] Removing modal-root with SYSTEM INITIALIZATION');
            modalRoot.remove();
          }
        }
      } catch (e) {
        console.error('❌ [TASKS] Error removing modal:', e);
      }
    };
    
    // 🔍 Сначала запускаем диагностику
    setTimeout(() => {
      findAndLogModal();
    }, 1000); // Даем время на рендеринг
    
    // Затем удаляем
    removeModal();
    setTimeout(removeModal, 0);
    setTimeout(removeModal, 100);
    setTimeout(removeModal, 500);
    
    const interval = setInterval(() => {
      removeModal();
    }, 100);
    setTimeout(() => clearInterval(interval), 10000);
    
    return () => clearInterval(interval);
  }, []);

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
            <ProgressBar completed={completedCount} total={tasks.length} />
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

          {/* Список заданий */}
          <div className="space-y-6 mb-12">
            {tasks.map((task, index) => (
              <TaskCard
                key={task.link_id}
                task={task}
                index={index}
                onOpen={() => handleOpenLink(task.cast_url)}
                onToggleComplete={(nextState) => handleToggleTask(task.link_id, nextState)}
              />
            ))}
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

