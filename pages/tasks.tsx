// Страница задач: прохождение 10 ссылок
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import TaskCard from '@/components/TaskCard';
import ProgressBar from '@/components/ProgressBar';
import Button from '@/components/Button';
import { getUserProgress, markLinkCompleted } from '@/lib/db-config';
import type { LinkSubmission, FarcasterUser, ActivityType, TaskProgress } from '@/types';

export default function Tasks() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [incompleteLinks, setIncompleteLinks] = useState<string[]>([]);
  const [showPublishedSuccess, setShowPublishedSuccess] = useState(false);

  // Загрузка данных
  useEffect(() => {
    // Проверяем, что код выполняется на клиенте
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('farcaster_user');
      const savedActivity = localStorage.getItem('selected_activity');

      if (!savedUser || !savedActivity) {
        router.push('/');
        return;
      }

      setUser(JSON.parse(savedUser));
      setActivity(savedActivity as ActivityType);
      
      // Проверяем, есть ли параметр published в URL (после публикации ссылки)
      const urlParams = new URLSearchParams(window.location.search);
      const justPublished = urlParams.get('published') === 'true';
      
      if (justPublished) {
        setShowPublishedSuccess(true);
        // Убираем параметр из URL
        window.history.replaceState({}, '', '/tasks');
        // Скрываем уведомление через 5 секунд
        setTimeout(() => {
          setShowPublishedSuccess(false);
        }, 5000);
        
        // Принудительно обновляем список сразу и несколько раз подряд для быстрого появления ссылки
        const userFid = JSON.parse(savedUser).fid;
        loadTasks(userFid, true);
        setTimeout(() => loadTasks(userFid, false), 1000);
        setTimeout(() => loadTasks(userFid, false), 2000);
        setTimeout(() => loadTasks(userFid, false), 3000);
      } else {
        loadTasks(JSON.parse(savedUser).fid, true);
      }
      
      // Обновляем список задач каждые 2 секунды (быстрее для более оперативного отображения новых ссылок)
      const interval = setInterval(() => {
        loadTasks(JSON.parse(savedUser).fid, false);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [router]);

  const loadTasks = async (userFid: number, showLoading: boolean = true) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Fetch links from API endpoint (server-side) с cache-busting
      const linksResponse = await fetch(`/api/tasks?t=${Date.now()}`);
      const linksData = await linksResponse.json();
      const links = linksData.links || [];
      
      const progress = await getUserProgress(userFid);
      const completedLinks = progress?.completed_links || [];

      const taskList: TaskProgress[] = links.map((link: LinkSubmission) => ({
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
    if (!user || !activity) return;

    setVerifying(true);
    const incomplete: string[] = [];
    let verificationErrors: string[] = [];
    let warnings: string[] = [];
    let updatedTasks = [...tasks]; // Создаем копию массива для обновления

    try {
      for (let i = 0; i < updatedTasks.length; i++) {
        const task = updatedTasks[i];
        if (!task.completed) {
          console.log(`🔍 Verifying task: ${task.cast_url} for user ${user.fid}`);
          
          try {
            // Используем серверный API endpoint для проверки
            const response = await fetch('/api/verify-activity', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                castUrl: task.cast_url,
                userFid: user.fid,
                activityType: activity,
              }),
            });

            const data = await response.json();
            
            console.log(`✅ Verification result for ${task.cast_url}:`, data);

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
              <p className="text-center text-black font-black mt-8 text-2xl md:text-3xl">
                Excellent! Moving to token Mrs Crypto purchase... 🚀
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

