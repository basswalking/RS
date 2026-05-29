param(
  [string]$ProcessNameRegex = "ON OFF analysis visual world",
  [string]$OutputDir = "C:\tmp\onoff-gdi-buffer"
)

$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path (Get-Location) $Path
}

$frida = Get-Command frida -ErrorAction SilentlyContinue
if (-not $frida) {
  throw "frida was not found. Install it with: py -m pip install frida-tools"
}

$process = Get-Process |
  Where-Object {
    ($_.ProcessName -match $ProcessNameRegex -or $_.MainWindowTitle -match $ProcessNameRegex)
  } |
  Select-Object -First 1

if (-not $process) {
  throw "No process matched '$ProcessNameRegex'. Start the official ON-OFF program first."
}

$resolvedOutputDir = Resolve-RepoPath $OutputDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$agentPath = Join-Path $PSScriptRoot "gdi-capture-agent.js"

Write-Host "Attaching to PID $($process.Id): $($process.ProcessName)"
Write-Host "Window: $($process.MainWindowTitle)"
Write-Host "Output: $resolvedOutputDir"
Write-Host "Press Ctrl+C after enough frames have been captured."

& $frida.Source -p $process.Id -l $agentPath
