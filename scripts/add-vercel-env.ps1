# PowerShell скрипт для добавления переменной окружения в Vercel
$contractAddress = "0x3FD7a1D5C9C3163E873Df212006cB81D7178f3b4"
$varName = "NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS"

Write-Host "🚀 Adding Vercel environment variable..." -ForegroundColor Green
Write-Host "Variable: $varName" -ForegroundColor Cyan
Write-Host "Value: $contractAddress" -ForegroundColor Cyan
Write-Host ""

# Добавляем для каждого окружения
$environments = @("production", "preview", "development")

foreach ($env in $environments) {
    Write-Host "📝 Adding for $env..." -ForegroundColor Yellow
    
    # Используем echo для передачи значения через pipe
    $contractAddress | vercel env add $varName $env
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Added for $env" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Failed for $env (may already exist)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "🎉 Done! Check Vercel dashboard to verify." -ForegroundColor Green



