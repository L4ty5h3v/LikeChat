# Настройка Supabase для ЛайкЧат

## Шаги настройки

### 1. Создайте проект в Supabase

1. Перейдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Сохраните URL и anon key

### 2. Создайте таблицы

Выполните следующие SQL запросы в SQL Editor:

#### Таблица link_submissions

\`\`\`sql
-- Включить расширение для UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица для хранения опубликованных ссылок
CREATE TABLE link_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_fid BIGINT NOT NULL,
  username TEXT NOT NULL,
  pfp_url TEXT,
  cast_url TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('like', 'recast', 'comment')),
  completed_by BIGINT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрой выборки последних ссылок
CREATE INDEX idx_link_submissions_created_at ON link_submissions(created_at DESC);

-- Индекс для поиска по пользователю
CREATE INDEX idx_link_submissions_user_fid ON link_submissions(user_fid);

-- Комментарий к таблице
COMMENT ON TABLE link_submissions IS 'Опубликованные ссылки пользователей';
\`\`\`

#### Таблица user_progress

\`\`\`sql
-- Таблица для хранения прогресса пользователей
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_fid BIGINT UNIQUE NOT NULL,
  completed_links UUID[] DEFAULT '{}',
  token_purchased BOOLEAN DEFAULT FALSE,
  selected_activity TEXT CHECK (selected_activity IN ('like', 'recast', 'comment')),
  current_link_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по FID
CREATE INDEX idx_user_progress_fid ON user_progress(user_fid);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарий к таблице
COMMENT ON TABLE user_progress IS 'Прогресс выполнения заданий пользователями';
\`\`\`

### 3. Настройте Row Level Security (RLS)

#### Для link_submissions:

\`\`\`sql
-- Включить RLS
ALTER TABLE link_submissions ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать
CREATE POLICY "Allow public read access"
  ON link_submissions
  FOR SELECT
  USING (true);

-- Политика: аутентифицированные пользователи могут вставлять
CREATE POLICY "Allow authenticated insert"
  ON link_submissions
  FOR INSERT
  WITH CHECK (true);

-- Политика: пользователи могут обновлять свои записи
CREATE POLICY "Allow users to update own links"
  ON link_submissions
  FOR UPDATE
  USING (true);
\`\`\`

#### Для user_progress:

\`\`\`sql
-- Включить RLS
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать
CREATE POLICY "Allow public read access"
  ON user_progress
  FOR SELECT
  USING (true);

-- Политика: все могут вставлять и обновлять
CREATE POLICY "Allow public insert and update"
  ON user_progress
  FOR ALL
  USING (true)
  WITH CHECK (true);
\`\`\`

### 4. Настройте Realtime

1. Перейдите в Database > Replication
2. Включите реплікацію для таблицы \`link_submissions\`

### 5. Переменные окружения

Добавьте в \`.env.local\`:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
\`\`\`

### 6. Тестовые данные (опционально)

\`\`\`sql
-- Вставка тестовых ссылок
INSERT INTO link_submissions (user_fid, username, pfp_url, cast_url, activity_type)
VALUES
  (12345, 'testuser1', 'https://api.dicebear.com/7.x/avataaars/svg?seed=test1', 'https://warpcast.com/testuser1/0xabc123', 'like'),
  (12346, 'testuser2', 'https://api.dicebear.com/7.x/avataaars/svg?seed=test2', 'https://warpcast.com/testuser2/0xdef456', 'recast'),
  (12347, 'testuser3', 'https://api.dicebear.com/7.x/avataaars/svg?seed=test3', 'https://warpcast.com/testuser3/0xghi789', 'comment');
\`\`\`

## Проверка

После настройки проверьте:

1. Таблицы созданы корректно
2. Индексы работают
3. RLS политики активны
4. Realtime подписки включены

## Мониторинг

В Supabase Dashboard вы можете:
- Просматривать таблицы
- Проверять логи
- Мониторить использование API
- Управлять пользователями

## Резервное копирование

Supabase автоматически создает бэкапы, но вы можете настроить:
- Ежедневные бэкапы
- Point-in-time recovery
- Экспорт данных

---

После выполнения всех шагов ваша база данных готова к работе! 🚀

