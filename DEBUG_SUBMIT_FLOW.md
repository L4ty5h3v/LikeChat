# Код обработки публикации и точки возможных проблем

## 1. Публикация ссылки (`pages/submit.tsx`, строки 81-145)

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!user || !activity || !castUrl) return;

  setError('');

  // Валидация URL
  if (!validateUrl(castUrl)) {
    setError('Please enter a valid Farcaster/Warpcast cast link');
    return;
  }

  setLoading(true);

  try {
    console.log('📝 Submitting link via API...', {
      userFid: user.fid,
      username: user.username,
      castUrl: castUrl.substring(0, 50) + '...',
      activity,
    });

    const response = await fetch('/api/submit-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userFid: user.fid,          // ⚠️ ВОЗМОЖНАЯ ПРОБЛЕМА: user.fid может быть undefined/null после swap
        username: user.username,     // ⚠️ ВОЗМОЖНАЯ ПРОБЛЕМА: username может быть undefined
        pfpUrl: user.pfp_url || '',
        castUrl: castUrl,
        activityType: activity,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('❌ API submit-link error:', data.error || data);
      throw new Error(data.error || 'Failed to submit link');
    }

    if (data.link) {
      console.log('✅ Link saved to database via API:', data.link.id);
      setPublishedLinkId(data.link.id);
      setShowSuccessModal(true);
      setTimeout(() => {
        router.push('/tasks?published=true');
      }, 3000);
    } else {
      throw new Error('Link object not returned from API');
    }
  } catch (err: any) {
    console.error('Error submitting link:', err);
    setError(err.message || 'An error occurred');
  } finally {
    setLoading(false);
  }
};
```

## 2. API endpoint публикации (`pages/api/submit-link.ts`)

```typescript
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userFid, username, pfpUrl, castUrl, activityType } = req.body;

    // ⚠️ ВОЗМОЖНАЯ ПРОБЛЕМА: Проверка обязательных полей
    if (!userFid || !username || !castUrl || !activityType) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: userFid, username, castUrl, activityType' 
      });
    }

    console.log('📝 API /submit-link: Submitting link:', {
      userFid,
      username,
      castUrl: castUrl.substring(0, 50) + '...',
      activityType,
    });

    const result = await submitLink(
      userFid,
      username,
      pfpUrl || '',
      castUrl,
      activityType
    );

    if (!result) {
      console.error('❌ API /submit-link: submitLink returned null');
      return res.status(500).json({ 
        success: false,
        error: 'Failed to submit link - result is null' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      link: result 
    });
  } catch (error: any) {
    console.error('❌ API /submit-link error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to submit link',
      details: error.toString()
    });
  }
}
```

## 3. Проверка завершения заданий (`pages/tasks.tsx`, строки 193-280)

```typescript
const handleVerifyAll = async () => {
  if (!user || !activity) return;  // ⚠️ ВОЗМОЖНАЯ ПРОБЛЕМА: user может быть null после swap

  setVerifying(true);
  const incomplete: string[] = [];
  let verificationErrors: string[] = [];
  let warnings: string[] = [];
  let updatedTasks = [...tasks];

  try {
    for (let i = 0; i < updatedTasks.length; i++) {
      const task = updatedTasks[i];
      if (!task.completed) {
        console.log(`🔍 Verifying task: ${task.cast_url} for user ${user.fid}`);  // ⚠️ user.fid может быть undefined
        
        try {
          const response = await fetch('/api/verify-activity', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              castUrl: task.cast_url,
              userFid: user.fid,  // ⚠️ ВОЗМОЖНАЯ ПРОБЛЕМА: user.fid может быть undefined
              activityType: activity,
            }),
          });

          const data = await response.json();
          
          console.log(`✅ Verification result for ${task.cast_url}:`, data);

          if (data.completed) {
            await markLinkCompleted(user.fid, task.link_id);  // ⚠️ user.fid может быть undefined
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
          // ...
        }
      }
    }

    // Перезагружаем прогресс из БД
    const updatedProgress = await getUserProgress(user.fid);  // ⚠️ user.fid может быть undefined
    // ...
  } catch (error: any) {
    console.error('❌ Error verifying tasks:', error);
  } finally {
    setVerifying(false);
  }
};
```

## 4. Получение данных пользователя (`pages/index.tsx`)

Пользователь получается из:
1. SDK context (если доступен)
2. Neynar API по адресу кошелька (если SDK context недоступен)

**Проблема:** После swap может быть проблема с:
- SDK context не обновляется
- localStorage не сохраняет user после swap
- Neynar API не возвращает fid по адресу кошелька

## Точки возможных проблем:

1. **`user.fid` undefined после swap:**
   - Проверить localStorage после swap
   - Проверить, обновляется ли SDK context после swap
   - Добавить fallback: перезапросить user data через Neynar API

2. **Neynar API не возвращает fid:**
   - Проверить API ключ
   - Проверить формат адреса кошелька
   - Добавить retry логику

3. **CORS/State проблемы:**
   - В minikit есть хуки для retry
   - Проверить, не блокируются ли запросы

4. **Авторизация после swap:**
   - Проверить, сохраняется ли user в localStorage
   - Проверить, обновляется ли SDK context

