param(
  [string]$TitleRegex = "ON-OFF|ON OFF|Schaeffel",
  [string]$OutputDir = ".\captures\official-window",
  [int]$CropX = 0,
  [int]$CropY = 0,
  [int]$CropWidth = 640,
  [int]$CropHeight = 480
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeWindowCapture {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [DllImport("user32.dll")]
  public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
}
"@

function Resolve-OutputPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path (Get-Location) $Path
}

function Save-GrayscaleRaw {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $bytes = New-Object byte[] ($Bitmap.Width * $Bitmap.Height)
  $i = 0
  for ($y = 0; $y -lt $Bitmap.Height; $y += 1) {
    for ($x = 0; $x -lt $Bitmap.Width; $x += 1) {
      $p = $Bitmap.GetPixel($x, $y)
      $bytes[$i] = [byte][Math]::Round((0.299 * $p.R) + (0.587 * $p.G) + (0.114 * $p.B))
      $i += 1
    }
  }

  [System.IO.File]::WriteAllBytes($Path, $bytes)
}

$process = Get-Process |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match $TitleRegex } |
  Select-Object -First 1

if (-not $process) {
  throw "No visible window matched TitleRegex '$TitleRegex'. Open the official ON-OFF program first, then try again."
}

$rect = New-Object NativeWindowCapture+RECT
if (-not [NativeWindowCapture]::GetClientRect($process.MainWindowHandle, [ref]$rect)) {
  throw "GetClientRect failed for window '$($process.MainWindowTitle)'."
}

$origin = New-Object NativeWindowCapture+POINT
$origin.X = 0
$origin.Y = 0
if (-not [NativeWindowCapture]::ClientToScreen($process.MainWindowHandle, [ref]$origin)) {
  throw "ClientToScreen failed for window '$($process.MainWindowTitle)'."
}

$clientWidth = $rect.Right - $rect.Left
$clientHeight = $rect.Bottom - $rect.Top
if ($CropX + $CropWidth -gt $clientWidth -or $CropY + $CropHeight -gt $clientHeight) {
  throw "Crop ${CropWidth}x${CropHeight}+${CropX}+${CropY} exceeds client area ${clientWidth}x${clientHeight}."
}

$resolvedOutputDir = Resolve-OutputPath $OutputDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$clientPng = Join-Path $resolvedOutputDir "official-client-$stamp.png"
$inputPng = Join-Path $resolvedOutputDir "official-input-640x480-$stamp.png"
$inputRaw = Join-Path $resolvedOutputDir "official-input-640x480-$stamp.raw"

$clientBitmap = New-Object System.Drawing.Bitmap $clientWidth, $clientHeight
$graphics = [System.Drawing.Graphics]::FromImage($clientBitmap)
$graphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, $clientBitmap.Size)
$graphics.Dispose()
$clientBitmap.Save($clientPng, [System.Drawing.Imaging.ImageFormat]::Png)

$cropRect = New-Object System.Drawing.Rectangle $CropX, $CropY, $CropWidth, $CropHeight
$inputBitmap = $clientBitmap.Clone($cropRect, $clientBitmap.PixelFormat)
$inputBitmap.Save($inputPng, [System.Drawing.Imaging.ImageFormat]::Png)
Save-GrayscaleRaw -Bitmap $inputBitmap -Path $inputRaw

$inputBitmap.Dispose()
$clientBitmap.Dispose()

Write-Host "Matched window: $($process.MainWindowTitle)"
Write-Host "Client capture: $clientPng"
Write-Host "Input crop PNG: $inputPng"
Write-Host "Input crop RAW: $inputRaw"
Write-Host "Raw byte count: $((Get-Item -LiteralPath $inputRaw).Length)"
