#!/bin/bash
# Скрипт для принудительного redeploy без кеша через Vercel CLI

echo "🔨 Starting force redeploy without cache..."

# Проверяем, установлен ли Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Проверяем авторизацию
echo "🔍 Checking Vercel authentication..."
vercel whoami || {
    echo "⚠️ Not logged in. Please run: vercel login"
    exit 1
}

# Очищаем build cache
echo "🧹 Clearing build cache..."
vercel env pull --force || echo "⚠️ Could not clear cache via CLI"

# Делаем redeploy без кеша
echo "🚀 Redeploying without cache..."
vercel --prod --force || {
    echo "❌ Redeploy failed. Please do it manually via Vercel Dashboard:"
    echo "   1. Go to Deployments"
    echo "   2. Click three dots (⋯) on latest deployment"
    echo "   3. Select 'Redeploy'"
    echo "   4. DISABLE 'Use existing Build Cache'"
    echo "   5. Click 'Redeploy'"
    exit 1
}

echo "✅ Redeploy completed!"
echo "📋 Next steps:"
echo "   1. Wait for deployment to finish"
echo "   2. Open your site in browser"
echo "   3. Open DevTools (F12) → Console"
echo "   4. Look for: 🔍🔍🔍 [_DOCUMENT] Modal removal script loaded"
echo "   5. If you see that log, the new build is loading correctly!"

