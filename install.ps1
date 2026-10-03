# Install or update Tweensy on Windows.
#
#   irm https://raw.githubusercontent.com/TravisSaper/tweensy/main/install.ps1 | iex
#
# Run it again any time to update. Options (set before running):
#   $env:TWEENSY_VERSION = "v2.7.0"   install that release instead of the latest
#   $env:TWEENSY_NO_START = "1"       don't start Tweensy after installing
#   $env:TWEENSY_PORT = "9000"       serve on this port instead of 8765 (saved for later runs)
#   $env:TWEENSY_INSTALL_DIR          where tweensy.exe goes (default: %LOCALAPPDATA%\Programs\Tweensy)
# Your projects live in %USERPROFILE%\Tweensy and are never touched by installing or updating.

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # the progress bar makes downloads much slower in PowerShell 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$repo = "TravisSaper/tweensy"
$dir = if ($env:TWEENSY_INSTALL_DIR) { $env:TWEENSY_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\Tweensy" }
$exe = Join-Path $dir "tweensy.exe"

if (-not [Environment]::Is64BitOperatingSystem) {
    throw "Tweensy needs 64-bit Windows."
}

$port = 0
if ($env:TWEENSY_PORT -and (-not [int]::TryParse($env:TWEENSY_PORT, [ref]$port) -or $port -lt 1024 -or $port -gt 65535)) {
    throw "TWEENSY_PORT must be a number from 1024 to 65535, like 9000."
}

$tag = $env:TWEENSY_VERSION
if (-not $tag) {
    $tag = (Invoke-RestMethod -UseBasicParsing "https://api.github.com/repos/$repo/releases/latest").tag_name
}
$asset = "Tweensy-windows-$tag.exe"
Write-Host ""
Write-Host "  Installing Tweensy $tag for Windows"

New-Item -ItemType Directory -Force -Path $dir | Out-Null
# An open Tweensy keeps its .exe locked, so close it before replacing the file.
Get-Process -Name tweensy -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } | Stop-Process -Force
$tmp = "$exe.download"
Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$repo/releases/download/$tag/$asset" -OutFile $tmp
Move-Item -Force $tmp $exe
Write-Host "  Installed: $exe"

# Add the folder to your PATH so `tweensy` works in any new terminal.
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }
if (-not (($userPath -split ";") -contains $dir)) {
    [Environment]::SetEnvironmentVariable("Path", (($userPath.TrimEnd(";"), $dir) -join ";").TrimStart(";"), "User")
    Write-Host "  Added $dir to your PATH (open a new terminal for the 'tweensy' command)."
}

# A Start menu shortcut, so it opens like any other app.
$shortcut = Join-Path ([Environment]::GetFolderPath("Programs")) "Tweensy.lnk"
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut)
$link.TargetPath = $exe
$link.WorkingDirectory = $env:USERPROFILE
$link.Description = "Tweensy: motion graphics for anyone"
$link.Save()
Write-Host "  Start menu: Tweensy"

if ($env:TWEENSY_PORT) {
    $data = Join-Path $env:USERPROFILE "Tweensy"
    New-Item -ItemType Directory -Force -Path $data | Out-Null
    Set-Content -Path (Join-Path $data "settings.json") -Value "{`"port`": $port}" -Encoding ASCII
    Write-Host "  Port: $port (change it later in Settings, or with: tweensy --port 9000)"
}

Write-Host ""
Write-Host "  Done. Open Tweensy from the Start menu or by typing: tweensy"
Write-Host "  Run this installer again to update. Your projects are in $env:USERPROFILE\Tweensy."
if (-not $env:TWEENSY_NO_START) {
    Write-Host ""
    Write-Host "  Starting Tweensy..."
    Start-Process -FilePath $exe -WorkingDirectory $env:USERPROFILE
}
