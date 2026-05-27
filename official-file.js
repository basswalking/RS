const W = 640;
const H = 480;
const MAX_R = 10;
const DESIGN_W = 1920;
const DESIGN_H = 944;
const DIAG = 0.707;
const FREQS = [22.4, 11.2, 7.47, 5.6, 4.48, 3.73, 3.2, 2.8, 2.49, 2.24];

const sourceCanvas = document.getElementById("sourceCanvas");
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
const mapCanvas = document.getElementById("mapCanvas");
const mapCtx = mapCanvas.getContext("2d", { willReadFrequently: true });
const lineChart = document.getElementById("lineChart");
const lineCtx = lineChart.getContext("2d");
const diffChart = document.getElementById("diffChart");
const diffCtx = diffChart.getContext("2d");

const ui = {
  avgPixel: document.getElementById("avgPixel"),
  frameNumber: document.getElementById("frameNumber"),
  currentRadius: document.getElementById("currentRadius"),
  selectedOn: document.getElementById("selectedOn"),
  selectedOff: document.getElementById("selectedOff"),
  selectedOnCount: document.getElementById("selectedOnCount"),
  selectedOffCount: document.getElementById("selectedOffCount"),
  sumOn: document.getElementById("sumOn"),
  sumOff: document.getElementById("sumOff"),
  verdictMain: document.getElementById("verdictMain"),
  verdictSub: document.getElementById("verdictSub"),
  statsRows: document.getElementById("statsRows"),
};

let frame = 0;
let radius = 2;
let hasImage = false;
let gray = new Float32Array(W * H);
let stats = emptyStats();

function emptyStats() {
  return Array.from({ length: MAX_R }, (_, i) => ({
    r: i + 1,
    onAvg: 0,
    offAvg: 0,
    onCount: 0,
    offCount: 0,
    diff: 0,
  }));
}

function init() {
  scaleApp();
  window.addEventListener("resize", scaleApp);
  window.addEventListener("keydown", onKey);
  document.getElementById("fileInput").addEventListener("change", onFile);
  drawPlaceholder();
  analyzeAndDraw(false);
}

function scaleApp() {
  const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
  document.getElementById("appFrame").style.transform = `scale(${scale})`;
}

function onKey(event) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    radius = Math.max(1, Math.min(MAX_R, radius + (event.key === "ArrowRight" ? 1 : -1)));
    drawMap();
    drawCharts();
    return;
  }

  if (event.key.toLowerCase() === "t") {
    document.querySelector(".table-panel").classList.toggle("visible");
  }
}

function onFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const image = new Image();
  image.onload = () => {
    drawInputImage(image);
    URL.revokeObjectURL(image.src);
    frame += 1;
    hasImage = true;
    analyzeAndDraw(true);
  };
  image.src = URL.createObjectURL(file);
}

function drawInputImage(image) {
  const crop = centeredCrop(image.naturalWidth || image.width, image.naturalHeight || image.height);
  sourceCtx.save();
  sourceCtx.imageSmoothingEnabled = true;
  sourceCtx.fillStyle = "#000";
  sourceCtx.fillRect(0, 0, W, H);
  sourceCtx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);
  sourceCtx.restore();
}

function centeredCrop(width, height) {
  const target = W / H;
  const aspect = width / height;
  if (aspect > target) {
    const w = height * target;
    return { x: (width - w) / 2, y: 0, w, h: height };
  }
  const h = width / target;
  return { x: 0, y: (height - h) / 2, w: width, h };
}

function drawPlaceholder() {
  const g = sourceCtx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#171717");
  g.addColorStop(1, "#666");
  sourceCtx.fillStyle = g;
  sourceCtx.fillRect(0, 0, W, H);
  sourceCtx.fillStyle = "#111";
  sourceCtx.fillRect(112, 150, 416, 96);
  sourceCtx.fillStyle = "#eee";
  sourceCtx.font = "700 30px Courier New";
  sourceCtx.textAlign = "center";
  sourceCtx.fillText("choose image file", W / 2, 205);
}

function analyzeAndDraw(updateGray) {
  if (updateGray) readGrayFrame();
  if (hasImage) stats = analyzeOfficial();
  drawMap();
  drawCharts();
  drawTable();
}

function readGrayFrame() {
  const imageData = sourceCtx.getImageData(0, 0, W, H);
  const data = imageData.data;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = y;
    const d = Math.round(y);
    data[i] = d;
    data[i + 1] = d;
    data[i + 2] = d;
  }

  sourceCtx.putImageData(imageData, 0, 0);
  ui.avgPixel.textContent = officialAveragePixel().toFixed(1);
  ui.frameNumber.textContent = String(frame);
}

function officialAveragePixel() {
  let sum = 0;
  let count = 0;
  for (let y = 20; y < H - 20; y += 20) {
    for (let x = 20; x < W - 20; x += 20) {
      sum += gray[y * W + x];
      count += 1;
    }
  }
  return count ? sum / count : 0;
}

function analyzeOfficial() {
  const out = emptyStats();
  for (let r = 1; r <= MAX_R; r += 1) {
    let onSum = 0;
    let offSum = 0;
    let onCount = 0;
    let offCount = 0;

    for (let y = MAX_R; y < H - MAX_R; y += 1) {
      for (let x = MAX_R; x < W - MAX_R; x += 1) {
        const response = rfResponse(x, y, r);
        if (response > 0) {
          onSum += response;
          onCount += 1;
        } else {
          offSum += response;
          offCount += 1;
        }
      }
    }

    out[r - 1] = {
      r,
      onAvg: onCount ? onSum / onCount : 0,
      offAvg: offCount ? -offSum / offCount : 0,
      onCount,
      offCount,
      diff: (onCount ? onSum / onCount : 0) - (offCount ? -offSum / offCount : 0),
    };
  }
  return out;
}

function rfResponse(x, y, r) {
  const d = officialRound(r * DIAG);
  const c = gray[y * W + x];
  const s =
    gray[(y - r) * W + x] +
    gray[(y + r) * W + x] +
    gray[y * W + (x - r)] +
    gray[y * W + (x + r)] +
    gray[(y - d) * W + (x - d)] +
    gray[(y - d) * W + (x + d)] +
    gray[(y + d) * W + (x - d)] +
    gray[(y + d) * W + (x + d)];
  return 8 * c - s;
}

function officialRound(value) {
  return Math.max(1, Math.round(value));
}

function drawMap() {
  ui.currentRadius.textContent = String(radius);
  const current = stats[radius - 1];
  ui.selectedOn.textContent = current.onAvg.toFixed(1);
  ui.selectedOff.textContent = current.offAvg.toFixed(1);
  ui.selectedOnCount.textContent = String(current.onCount);
  ui.selectedOffCount.textContent = String(current.offCount);

  const imageData = mapCtx.createImageData(W, H);
  const data = imageData.data;
  const max = hasImage ? estimateMapScale(radius) : 1;

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      if (!hasImage || x < MAX_R || x >= W - MAX_R || y < MAX_R || y >= H - MAX_R) {
        data[i + 3] = 255;
        continue;
      }

      const response = rfResponse(x, y, radius);
      const v = Math.min(255, Math.round((Math.abs(response) / max) * 255));
      if (response > 0) {
        data[i] = v;
      } else {
        data[i + 2] = v;
      }
      data[i + 3] = 255;
    }
  }

  mapCtx.putImageData(imageData, 0, 0);
}

function estimateMapScale(r) {
  let max = 1;
  for (let y = MAX_R; y < H - MAX_R; y += 4) {
    for (let x = MAX_R; x < W - MAX_R; x += 4) {
      max = Math.max(max, Math.abs(rfResponse(x, y, r)));
    }
  }
  return max;
}

function drawCharts() {
  drawLineChart();
  drawDiffChart();
  updateSummary();
}

function drawLineChart() {
  clear(lineCtx, lineChart);
  const plot = { x: 54, y: 0, w: lineChart.width - 84, h: lineChart.height - 36 };
  drawGrid(lineCtx, plot, 0, 350, [0, 50, 100, 150, 200, 250, 300, 350], false);
  drawSelected(lineCtx, plot);
  drawSeries(lineCtx, plot, stats.map((s) => s.onAvg), 0, 350, "#00ff20");
  drawSeries(lineCtx, plot, stats.map((s) => s.offAvg), 0, 350, "#ff1818");
}

function drawDiffChart() {
  clear(diffCtx, diffChart);
  const plot = { x: 54, y: 0, w: diffChart.width - 84, h: diffChart.height - 52 };
  drawGrid(diffCtx, plot, -200, 200, [-200, -160, -120, -80, -40, 0, 40, 80, 120, 160, 200], true);
  drawSelected(diffCtx, plot);
  drawSeries(diffCtx, plot, stats.map((s) => s.diff), -200, 200, "#00ff20", "#ff1818");
  drawLabels(diffCtx, plot);
}

function clear(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid(ctx, plot, min, max, ticks, zeroLine) {
  ctx.save();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.h);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
  ctx.lineTo(plot.x + plot.w, plot.y);
  ctx.stroke();

  for (let i = 0; i < MAX_R; i += 1) {
    const x = xAt(plot, i);
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.h);
    ctx.stroke();
  }

  if (zeroLine) {
    const y = yAt(plot, 0, min, max);
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#fff";
  ctx.font = "18px Courier New";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ticks.forEach((tick) => ctx.fillText(String(tick), plot.x - 16, yAt(plot, tick, min, max)));
  ctx.restore();
}

function drawSelected(ctx, plot) {
  const x = xAt(plot, radius - 1);
  ctx.save();
  ctx.strokeStyle = "#ffc04d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, plot.y);
  ctx.lineTo(x, plot.y + plot.h);
  ctx.stroke();
  ctx.restore();
}

function drawSeries(ctx, plot, values, min, max, positive, negative = positive) {
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (let i = 0; i < values.length - 1; i += 1) {
    ctx.strokeStyle = values[i] >= 0 && values[i + 1] >= 0 ? positive : negative;
    ctx.beginPath();
    ctx.moveTo(xAt(plot, i), yAt(plot, values[i], min, max));
    ctx.lineTo(xAt(plot, i + 1), yAt(plot, values[i + 1], min, max));
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabels(ctx, plot) {
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "16px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < MAX_R; i += 1) {
    const x = xAt(plot, i);
    ctx.fillText(String(i + 1), x, plot.y + plot.h + 14);
    ctx.fillText(FREQS[i].toFixed(2), x, plot.y + plot.h + 33);
  }
  ctx.restore();
}

function updateSummary() {
  const on = stats.reduce((sum, s) => sum + s.onAvg, 0) / 11;
  const off = stats.reduce((sum, s) => sum + s.offAvg, 0) / 11;
  const diff = on - off;
  ui.sumOn.textContent = on.toFixed(1);
  ui.sumOff.textContent = off.toFixed(1);

  if (!hasImage) return;
  ui.verdictMain.textContent = `${diff >= 0 ? "more ON" : "more OFF"} (${Math.abs(diff).toFixed(1)})`;
  ui.verdictMain.style.color = diff >= 0 ? "#00ff20" : "#ff1818";
  ui.verdictSub.textContent = diff >= 0 ? "no myopia" : "stimulates myopia";
  ui.verdictSub.style.background = diff >= 0 ? "#008300" : "#b60000";
}

function drawTable() {
  ui.statsRows.innerHTML = stats.map((s, i) => `
    <tr>
      <td>${s.r}</td>
      <td>${FREQS[i].toFixed(2)}</td>
      <td>${s.onAvg.toFixed(1)}</td>
      <td>${s.onCount}</td>
      <td>${s.offAvg.toFixed(1)}</td>
      <td>${s.offCount}</td>
      <td>${s.diff.toFixed(1)}</td>
    </tr>
  `).join("");
}

function xAt(plot, index) {
  return plot.x + (plot.w * (index + 1)) / MAX_R;
}

function yAt(plot, value, min, max) {
  const t = (value - min) / (max - min);
  return plot.y + plot.h - t * plot.h;
}

init();
