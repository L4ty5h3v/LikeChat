// Страница задач: прохождение 10 ссылок
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import TaskCard from '@/components/TaskCard';
import ProgressBar from '@/components/ProgressBar';
import Button from '@/components/Button';
import { getLastTenLinks, getUserProgress, markLinkCompleted } from '@/lib/db-config';
import { checkUserActivity } from '@/lib/neynar';
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
      
      loadTasks(JSON.parse(savedUser).fid);
    }
  }, [router]);

  const loadTasks = async (userFid: number) => {
    setLoading(true);
    try {
      const links = await getLastTenLinks();
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
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
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

  // Проверить выполнение всех заданий
  const handleVerifyAll = async () => {
    if (!user || !activity) return;

    setVerifying(true);
    const incomplete: string[] = [];

    try {
      for (const task of tasks) {
        if (!task.completed) {
          const isCompleted = await checkUserActivity(
            task.cast_url,
            user.fid,
            activity
          );

          if (isCompleted) {
            await markLinkCompleted(user.fid, task.link_id);
            task.completed = true;
            task.verified = true;
          } else {
            incomplete.push(task.cast_url);
          }
        }
      }

      const newCompletedCount = tasks.filter(t => t.completed).length;
      setCompletedCount(newCompletedCount);
      setIncompleteLinks(incomplete);

      if (incomplete.length === 0) {
        // Все задания выполнены, переходим к покупке токена
        setTimeout(() => {
          router.push('/buyToken');
        }, 1500);
      }
    } catch (error) {
      console.error('Error verifying tasks:', error);
      alert('Error verifying tasks');
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
    <Layout title="Like Chat - Tasks">
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
              />
            ))}
          </div>

          {/* Модная кнопка проверки */}
          <div className="sticky bottom-8 bg-white bg-opacity-95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-white border-opacity-20">
            <button
              onClick={handleVerifyAll}
              disabled={completedCount === tasks.length || verifying}
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
                    <span>
                      {completedCount === tasks.length
                        ? '✓ ALL TASKS COMPLETED'
                        : 'VERIFY COMPLETION'}
                    </span>
                    <span className="text-4xl md:text-5xl">
                      {completedCount === tasks.length ? '🎉' : '🔍'}
                    </span>
                  </>
                )}
              </div>
              {!verifying && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}
            </button>

            {completedCount === tasks.length && (
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

