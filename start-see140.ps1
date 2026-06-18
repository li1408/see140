param(
  [int]$Port = 3000,
  [switch]$Clean,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

function Write-Step {
  param([string]$Message)
  Write-Host "[see140] $Message"
}

function Get-NpmPath {
  $command = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $fallback = "E:\Program Files\nodejs\npm.cmd"
  if (Test-Path -LiteralPath $fallback) {
    return $fallback
  }

  throw "Cannot find npm.cmd. Install Node.js or add npm to PATH."
}

function Get-HttpStatus {
  param([string]$Url)

  try {
    return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri $Url).StatusCode
  } catch {
    return $null
  }
}

function Get-ProjectNodeProcesses {
  $escapedRoot = $ProjectRoot.Replace("\", "\\")
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -eq "node.exe" -and
      $_.CommandLine -like "*$ProjectRoot*"
    }
}

function Stop-ProjectNodeProcesses {
  $processes = @(Get-ProjectNodeProcesses)
  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Clear-NextCache {
  $nextPath = Join-Path $ProjectRoot ".next"
  $resolvedProject = Resolve-Path -LiteralPath $ProjectRoot
  $resolvedNext = Resolve-Path -LiteralPath $nextPath -ErrorAction SilentlyContinue

  if ($resolvedNext -and $resolvedNext.Path.StartsWith($resolvedProject.Path, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Step "Clearing Next.js cache..."
    Remove-Item -LiteralPath $resolvedNext.Path -Recurse -Force
  }
}

function Find-AvailablePort {
  param([int]$PreferredPort)

  for ($candidate = $PreferredPort; $candidate -lt ($PreferredPort + 10); $candidate += 1) {
    $listener = Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue
    if (-not $listener) {
      return $candidate
    }
  }

  throw "No available port found from $PreferredPort to $($PreferredPort + 9)."
}

$npmPath = Get-NpmPath
$Url = "http://127.0.0.1:$Port/"

Write-Step "Project: $ProjectRoot"

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules"))) {
  Write-Step "Installing dependencies. This may take a while..."
  Push-Location $ProjectRoot
  try {
    & $npmPath install
  } finally {
    Pop-Location
  }
}

if ($Clean) {
  Stop-ProjectNodeProcesses
  Clear-NextCache
}

$status = Get-HttpStatus $Url
if ($status -eq 200) {
  Write-Step "Already running at $Url"
  if (-not $NoBrowser) {
    Start-Process $Url
  }
  exit 0
}

if ($status -ne $null) {
  Write-Step "Existing dev server returned HTTP $status. Restarting this project..."
  Stop-ProjectNodeProcesses
  Start-Sleep -Seconds 2
  Clear-NextCache
} else {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    $projectProcesses = @(Get-ProjectNodeProcesses)
    if ($projectProcesses.Count -gt 0) {
      Write-Step "Restarting stale project process on port $Port..."
      Stop-ProjectNodeProcesses
      Start-Sleep -Seconds 2
    } else {
      $Port = Find-AvailablePort $Port
      $Url = "http://127.0.0.1:$Port/"
      Write-Step "Port 3000 is busy. Using $Port instead."
    }
  }
}

$escapedRoot = $ProjectRoot.Replace("'", "''")
$escapedNpm = $npmPath.Replace("'", "''")
$serverCommand = "& { Set-Location -LiteralPath '$escapedRoot'; & '$escapedNpm' run dev -- --hostname 127.0.0.1 --port $Port }"

Write-Step "Starting server window..."
Start-Process -FilePath "powershell.exe" -WorkingDirectory $ProjectRoot -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  $serverCommand
) | Out-Null

Write-Step "Waiting for $Url"
$ready = $false
for ($i = 0; $i -lt 45; $i += 1) {
  Start-Sleep -Seconds 1
  if ((Get-HttpStatus $Url) -eq 200) {
    $ready = $true
    break
  }
}

if ($ready) {
  Write-Step "Ready: $Url"
  if (-not $NoBrowser) {
    Start-Process $Url
  }
} else {
  Write-Step "Server is still starting. Open this URL manually after the server window says Ready: $Url"
}
