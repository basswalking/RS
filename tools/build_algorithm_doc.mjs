import { readFileSync, writeFileSync } from "node:fs";

const algPath = "/private/tmp/onoff_alg.txt";
const drawPath = "/private/tmp/onoff_pdf.txt";
const outPath = "/Users/apple/Documents/ON-OFF/docs/official_onoff_decompiled_algorithm.md";

const alg = readFileSync(algPath, "utf8");
const draw = readFileSync(drawPath, "utf8");

const doc = `# ON-OFF 官方程序反编译算法原文整理

来源文件：

- \`/Users/apple/Documents/OnOff-视频处理/ON OFF analysis visual world.zip\`
- \`ON OFF analysis visual world monochrome video 640x480.exe\`

反编译/反汇编来源：

- \`${algPath}\`
- \`${drawPath}\`

说明：

- 本文档保留 radare2 输出的原始反汇编文本。
- “忠实转写伪代码”只按反汇编控制流和字段读写加注释，不作为新的实现依据。
- 函数名如 \`fcn.00402180\`、\`fcn.00402af0\` 是反编译器自动命名，不是官方源码名。
- 字段名如 \`[edi + 0x3c]\` 是对象内存偏移，真实 C++ 成员名未知。

## 1. 调用关系

已确认的核心调用关系：

\`\`\`text
method.CListener.virtual_8
    -> fcn.00402180   // 每帧计算 ON/OFF 响应、统计值、写入中间结果
    -> fcn.00402af0   // 绘制界面、曲线、文字、左下角 ON/OFF 叠加图
\`\`\`

## 2. 关键全局变量和对象字段

以下是从反汇编直接观察到的含义，未观察到的字段不强行命名。

\`\`\`text
[0x40a124] = 10      // 横向/纵向扫描边界，代码中用于 width - 10
[0x40a128] = 10      // 纵向扫描边界，代码中用于 height - 10
[0x40a334] = 0       // 分支开关；等于 1 时进入 absolute delta 分支
[0x40a33c] = 0       // 当前 RF 半径/选择值相关；绘图文字也使用它

[edi + 0x0c]         // average pixel value
[edi + 0x24]         // 当前帧宽度
[edi + 0x28]         // 当前帧高度
[edi + 0x34]         // ON RF count
[edi + 0x38]         // OFF RF count
[edi + 0x3c]         // ave ON contrast
[edi + 0x40]         // ave OFF contrast
[edi + 0x44]         // sum of all averaged ON responses
[edi + 0x48]         // sum of all averaged OFF responses
\`\`\`

## 3. fcn.00402180 忠实转写伪代码

注意：下面是方便阅读的注释版，不替代后面的完整反汇编原文。

\`\`\`c
// fcn.00402180(arg_30h=frameBuffer, arg_28h=width, arg_34h=height)
// ecx/edi = this/object

this->avgPixel = 0;
this->width = width;
this->height = height;

// average pixel value:
// y 从 20 开始，每 20 像素采样一次，到 height - 20 之前；
// x 从 20 开始，每 20 像素采样一次，到 width - 20 之前。
// 累加这些采样点，最后除以采样点数量。
for (y = 20; y < height - 20; y += 20) {
  for (x = 20; x < width - 20; x += 20) {
    this->avgPixel += frameBuffer[y * width + x];
    sampleCount++;
  }
}
this->avgPixel /= sampleCount;

this->onCount = 0;
this->offCount = 0;
this->aveOn = 0;
this->aveOff = 0;

// 下面核心扫描区从 10 到 width/height - 10。
// 反汇编中 diagonal offset 由 fcn.00404b80 计算，输入涉及 [0x40a33c] * 常量 0.707...
// 结果放入 arg_30h，后续作为对角采样偏移。

if ([0x40a334] == 1) {
  // absolute delta 分支：
  // 以中心点为基准，计算中心与八个周边采样点差值的绝对值之和。
  // 该分支写入 0x536350 起始的中间结果缓冲区。
  value =
      abs(center - top)
    + abs(center - bottom)
    + abs(center - left)
    + abs(center - upperLeft)
    + abs(center - lowerLeft)
    + abs(center - right)
    + abs(center - upperRight)
    + abs(center - lowerRight);
} else {
  // ON/OFF 分支：
  // 反汇编中是中心点乘 8，再减去八个周边采样点。
  value =
      8 * center
    - top
    - bottom
    - left
    - upperLeft
    - lowerLeft
    - right
    - upperRight
    - lowerRight;

  // value > 0 归为 ON；否则归为 OFF。
  // OFF 平均值显示为负响应取反后的平均强度。
  if (value > 0) {
    onSum += value;
    onCount++;
  } else {
    offSum += -value;
    offCount++;
  }
}

this->aveOn = onSum / onCount;
this->aveOff = offSum / offCount;
\`\`\`

## 4. fcn.00402af0 忠实转写重点

\`\`\`c
// fcn.00402af0(...)
// 这个函数主要负责绘图。

if ([0x40a334] == 1) {
  drawText("absolute delta");
} else {
  drawText("ON output is in red, OFF output in blue, for receptive field (RF) radius of %d pixel", [0x40a33c]);
  drawText("ave ON contrast = %3.1f (%d ON RFs), ave OFF contrast = %3.1f (%d OFF RFs)",
           this->aveOn, this->onCount, this->aveOff, this->offCount);
}

drawText("sum of all averaged ON responses = %3.1f", this->sumAllOn);
drawText("sum of all averaged OFF responses = %3.1f", this->sumAllOff);
\`\`\`

## 5. fcn.00402180 完整反汇编原文

\`\`\`asm
${alg}
\`\`\`

## 6. fcn.00402af0 完整反汇编原文

\`\`\`asm
${draw}
\`\`\`
`;

writeFileSync(outPath, doc, "utf8");
console.log(outPath);
