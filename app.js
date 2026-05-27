const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 480;
const RAW_FRAME_BYTES = FRAME_WIDTH * FRAME_HEIGHT;
const MAX_RADIUS = 10;
const ANALYSIS_MARGIN = 10;
const AVERAGE_MARGIN = 20;
const AVERAGE_STEP = 20;
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 944;
const DIAGONAL_SCALE = 0.707;
const SPATIAL_FREQUENCIES = [22.4, 11.2, 7.47, 5.6, 4.48, 3.73, 3.2, 2.8, 2.49, 2.24];

const cameraVideo = document.getElementById("cameraVideo");
const sourceCanvas = document.getElementById("sourceCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const responseCanvas = document.getElementById("responseCanvas");
const responseCtx = responseCanvas.getContext("2d", { willReadFrequently: true });
const lineChart = document.getElementById("lineChart");
const lineCtx = lineChart.getContext("2d");
const diffChart = document.getElementById("diffChart");
const diffCtx = diffChart.getContext("2d");

const els = {
  avgPixel: document.getElementById("avgPixel"),
  frameNumber: document.getElementById("frameNumber"),
  frameWidth: document.getElementById("frameWidth"),
  frameHeight: document.getElementById("frameHeight"),
  rfCount: document.getElementById("rfCount"),
  radiusLabel: document.getElementById("radiusLabel"),
  currentOn: document.getElementById("currentOn"),
  currentOff: document.getElementById("currentOff"),
  currentOnCount: document.getElementById("currentOnCount"),
  currentOffCount: document.getElementById("currentOffCount"),
  avgOnTotal: document.getElementById("avgOnTotal"),
  avgOffTotal: document.getElementById("avgOffTotal"),
  verdictMain: document.getElementById("verdictMain"),
  verdictSub: document.getElementById("verdictSub"),
  cameraButton: document.getElementById("cameraButton"),
};

let selectedRadius = 2;
let frameNumber = 0;
let gray = new Uint8ClampedArray(FRAME_WIDTH * FRAME_HEIGHT);
let responseBuffer = new Int32Array(FRAME_WIDTH * FRAME_HEIGHT);
let stats = createEmptyStats();
let hasImage = false;
let cameraStream = null;
let cameraFrameRequest = 0;

function createEmptyStats() {
  return Array.from({ length: MAX_RADIUS }, (_, index) => ({
    radius: index + 1,
    onAverage: 0,
    offAverage: 0,
    onCount: 0,
    offCount: 0,
    diff: 0,
  }));
}

function setup() {
  scaleApp();
  els.frameWidth.textContent = FRAME_WIDTH;
  els.frameHeight.textContent = FRAME_HEIGHT;
  els.rfCount.textContent = (FRAME_WIDTH - 2 * ANALYSIS_MARGIN) * (FRAME_HEIGHT - 2 * ANALYSIS_MARGIN);
  document.getElementById("fileInput").addEventListener("change", handleFile);
  els.cameraButton.addEventListener("click", toggleCamera);
  window.addEventListener("keydown", handleKey);
  window.addEventListener("resize", scaleApp);
  drawPlaceholder();
  drawResponseMap();
  drawCharts();
}

function scaleApp() {
  const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
  document.getElementById("appFrame").style.transform = `scale(${scale})`;
}

function handleFile(event) {
  const [file] = event.target.files;
  if (!file) return;
  stopCamera();

  if (isRawFrame(file)) {
    loadRawFrame(file);
    return;
  }

  const image = new Image();
  image.onload = () => {
    drawImageToFrame(image);
    analyzeFrame();
    URL.revokeObjectURL(image.src);
  };
  image.src = URL.createObjectURL(file);
}

function isRawFrame(file) {
  return file.name.toLowerCase().endsWith(".raw") || file.size === RAW_FRAME_BYTES;
}

async function loadRawFrame(file) {
  if (file.size !== RAW_FRAME_BYTES) {
    alert(`Y800 raw frame must be exactly ${RAW_FRAME_BYTES} bytes for 640x480.`);
    return;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  drawRawFrame(bytes);
  frameNumber += 1;
  hasImage = true;
  analyzeFrame();
}

async function toggleCamera() {
  if (cameraStream) {
    stopCamera();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    els.cameraButton.textContent = "no camera";
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: FRAME_WIDTH },
        height: { ideal: FRAME_HEIGHT },
      },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();
    frameNumber = 0;
    hasImage = true;
    els.cameraButton.textContent = "stop camera";
    runCameraFrame();
  } catch (error) {
    console.error(error);
    els.cameraButton.textContent = "camera error";
  }
}

function stopCamera() {
  if (cameraFrameRequest) {
    cancelAnimationFrame(cameraFrameRequest);
    cameraFrameRequest = 0;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  els.cameraButton.textContent = "start camera";
}

function runCameraFrame() {
  if (!cameraStream) return;
  drawVideoToFrame();
  analyzeFrame();
  cameraFrameRequest = requestAnimationFrame(runCameraFrame);
}

function drawVideoToFrame() {
  const width = cameraVideo.videoWidth || FRAME_WIDTH;
  const height = cameraVideo.videoHeight || FRAME_HEIGHT;
  const crop = centeredAspectCrop(width, height, FRAME_WIDTH / FRAME_HEIGHT);
  sourceCtx.save();
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.fillStyle = "#000";
  sourceCtx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  sourceCtx.drawImage(cameraVideo, crop.x, crop.y, crop.width, crop.height, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  sourceCtx.restore();
  frameNumber += 1;
  hasImage = true;
}

function handleKey(event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const delta = event.key === "ArrowRight" ? 1 : -1;
  selectedRadius = clamp(selectedRadius + delta, 1, MAX_RADIUS);
  drawResponseMap();
  drawCharts();
}

function drawImageToFrame(image) {
  const crop = centeredAspectCrop(image.naturalWidth || image.width, image.naturalHeight || image.height, FRAME_WIDTH / FRAME_HEIGHT);
  sourceCtx.save();
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.fillStyle = "#000";
  sourceCtx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  sourceCtx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  sourceCtx.restore();
  frameNumber += 1;
  hasImage = true;
}

function drawRawFrame(bytes) {
  const imageData = sourceCtx.createImageData(FRAME_WIDTH, FRAME_HEIGHT);
  const data = imageData.data;
  for (let p = 0, i = 0; p < bytes.length; p += 1, i += 4) {
    const value = bytes[p];
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  sourceCtx.putImageData(imageData, 0, 0);
}

function centeredAspectCrop(width, height, targetAspect) {
  const sourceAspect = width / height;
  if (sourceAspect > targetAspect) {
    const cropWidth = height * targetAspect;
    return {
      x: (width - cropWidth) / 2,
      y: 0,
      width: cropWidth,
      height,
    };
  }

  const cropHeight = width / targetAspect;
  return {
    x: 0,
    y: (height - cropHeight) / 2,
    width,
    height: cropHeight,
  };
}

function drawPlaceholder() {
  const gradient = sourceCtx.createLinearGradient(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  gradient.addColorStop(0, "#202020");
  gradient.addColorStop(1, "#707070");
  sourceCtx.fillStyle = gradient;
  sourceCtx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  sourceCtx.fillStyle = "#111";
  sourceCtx.fillRect(120, 120, 400, 110);
  sourceCtx.fillStyle = "#eee";
  sourceCtx.font = "700 32px Courier New";
  sourceCtx.textAlign = "center";
  sourceCtx.fillText("choose image file", FRAME_WIDTH / 2, 185);
  sourceCtx.font = "16px Courier New";
  sourceCtx.fillText("ON-OFF visual world analyzer", FRAME_WIDTH / 2, 217);
}

function analyzeFrame() {
  const imageData = sourceCtx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  const data = imageData.data;
  let total = 0;
  let averageSampleCount = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const value = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    gray[p] = value;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  for (let y = AVERAGE_MARGIN; y < FRAME_HEIGHT - AVERAGE_MARGIN; y += AVERAGE_STEP) {
    for (let x = AVERAGE_MARGIN; x < FRAME_WIDTH - AVERAGE_MARGIN; x += AVERAGE_STEP) {
      total += gray[y * FRAME_WIDTH + x];
      averageSampleCount += 1;
    }
  }

  sourceCtx.putImageData(imageData, 0, 0);
  els.avgPixel.textContent = (total / averageSampleCount).toFixed(1);
  els.frameNumber.textContent = frameNumber;

  stats = [];
  for (let radius = 1; radius <= MAX_RADIUS; radius += 1) {
    stats.push(analyzeRadius(radius));
  }

  drawResponseMap();
  drawCharts();
}

function analyzeRadius(radius) {
  let onSum = 0;
  let offSum = 0;
  let onCount = 0;
  let offCount = 0;
  for (let y = ANALYSIS_MARGIN; y < FRAME_HEIGHT - ANALYSIS_MARGIN; y += 1) {
    for (let x = ANALYSIS_MARGIN; x < FRAME_WIDTH - ANALYSIS_MARGIN; x += 1) {
      const response = receptiveFieldResponse(x, y, radius);
      if (response > 0) {
        onSum += response;
        onCount += 1;
      } else {
        offSum += -response;
        offCount += 1;
      }
    }
  }

  const onAverage = onCount ? onSum / onCount : 0;
  const offAverage = offCount ? offSum / offCount : 0;
  return {
    radius,
    onAverage,
    offAverage,
    onCount,
    offCount,
    diff: onAverage - offAverage,
  };
}

function receptiveFieldResponse(x, y, radius) {
  const w = FRAME_WIDTH;
  const diagonalRadius = Math.max(1, Math.round(radius * DIAGONAL_SCALE));
  const center = gray[y * w + x];
  const surround =
    gray[(y - diagonalRadius) * w + (x - diagonalRadius)] +
    gray[(y - radius) * w + x] +
    gray[(y - diagonalRadius) * w + (x + diagonalRadius)] +
    gray[y * w + (x - radius)] +
    gray[y * w + (x + radius)] +
    gray[(y + diagonalRadius) * w + (x - diagonalRadius)] +
    gray[(y + radius) * w + x] +
    gray[(y + diagonalRadius) * w + (x + diagonalRadius)];

  return 8 * center - surround;
}

function drawResponseMap() {
  els.radiusLabel.textContent = selectedRadius;
  const current = stats[selectedRadius - 1];
  els.currentOn.textContent = current.onAverage.toFixed(1);
  els.currentOff.textContent = current.offAverage.toFixed(1);
  els.currentOnCount.textContent = current.onCount;
  els.currentOffCount.textContent = current.offCount;

  const imageData = responseCtx.createImageData(FRAME_WIDTH, FRAME_HEIGHT);
  const data = imageData.data;
  buildResponseBuffer(selectedRadius);

  for (let y = 0; y < FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const i = (y * FRAME_WIDTH + x) * 4;
      if (!hasImage || x < ANALYSIS_MARGIN || x >= FRAME_WIDTH - ANALYSIS_MARGIN || y < ANALYSIS_MARGIN || y >= FRAME_HEIGHT - ANALYSIS_MARGIN) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
        continue;
      }

      const response = responseBuffer[responseIndex(x, y)];
      const intensity = Math.min(255, Math.abs(response));
      if (response > 0) {
        data[i] = intensity;
        data[i + 1] = 0;
        data[i + 2] = 0;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = intensity;
      }
      data[i + 3] = 255;
    }
  }

  responseCtx.putImageData(imageData, 0, 0);
}

function buildResponseBuffer(radius) {
  responseBuffer.fill(0);
  if (!hasImage) return;

  for (let y = ANALYSIS_MARGIN; y < FRAME_HEIGHT - ANALYSIS_MARGIN; y += 1) {
    for (let x = ANALYSIS_MARGIN; x < FRAME_WIDTH - ANALYSIS_MARGIN; x += 1) {
      responseBuffer[responseIndex(x, y)] = receptiveFieldResponse(x, y, radius);
    }
  }
}

function responseIndex(x, y) {
  return x * FRAME_HEIGHT + y;
}

function drawCharts() {
  drawLineChart(lineCtx, lineChart.width, lineChart.height, 0, 350, [
    { color: "#00ff21", values: stats.map((item) => item.onAverage) },
    { color: "#ff1515", values: stats.map((item) => item.offAverage) },
  ]);

  drawDiffChart(diffCtx, diffChart.width, diffChart.height, -200, 200, stats.map((item) => item.diff));
  updateSummary();
}

function drawLineChart(ctx, width, height, minY, maxY, series) {
  clearCanvas(ctx, width, height);
  const box = { left: 54, right: 30, top: 0, bottom: 36 };
  const plot = plotArea(width, height, box);
  drawGrid(ctx, plot, minY, maxY, positiveTicks(maxY), false);
  drawSelectedRadius(ctx, plot);
  series.forEach((item) => drawSeries(ctx, plot, item.values, minY, maxY, item.color));
}

function drawDiffChart(ctx, width, height, minY, maxY, values) {
  clearCanvas(ctx, width, height);
  const box = { left: 54, right: 30, top: 0, bottom: 52 };
  const plot = plotArea(width, height, box);
  drawGrid(ctx, plot, minY, maxY, symmetricTicks(maxY), true);
  drawSelectedRadius(ctx, plot);
  drawSeries(ctx, plot, values, minY, maxY, "#00ff21", "#ff1515");
  drawXAxisLabels(ctx, plot);
}

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
}

function plotArea(width, height, box) {
  return {
    x: box.left,
    y: box.top,
    width: width - box.left - box.right,
    height: height - box.top - box.bottom,
  };
}

function drawGrid(ctx, plot, minY, maxY, ticks, showZero) {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.height);
  ctx.lineTo(plot.x + plot.width, plot.y + plot.height);
  ctx.lineTo(plot.x + plot.width, plot.y);
  ctx.stroke();

  for (let i = 0; i < MAX_RADIUS; i += 1) {
    const x = radiusX(plot, i);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.height);
    ctx.stroke();
  }

  if (showZero) {
    const zeroY = valueY(plot, 0, minY, maxY);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.x, zeroY);
    ctx.lineTo(plot.x + plot.width, zeroY);
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Courier New";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ticks.forEach((tick) => {
    if (tick < minY || tick > maxY) return;
    ctx.fillText(String(tick), plot.x - 18, valueY(plot, tick, minY, maxY));
  });
  ctx.restore();
}

function drawSelectedRadius(ctx, plot) {
  const x = radiusX(plot, selectedRadius - 1);
  ctx.save();
  ctx.strokeStyle = "#ffc04d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, plot.y);
  ctx.lineTo(x, plot.y + plot.height);
  ctx.stroke();
  ctx.restore();
}

function drawSeries(ctx, plot, values, minY, maxY, positiveColor, negativeColor = positiveColor) {
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (let i = 0; i < values.length - 1; i += 1) {
    const value = values[i];
    const next = values[i + 1];
    ctx.strokeStyle = value >= 0 && next >= 0 ? positiveColor : negativeColor;
    ctx.beginPath();
    ctx.moveTo(radiusX(plot, i), valueY(plot, value, minY, maxY));
    ctx.lineTo(radiusX(plot, i + 1), valueY(plot, next, minY, maxY));
    ctx.stroke();
  }
  ctx.restore();
}

function drawXAxisLabels(ctx, plot) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < MAX_RADIUS; i += 1) {
    const x = radiusX(plot, i);
    ctx.fillText(String(i + 1), x, plot.y + plot.height + 14);
    ctx.fillText(SPATIAL_FREQUENCIES[i].toFixed(i < 2 ? 2 : 2), x, plot.y + plot.height + 33);
  }
  ctx.restore();
}

function updateSummary() {
  const onTotal = officialCurveAverage(stats.map((item) => item.onAverage));
  const offTotal = officialCurveAverage(stats.map((item) => item.offAverage));
  const diff = onTotal - offTotal;
  els.avgOnTotal.textContent = onTotal.toFixed(1);
  els.avgOffTotal.textContent = offTotal.toFixed(1);

  if (!hasImage) {
    els.verdictMain.textContent = "waiting for image";
    els.verdictSub.textContent = "ON-OFF analyzer";
    return;
  }

  const label = diff >= 0 ? "more ON" : "more OFF";
  els.verdictMain.textContent = `${label} (${diff.toFixed(1)})`;
  els.verdictMain.style.color = diff >= 0 ? "#00ff21" : "#ff1515";
  els.verdictSub.textContent = diff >= 0 ? "no myopia" : "stimulates myopia";
  els.verdictSub.style.background = diff >= 0 ? "#008300" : "#b60000";
}

function radiusX(plot, index) {
  return plot.x + (plot.width * (index + 1)) / MAX_RADIUS;
}

function valueY(plot, value, minY, maxY) {
  const t = (value - minY) / (maxY - minY);
  return plot.y + plot.height - t * plot.height;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function officialCurveAverage(values) {
  return values.reduce((sum, value) => sum + value, 0) / (values.length + 1);
}

function positiveTicks(maxY) {
  const ticks = [];
  for (let value = 0; value <= maxY; value += 50) {
    ticks.push(value);
  }
  return ticks;
}

function symmetricTicks(maxY) {
  const ticks = [];
  for (let value = -maxY; value <= maxY; value += 40) {
    ticks.push(value);
  }
  return ticks;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

setup();
