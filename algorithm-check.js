const W = 640;
const H = 480;
const MAX_R = 10;
const FREQS = [22.4, 11.2, 7.47, 5.6, 4.48, 3.73, 3.2, 2.8, 2.49, 2.24];
const DIAG = 0.707;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const avgGridEl = document.getElementById("avgGrid");
const avgAllEl = document.getElementById("avgAll");
const resultsEl = document.getElementById("results");
const targetRowsEl = document.getElementById("targetRows");

let gray = new Float32Array(W * H);
let hasImage = false;

const modes = [
  { id: "yx", name: "A standard y*640+x", sample: (x, y) => gray[y * W + x] },
  { id: "yx_flip_y", name: "B y*640+x, vertical flip", sample: (x, y) => gray[(H - 1 - y) * W + x] },
  { id: "yx_flip_x", name: "C y*640+x, horizontal flip", sample: (x, y) => gray[y * W + (W - 1 - x)] },
  { id: "yx_flip_xy", name: "D y*640+x, both flips", sample: (x, y) => gray[(H - 1 - y) * W + (W - 1 - x)] },
  { id: "xy", name: "E transposed x*480+y", sample: (x, y) => gray[x * H + y] || 0 },
  { id: "xy_flip_y", name: "F transposed x*480+(479-y)", sample: (x, y) => gray[x * H + (H - 1 - y)] || 0 },
  { id: "xy_flip_x", name: "G transposed (639-x)*480+y", sample: (x, y) => gray[(W - 1 - x) * H + y] || 0 },
  { id: "xy_flip_xy", name: "H transposed both flips", sample: (x, y) => gray[(W - 1 - x) * H + (H - 1 - y)] || 0 },
  { id: "abs_delta", name: "I official absolute-delta branch", sample: (x, y) => gray[y * W + x], absoluteDelta: true },
];

function init() {
  buildTargets();
  drawPlaceholder();
  document.getElementById("fileInput").addEventListener("change", onFile);
  targetRowsEl.addEventListener("input", renderResults);
}

function buildTargets() {
  targetRowsEl.innerHTML = Array.from({ length: MAX_R }, (_, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><input class="value target-on" data-r="${i}" inputmode="decimal"></td>
      <td><input class="value target-off" data-r="${i}" inputmode="decimal"></td>
    </tr>
  `).join("");
}

function drawPlaceholder() {
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ddd";
  ctx.font = "700 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Choose an image", W / 2, H / 2);
}

function onFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const image = new Image();
  image.onload = () => {
    drawImage(image);
    URL.revokeObjectURL(image.src);
    readGray();
    hasImage = true;
    renderResults();
  };
  image.src = URL.createObjectURL(file);
}

function drawImage(image) {
  const crop = centeredCrop(image.naturalWidth || image.width, image.naturalHeight || image.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);
  ctx.restore();
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

function readGray() {
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  let all = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = v;
    all += v;
    const d = Math.round(v);
    data[i] = d;
    data[i + 1] = d;
    data[i + 2] = d;
  }
  ctx.putImageData(imageData, 0, 0);

  avgAllEl.textContent = (all / gray.length).toFixed(1);
  avgGridEl.textContent = gridAverage().toFixed(1);
}

function gridAverage() {
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

function renderResults() {
  if (!hasImage) {
    resultsEl.innerHTML = "<p>Choose an image first.</p>";
    return;
  }

  const targets = readTargets();
  const analyzed = modes.map((mode) => ({ mode, stats: analyzeMode(mode) }));
  analyzed.sort((a, b) => score(a.stats, targets) - score(b.stats, targets));

  resultsEl.innerHTML = analyzed.map(({ mode, stats }) => modeBlock(mode, stats, score(stats, targets))).join("");
}

function readTargets() {
  const on = Array(MAX_R).fill(null);
  const off = Array(MAX_R).fill(null);
  document.querySelectorAll(".target-on").forEach((input) => {
    const value = Number(input.value);
    if (input.value.trim() !== "" && Number.isFinite(value)) on[Number(input.dataset.r)] = value;
  });
  document.querySelectorAll(".target-off").forEach((input) => {
    const value = Number(input.value);
    if (input.value.trim() !== "" && Number.isFinite(value)) off[Number(input.dataset.r)] = value;
  });
  return { on, off };
}

function score(stats, targets) {
  let total = 0;
  let count = 0;
  for (let i = 0; i < MAX_R; i += 1) {
    if (targets.on[i] !== null) {
      total += Math.abs(stats[i].onAvg - targets.on[i]);
      count += 1;
    }
    if (targets.off[i] !== null) {
      total += Math.abs(stats[i].offAvg - targets.off[i]);
      count += 1;
    }
  }
  return count ? total / count : 0;
}

function analyzeMode(mode) {
  return Array.from({ length: MAX_R }, (_, index) => analyzeRadius(mode, index + 1));
}

function analyzeRadius(mode, r) {
  let onSum = 0;
  let offSum = 0;
  let onCount = 0;
  let offCount = 0;

  for (let y = MAX_R; y < H - MAX_R; y += 1) {
    for (let x = MAX_R; x < W - MAX_R; x += 1) {
      const response = mode.absoluteDelta ? absDeltaResponse(mode, x, y, r) : signedResponse(mode, x, y, r);
      if (response > 0) {
        onSum += response;
        onCount += 1;
      } else {
        offSum += response;
        offCount += 1;
      }
    }
  }

  const onAvg = onCount ? onSum / onCount : 0;
  const offAvg = offCount ? -offSum / offCount : 0;
  return { r, onAvg, offAvg, onCount, offCount, diff: onAvg - offAvg };
}

function signedResponse(mode, x, y, r) {
  const d = Math.max(1, Math.round(r * 0.707));
  const c = mode.sample(x, y);
  const s =
    mode.sample(x, y - r) +
    mode.sample(x, y + r) +
    mode.sample(x - r, y) +
    mode.sample(x + r, y) +
    mode.sample(x - d, y - d) +
    mode.sample(x + d, y - d) +
    mode.sample(x - d, y + d) +
    mode.sample(x + d, y + d);
  return 8 * c - s;
}

function absDeltaResponse(mode, x, y, r) {
  const d = Math.max(1, Math.round(r * 0.707));
  const c = mode.sample(x, y);
  return Math.abs(c - mode.sample(x, y - r)) +
    Math.abs(c - mode.sample(x, y + r)) +
    Math.abs(c - mode.sample(x - r, y)) +
    Math.abs(c - mode.sample(x + r, y)) +
    Math.abs(c - mode.sample(x - d, y - d)) +
    Math.abs(c - mode.sample(x + d, y - d)) +
    Math.abs(c - mode.sample(x - d, y + d)) +
    Math.abs(c - mode.sample(x + d, y + d));
}

function modeBlock(mode, stats, modeScore) {
  const sumOn = stats.reduce((sum, item) => sum + item.onAvg, 0) / 11;
  const sumOff = stats.reduce((sum, item) => sum + item.offAvg, 0) / 11;
  return `
    <section class="mode">
      <h3>${mode.name} <span class="score">score ${modeScore.toFixed(2)}, sum ON ${sumOn.toFixed(1)}, sum OFF ${sumOff.toFixed(1)}</span></h3>
      <table>
        <thead>
          <tr>
            <th>r</th><th>cyc/deg</th><th class="green">ON avg</th><th>ON RFs</th><th class="red">OFF avg</th><th>OFF RFs</th><th>diff</th>
          </tr>
        </thead>
        <tbody>
          ${stats.map((s, i) => `
            <tr>
              <td>${s.r}</td>
              <td>${FREQS[i].toFixed(2)}</td>
              <td>${s.onAvg.toFixed(1)}</td>
              <td>${s.onCount}</td>
              <td>${s.offAvg.toFixed(1)}</td>
              <td>${s.offCount}</td>
              <td>${s.diff.toFixed(1)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

init();
