param(
  [string]$DeviceName = "",
  [string]$VideoSize = "640x480",
  [string]$InputPixelFormat = "gray",
  [string]$InputCodec = "",
  [string]$OutputDir = "..\captures",
  [string]$FFmpegPath = "ffmpeg",
  [switch]$ListDevices,
  [switch]$ListOptions
)

$ErrorActionPreference = "Stop"

function Require-FFmpeg {
  $cmd = Get-Command $FFmpegPath -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "ffmpeg.exe was not found. Install FFmpeg or pass -FFmpegPath with the full path to ffmpeg.exe."
  }

  return $cmd.Source
}

function Resolve-OutputPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path $PSScriptRoot $Path
}

$ffmpeg = Require-FFmpeg

if ($ListDevices) {
  & $ffmpeg -hide_banner -f dshow -list_devices true -i dummy
  exit $LASTEXITCODE
}

if ([string]::IsNullOrWhiteSpace($DeviceName)) {
  throw "Pass -DeviceName or use -ListDevices first."
}

if ($ListOptions) {
  & $ffmpeg -hide_banner -f dshow -list_options true -i "video=$DeviceName"
  exit $LASTEXITCODE
}

$resolvedOutputDir = Resolve-OutputPath $OutputDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$rawPath = Join-Path $resolvedOutputDir "frame_640x480_y800.raw"
$pngPath = Join-Path $resolvedOutputDir "frame_640x480_y800.png"

if (Test-Path $rawPath) {
  Remove-Item -LiteralPath $rawPath -Force
}

if (Test-Path $pngPath) {
  Remove-Item -LiteralPath $pngPath -Force
}

$captureArgs = @(
  "-hide_banner",
  "-rtbufsize", "100M",
  "-analyzeduration", "100M",
  "-probesize", "100M",
  "-f", "dshow",
  "-video_size", $VideoSize
)

if (-not [string]::IsNullOrWhiteSpace($InputCodec)) {
  $captureArgs += @("-vcodec", $InputCodec)
} else {
  $captureArgs += @("-pixel_format", $InputPixelFormat)
}

$captureArgs += @(
  "-i", "video=$DeviceName",
  "-frames:v", "1",
  "-f", "rawvideo",
  "-pix_fmt", "gray",
  $rawPath
)

& $ffmpeg @captureArgs

if ($LASTEXITCODE -ne 0) {
  throw "FFmpeg capture failed. Run this script again with -ListOptions and check whether the camera exposes $VideoSize gray/Y800."
}

$rawBytes = (Get-Item -LiteralPath $rawPath).Length
if ($rawBytes -ne 307200) {
  throw "Unexpected raw frame size: $rawBytes bytes. Expected 307200 bytes for 640x480 Y800."
}

& $ffmpeg `
  -hide_banner `
  -f rawvideo `
  -pixel_format gray `
  -video_size $VideoSize `
  -i $rawPath `
  -frames:v 1 `
  -update true `
  $pngPath

if ($LASTEXITCODE -ne 0) {
  throw "PNG preview generation failed, but the raw capture may still exist at $rawPath."
}

Write-Host "Captured raw frame: $rawPath"
Write-Host "Preview image:       $pngPath"
Write-Host "Raw byte count:      $rawBytes"
