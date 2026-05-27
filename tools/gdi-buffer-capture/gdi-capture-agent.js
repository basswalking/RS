"use strict";

const TARGET_WIDTH = 640;
const TARGET_HEIGHT = 480;
const SIZE_TOLERANCE = 8;
const MAX_CAPTURES = 80;
const OUTPUT_DIR = "C:\\睿视\\项目\\ON-OFF\\captures\\gdi-buffer";

let captureCount = 0;

function sanitizeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function pad(value, width) {
  return String(value).padStart(width, "0");
}

function nowStamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1, 2),
    pad(d.getDate(), 2),
    "-",
    pad(d.getHours(), 2),
    pad(d.getMinutes(), 2),
    pad(d.getSeconds(), 2),
    "-",
    pad(d.getMilliseconds(), 3),
  ].join("");
}

function readBitmapInfoHeader(pBitmapInfo) {
  if (pBitmapInfo.isNull()) return null;

  const biSize = pBitmapInfo.readS32();
  if (biSize < 40) return null;

  return {
    biSize,
    width: pBitmapInfo.add(4).readS32(),
    height: pBitmapInfo.add(8).readS32(),
    planes: pBitmapInfo.add(12).readU16(),
    bitCount: pBitmapInfo.add(14).readU16(),
    compression: pBitmapInfo.add(16).readU32(),
    sizeImage: pBitmapInfo.add(20).readU32(),
    xPelsPerMeter: pBitmapInfo.add(24).readS32(),
    yPelsPerMeter: pBitmapInfo.add(28).readS32(),
    clrUsed: pBitmapInfo.add(32).readU32(),
    clrImportant: pBitmapInfo.add(36).readU32(),
  };
}

function strideBytes(width, bitCount) {
  return Math.floor((width * bitCount + 31) / 32) * 4;
}

function bufferBytes(header, srcWidth, srcHeight) {
  const width = Math.abs(header.width || srcWidth);
  const height = Math.abs(header.height || srcHeight);
  if (!width || !height || !header.bitCount) return 0;
  if (header.sizeImage) return header.sizeImage;
  return strideBytes(width, header.bitCount) * height;
}

function isInteresting(header, srcWidth, srcHeight, destWidth, destHeight) {
  const candidates = [
    [Math.abs(header.width), Math.abs(header.height)],
    [Math.abs(srcWidth), Math.abs(srcHeight)],
    [Math.abs(destWidth), Math.abs(destHeight)],
  ];

  return candidates.some(([w, h]) =>
    Math.abs(w - TARGET_WIDTH) <= SIZE_TOLERANCE &&
    Math.abs(h - TARGET_HEIGHT) <= SIZE_TOLERANCE
  );
}

function saveBytes(path, bytes) {
  const file = new File(path, "wb");
  file.write(bytes);
  file.flush();
  file.close();
}

function saveText(path, text) {
  const file = new File(path, "w");
  file.write(text);
  file.flush();
  file.close();
}

function captureBits(apiName, lpBits, lpbmi, srcWidth, srcHeight, destWidth, destHeight) {
  if (captureCount >= MAX_CAPTURES || lpBits.isNull()) return;

  const header = readBitmapInfoHeader(lpbmi);
  if (!header) return;
  if (!isInteresting(header, srcWidth, srcHeight, destWidth, destHeight)) return;

  const byteCount = bufferBytes(header, srcWidth, srcHeight);
  if (byteCount <= 0 || byteCount > 32 * 1024 * 1024) return;

  const bytes = lpBits.readByteArray(byteCount);
  if (!bytes) return;

  captureCount += 1;
  const prefix = `${nowStamp()}-${pad(captureCount, 3)}-${sanitizeName(apiName)}-${Math.abs(header.width)}x${Math.abs(header.height)}-${header.bitCount}bpp`;
  const rawPath = `${OUTPUT_DIR}\\${prefix}.raw`;
  const metaPath = `${OUTPUT_DIR}\\${prefix}.json`;

  const meta = {
    apiName,
    captureCount,
    rawPath,
    byteCount,
    srcWidth,
    srcHeight,
    destWidth,
    destHeight,
    header,
    strideBytes: strideBytes(Math.abs(header.width || srcWidth), header.bitCount),
    timestamp: new Date().toISOString(),
  };

  saveBytes(rawPath, bytes);
  saveText(metaPath, JSON.stringify(meta, null, 2));
  send({ type: "capture", meta });
}

function hookStretchDIBits() {
  const address = Module.findExportByName("gdi32.dll", "StretchDIBits");
  if (!address) return;

  Interceptor.attach(address, {
    onEnter(args) {
      const destWidth = args[3].toInt32();
      const destHeight = args[4].toInt32();
      const srcWidth = args[7].toInt32();
      const srcHeight = args[8].toInt32();
      const lpBits = args[9];
      const lpbmi = args[10];
      captureBits("StretchDIBits", lpBits, lpbmi, srcWidth, srcHeight, destWidth, destHeight);
    },
  });
}

function hookSetDIBitsToDevice() {
  const address = Module.findExportByName("gdi32.dll", "SetDIBitsToDevice");
  if (!address) return;

  Interceptor.attach(address, {
    onEnter(args) {
      const destWidth = args[3].toInt32();
      const destHeight = args[4].toInt32();
      const srcWidth = destWidth;
      const srcHeight = args[8].toInt32();
      const lpBits = args[9];
      const lpbmi = args[10];
      captureBits("SetDIBitsToDevice", lpBits, lpbmi, srcWidth, srcHeight, destWidth, destHeight);
    },
  });
}

hookStretchDIBits();
hookSetDIBitsToDevice();

send({
  type: "ready",
  outputDir: OUTPUT_DIR,
  target: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
  maxCaptures: MAX_CAPTURES,
});
