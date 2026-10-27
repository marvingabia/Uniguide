# PowerShell script to update Google Callback URL on Vercel
# This script attempts to automate the update using vercel CLI

$newUrl = "https://uniguide-ekqoto5st-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback"

Write-Host "Updating GOOGLE_CALLBACK_URL on Vercel..." -ForegroundColor Cyan
Write-Host "New URL: $newUrl" -ForegroundColor Yellow
Write-Host ""

# Method 1: Try using stdin
Write-Host "Attempting automated update..." -ForegroundColor Gray

$process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "echo $newUrl | vercel env update GOOGLE_CALLBACK_URL production" -NoNewWindow -PassThru -Wait

if ($process.ExitCode -eq 0) {
    Write-Host "✅ Update successful!" -ForegroundColor Green
    Write-Host "Vercel will automatically redeploy with the new callback URL."
} else {
    Write-Host "⚠️  Automated update failed or requires manual confirmation" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual fix instructions:" -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────────────────────"
    Write-Host "1. Open: https://vercel.com/marvingabia5-gmailcoms-projects/uniguide"
    Write-Host "2. Go to: Settings > Environment Variables"
    Write-Host "3. Find: GOOGLE_CALLBACK_URL (from 53 days ago)"
    Write-Host "4. Click the three dots menu and select: Edit"
    Write-Host "5. Change the value to:"
    Write-Host "   $newUrl"
    Write-Host "6. Click: Save"
    Write-Host "7. Vercel will automatically redeploy"
    Write-Host "─────────────────────────────────────────────────────────"
}
