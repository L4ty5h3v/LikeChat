# Setup script for flirt project
Write-Host "Setting up flirt project..." -ForegroundColor Green

# Step 1: Copy project1 to ../flirt
Write-Host "`nStep 1: Copying project1 to ../flirt..." -ForegroundColor Yellow
if (Test-Path "..\flirt") {
    Remove-Item "..\flirt" -Recurse -Force
}
Copy-Item -Path "project1" -Destination "..\flirt" -Recurse -Force
Write-Host "✓ Copied!" -ForegroundColor Green

# Step 2: Initialize git
Write-Host "`nStep 2: Initializing git..." -ForegroundColor Yellow
Set-Location "..\flirt"
git init
git add .
git commit -m "Initial commit: Mrs. Crypto Flirting Tips - Farcaster Frame Quiz"
Write-Host "✓ Git initialized!" -ForegroundColor Green

# Step 3: Create GitHub repository
Write-Host "`nStep 3: Creating GitHub repository..." -ForegroundColor Yellow
$token = $env:GITHUB_TOKEN
$headers = @{
    'Authorization' = "Bearer $token"
    'Accept' = 'application/vnd.github.v3+json'
    'Content-Type' = 'application/json'
}
$body = @{
    name = 'flirt'
    description = 'Mrs. Crypto Flirting Tips - Farcaster Frame Quiz'
    private = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body
    Write-Host "✓ Repository created: $($response.html_url)" -ForegroundColor Green
    
    # Step 4: Push to GitHub
    Write-Host "`nStep 4: Pushing to GitHub..." -ForegroundColor Yellow
    git remote add origin $response.clone_url
    git branch -M main
    git push -u origin main
    Write-Host "✓ Pushed to GitHub!" -ForegroundColor Green
    Write-Host "`n✅ Done! Repository: $($response.html_url)" -ForegroundColor Green
} catch {
    Write-Host "✗ Error creating repository: $_" -ForegroundColor Red
    Write-Host "`nPlease create repository manually at: https://github.com/new" -ForegroundColor Yellow
    Write-Host "Name: flirt" -ForegroundColor Yellow
    Write-Host "Then run: git remote add origin https://github.com/L4ty5h3v/flirt.git" -ForegroundColor Yellow
    Write-Host "And: git push -u origin main" -ForegroundColor Yellow
}

Set-Location "..\likechat-farcaster"

















