# PowerShell скрипт для принудительного redeploy без кеша через Vercel CLI

Write-Host "🔨 Starting force redeploy without cache..." -ForegroundColor Cyan

# Проверяем, установлен ли Vercel CLI
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

# Проверяем авторизацию
Write-Host "🔍 Checking Vercel authentication..." -ForegroundColor Cyan
$whoami = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Not logged in. Please run: vercel login" -ForegroundColor Yellow
    Write-Host "   Or do it manually via Vercel Dashboard:" -ForegroundColor Yellow
    Write-Host "   1. Go to Deployments" -ForegroundColor Yellow
    Write-Host "   2. Click three dots (⋯) on latest deployment" -ForegroundColor Yellow
    Write-Host "   3. Select 'Redeploy'" -ForegroundColor Yellow
    Write-Host "   4. DISABLE 'Use existing Build Cache'" -ForegroundColor Yellow
    Write-Host "   5. Click 'Redeploy'" -ForegroundColor Yellow
    exit 1
}

# Очищаем build cache (через env pull с force)
Write-Host "🧹 Clearing build cache..." -ForegroundColor Cyan
vercel env pull --force 2>&1 | Out-Null

# Делаем redeploy без кеша
Write-Host "🚀 Redeploying without cache..." -ForegroundColor Cyan
$deploy = vercel --prod --force 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Redeploy failed. Please do it manually via Vercel Dashboard:" -ForegroundColor Red
    Write-Host "   1. Go to https://vercel.com/dashboard" -ForegroundColor Yellow
    Write-Host "   2. Select your project 'likechat-farcaster'" -ForegroundColor Yellow
    Write-Host "   3. Go to Deployments tab" -ForegroundColor Yellow
    Write-Host "   4. Click three dots (⋯) on latest deployment" -ForegroundColor Yellow
    Write-Host "   5. Select 'Redeploy'" -ForegroundColor Yellow
    Write-Host "   6. DISABLE 'Use existing Build Cache' checkbox" -ForegroundColor Yellow
    Write-Host "   7. Click 'Redeploy' button" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Redeploy completed!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Wait for deployment to finish (check Vercel Dashboard)" -ForegroundColor White
Write-Host "   2. Open your site in browser" -ForegroundColor White
Write-Host "   3. Open DevTools (F12) → Console" -ForegroundColor White
Write-Host "   4. Look for: 🔍🔍🔍 [_DOCUMENT] Modal removal script loaded" -ForegroundColor White
Write-Host "   5. If you see that log, the new build is loading correctly!" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Check deployment status: https://vercel.com/dashboard" -ForegroundColor Cyan

