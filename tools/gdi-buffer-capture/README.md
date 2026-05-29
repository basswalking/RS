# GDI Buffer Capture Prototype

This prototype captures bitmap buffers from the official ON-OFF program before or during GDI drawing.

It hooks:

```text
GDI32!StretchDIBits
GDI32!SetDIBitsToDevice
```

When either function draws a bitmap near `640x480`, the hook saves:

```text
C:\tmp\onoff-gdi-buffer\*.raw
C:\tmp\onoff-gdi-buffer\*.json
```

The `.raw` file is the exact `lpBits` memory passed to GDI. The `.json` file records width, height, bit depth, compression, stride, and call site.

For the official ON-OFF program, the captured input frames have so far appeared as `640x480`, `8bpp`, `BI_RGB`, `307200` byte DIBs. A positive DIB height means the raw rows are bottom-up; flip vertically when converting the buffer for normal viewing.

## Requirements

Install Frida CLI on Windows:

```powershell
py -m pip install frida-tools
```

If Python is not installed, install Python 3 first or use another Frida installation method.

Check:

```powershell
frida --version
```

## Usage

1. Start the official ON-OFF program.
2. Start camera playback in the official program.
3. From this repo:

```powershell
cd "C:\睿视\项目\ON-OFF"
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\gdi-buffer-capture\run-capture.ps1
```

For a custom process filter:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\gdi-buffer-capture\run-capture.ps1 -ProcessNameRegex "ON OFF analysis"
```

Leave it running for a few seconds, then press `Ctrl+C`.

## How To Interpret Results

- If the captured `640x480` input buffer is smooth, but the window screenshot is dotted, then the dot pattern is a display artifact after the buffer.
- If the captured buffer already has the dot pattern, then the official program's drawing/input pipeline is generating that pattern before the final screen blit.
- If only red/blue overlay buffers appear, we need to add another hook around `CreateDIBSection` / `BitBlt` to trace memory DC contents.

This is an investigative tool, not production capture code.
