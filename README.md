# ЛайкЧат: Взаимная любовь от Миссис Крипто 💌

Мини-приложение для Farcaster, реализующее систему очереди взаимной активности.

## 🎯 Описание

ЛайкЧат — это платформа взаимной поддержки для сообщества Farcaster. Пользователи проходят 10 последних ссылок других участников, выполняя выбранную активность (лайк, реккаст, комментарий), затем покупают токен Миссис Крипто на $0.10, чтобы опубликовать свою ссылку.

## ✨ Особенности

- 🔐 **Авторизация через Farcaster wallet (Web3)**
- ❤️ **Выбор активности**: Лайк, Рекаст или Комментарий
- 📋 **Система заданий**: Прохождение 10 последних ссылок (FIFO)
- ✅ **Проверка активности** через Neynar API
- 💎 **Покупка токена** Миссис Крипто ($0.10)
- 🚀 **Публикация ссылки** после выполнения всех условий
- 💬 **Лента активности** в реальном времени
- 🎨 **Минималистичный UI** с кастомными цветами

## 🛠 Технологии

- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **API**: Neynar API для Farcaster
- **Blockchain**: Ethers.js для Web3 интеграции
- **Real-time**: Supabase Realtime subscriptions

## 🚀 Установка

1. **Клонируйте репозиторий**:
\`\`\`bash
git clone <repository-url>
cd likechat-farcaster
\`\`\`

2. **Установите зависимости**:
\`\`\`bash
npm install
\`\`\`

3. **Настройте переменные окружения**:

Создайте файл \`.env.local\` на основе \`.env.example\`:

\`\`\`env
NEXT_PUBLIC_NEYNAR_API_KEY=your_neynar_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=your_token_contract_address_here
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_TOKEN_PRICE_USD=0.1
\`\`\`

4. **Настройте базу данных Supabase**:

Создайте следующие таблицы:

\`\`\`sql
-- Таблица ссылок
CREATE TABLE link_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_fid BIGINT NOT NULL,
  username TEXT NOT NULL,
  pfp_url TEXT,
  cast_url TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  completed_by BIGINT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица прогресса пользователей
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_fid BIGINT UNIQUE NOT NULL,
  completed_links UUID[] DEFAULT '{}',
  token_purchased BOOLEAN DEFAULT FALSE,
  selected_activity TEXT,
  current_link_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_link_submissions_created_at ON link_submissions(created_at);
CREATE INDEX idx_user_progress_fid ON user_progress(user_fid);
\`\`\`

5. **Запустите проект**:
\`\`\`bash
npm run dev
\`\`\`

Приложение будет доступно по адресу: http://localhost:3000

## 📁 Структура проекта

\`\`\`
likechat-farcaster/
├── components/          # React компоненты
│   ├── Layout.tsx
│   ├── ActivityButton.tsx
│   ├── TaskCard.tsx
│   ├── ProgressBar.tsx
│   ├── LinkCard.tsx
│   └── Button.tsx
├── lib/                # Библиотеки и утилиты
│   ├── neynar.ts       # Работа с Neynar API
│   ├── db.ts           # Работа с Supabase
│   └── web3.ts         # Web3 функции
├── pages/              # Страницы Next.js
│   ├── index.tsx       # Авторизация и выбор активности
│   ├── tasks.tsx       # Список заданий
│   ├── buyToken.tsx    # Покупка токена
│   ├── submit.tsx      # Публикация ссылки
│   ├── chat.tsx        # Лента ссылок
│   └── _app.tsx        # Root компонент
├── styles/             # Глобальные стили
│   └── globals.css
├── types/              # TypeScript типы
│   └── index.ts
└── public/             # Статические файлы
\`\`\`

## 🎨 Цветовая схема

- **Малиновый (#D61C4E)**: Активные элементы, кнопки
- **Зелёный (#28A745)**: Подтверждения, успех
- **Жёлтый (#FFC107)**: Предупреждения
- **Белый (#FFFFFF)**: Фон

## 🔄 Логика работы

1. **Авторизация**: Пользователь подключает Farcaster wallet
2. **Выбор активности**: Лайк, Рекаст или Комментарий
3. **Прохождение заданий**: 10 последних ссылок (FIFO)
4. **Проверка**: Через Neynar API
5. **Покупка токена**: $0.10 через Web3
6. **Публикация**: Ссылка добавляется в очередь

## 📱 Страницы

- **/** - Авторизация и выбор активности
- **/tasks** - Список из 10 заданий
- **/buyToken** - Покупка токена Миссис Крипто
- **/submit** - Форма публикации ссылки
- **/chat** - Лента всех ссылок

## 🔧 API Endpoints (Neynar)

- \`GET /v2/farcaster/reactions\` - Получение лайков и реккастов
- \`GET /v2/farcaster/casts\` - Получение комментариев
- \`GET /v2/farcaster/user/bulk\` - Информация о пользователе

## 🌐 Развертывание

### Vercel (рекомендуется)

1. Импортируйте проект в Vercel
2. Добавьте переменные окружения
3. Deploy!

### Другие платформы

Проект совместим с любой платформой, поддерживающей Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

## 🤝 Участие в разработке

Мы приветствуем вклад в проект! Пожалуйста:

1. Fork репозиторий
2. Создайте feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit изменения (\`git commit -m 'Add some AmazingFeature'\`)
4. Push в branch (\`git push origin feature/AmazingFeature\`)
5. Откройте Pull Request

## 📝 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🙏 Благодарности

- Farcaster & Warpcast сообщество
- Neynar API
- Supabase
- Миссис Крипто 💌

## 📞 Контакты

- Twitter: [@mrscrypto](https://twitter.com/mrscrypto)
- Farcaster: [@mrscrypto](https://warpcast.com/mrscrypto)

---

Создано с ❤️ для Farcaster сообщества

