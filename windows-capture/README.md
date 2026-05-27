# Windows DirectShow Y800 Capture

This folder contains the first calibration tool for matching the official ON-OFF software input path.

The goal is to capture one raw frame from the same Windows camera pipeline used by the official program:

```text
640 x 480
8-bit monochrome Y800 / gray
307200 bytes
```

## Quick Start

Install FFmpeg on Windows and make sure `ffmpeg.exe` is available in PowerShell:

```powershell
ffmpeg -version
```

List camera devices:

```powershell
.\capture-y800.ps1 -ListDevices
```

List supported formats for a camera:

```powershell
.\capture-y800.ps1 -DeviceName "HP True Vision FHD Camera" -ListOptions
```

Capture one raw Y800 frame and a PNG preview:

```powershell
.\capture-y800.ps1 -DeviceName "HP True Vision FHD Camera"
```

If the camera does not expose `gray` / `Y800`, use the closest uncompressed format shown by `-ListOptions`. For example, many laptop cameras expose `yuyv422`:

```powershell
.\capture-y800.ps1 -DeviceName "HP True Vision FHD Camera" -InputPixelFormat yuyv422
```

This still writes an 8-bit gray raw file for the analyzer; FFmpeg extracts the luminance channel during conversion.

If the official program is configured to `MJPG (640x480)`, match that compressed camera path instead:

```powershell
.\capture-y800.ps1 -DeviceName "HP True Vision FHD Camera" -InputCodec mjpeg
```

This decodes the MJPEG frame and then writes the same 640x480 8-bit gray raw file for the analyzer.

Outputs are written to `captures\` by default:

```text
captures\frame_640x480_y800.raw
captures\frame_640x480_y800.png
```

The `.raw` file must be exactly `307200` bytes. Import that file in `index.html` using the same file picker as normal images.

## Why This Tool Exists

The browser version uses `getUserMedia()` and canvas RGB-to-grayscale conversion. The official program uses Windows DirectShow and requests `monochrome Y800, 640x480`. That input pipeline can change exposure, gamma, contrast, sharpening, and scaling before the ON/OFF algorithm sees the frame.

Capturing the raw DirectShow frame lets us separate two questions:

1. Does the JavaScript implementation match the official algorithm for the same input bytes?
2. How different is the browser camera input from the official DirectShow input?

## If Capture Fails

Run `-ListOptions` and check whether the device exposes a 640x480 monochrome/gray/Y800 format. Some laptop cameras expose only MJPEG, YUY2, NV12, or RGB formats. In that case, keep the listed output and use it to build a device-specific C# DirectShow capture path next.
