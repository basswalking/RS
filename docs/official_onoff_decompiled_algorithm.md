# ON-OFF 官方程序反编译算法原文整理

来源文件：

- `/Users/apple/Documents/OnOff-视频处理/ON OFF analysis visual world.zip`
- `ON OFF analysis visual world monochrome video 640x480.exe`

反编译/反汇编来源：

- `/private/tmp/onoff_alg.txt`
- `/private/tmp/onoff_pdf.txt`

说明：

- 本文档保留 radare2 输出的原始反汇编文本。
- “忠实转写伪代码”只按反汇编控制流和字段读写加注释，不作为新的实现依据。
- 函数名如 `fcn.00402180`、`fcn.00402af0` 是反编译器自动命名，不是官方源码名。
- 字段名如 `[edi + 0x3c]` 是对象内存偏移，真实 C++ 成员名未知。

## 1. 调用关系

已确认的核心调用关系：

```text
method.CListener.virtual_8
    -> fcn.00402180   // 每帧计算 ON/OFF 响应、统计值、写入中间结果
    -> fcn.00402af0   // 绘制界面、曲线、文字、左下角 ON/OFF 叠加图
```

## 2. 关键全局变量和对象字段

以下是从反汇编直接观察到的含义，未观察到的字段不强行命名。

```text
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
```

## 3. fcn.00402180 忠实转写伪代码

注意：下面是方便阅读的注释版，不替代后面的完整反汇编原文。

```c
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
```

## 4. fcn.00402af0 忠实转写重点

```c
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
```

## 5. fcn.00402180 完整反汇编原文

```asm
            ; CALL XREF from method.CListener.virtual_8 @ 0x40414b(x)
┌ 1715: fcn.00402180 (signed int arg_30h, signed int arg_28h, int32_t arg_34h);
│ `- args(sp[0x4..0xc]) vars(8:sp[0x4..0x20])
│           0x00402180      83ec20         sub esp, 0x20
│           0x00402183      8b442428       mov eax, dword [arg_28h]
│           0x00402187      d9ee           fldz
│           0x00402189      53             push ebx
│           0x0040218a      55             push ebp
│           0x0040218b      8b6c2434       mov ebp, dword [arg_34h]
│           0x0040218f      56             push esi
│           0x00402190      8b742430       mov esi, dword [arg_30h]
│           0x00402194      57             push edi
│           0x00402195      8bf9           mov edi, ecx
│           0x00402197      33d2           xor edx, edx
│           0x00402199      d9570c         fst dword [edi + 0xc]
│           0x0040219c      8d4dec         lea ecx, [ebp - 0x14]
│           0x0040219f      83f914         cmp ecx, 0x14               ; 20
│           0x004021a2      894724         mov dword [edi + 0x24], eax
│           0x004021a5      896f28         mov dword [edi + 0x28], ebp
│           0x004021a8      89542410       mov dword [var_10h], edx
│           0x004021ac      c744243814..   mov dword [arg_28h], 0x14   ; [0x14:4]=-1 ; 20
│       ┌─< 0x004021b4      7e6b           jle 0x402221
│       │   0x004021b6      8d48ec         lea ecx, [eax - 0x14]
│       │   0x004021b9      894c2434       mov dword [arg_30h], ecx
│       │   0x004021bd      8d0c80         lea ecx, [eax + eax*4]
│       │   0x004021c0      03c9           add ecx, ecx
│       │   0x004021c2      03c9           add ecx, ecx
│       │   0x004021c4      8d443114       lea eax, [ecx + esi + 0x14]
│       │   0x004021c8      894c2424       mov dword [var_24h], ecx
│       │   0x004021cc      8944243c       mov dword [arg_34h], eax
│       │   ; CODE XREF from fcn.00402180 @ 0x40221b(x)
│      ┌──> 0x004021d0      b814000000     mov eax, 0x14               ; 20
│      ╎│   0x004021d5      39442434       cmp dword [arg_30h], eax
│     ┌───< 0x004021d9      7e2a           jle 0x402205
│     │╎│   0x004021db      8b4c243c       mov ecx, dword [arg_34h]
│     │╎│   ; CODE XREF from fcn.00402180 @ 0x4021ff(x)
│    ┌────> 0x004021df      0fb619         movzx ebx, byte [ecx]
│    ╎│╎│   0x004021e2      895c2428       mov dword [var_28h], ebx
│    ╎│╎│   0x004021e6      83c014         add eax, 0x14               ; 20
│    ╎│╎│   0x004021e9      42             inc edx
│    ╎│╎│   0x004021ea      db442428       fild dword [esp + 0x28]
│    ╎│╎│   0x004021ee      83c114         add ecx, 0x14               ; 20
│    ╎│╎│   0x004021f1      d8470c         fadd dword [edi + 0xc]
│    ╎│╎│   0x004021f4      d95f0c         fstp dword [edi + 0xc]
│    ╎│╎│   0x004021f7      8b5f24         mov ebx, dword [edi + 0x24]
│    ╎│╎│   0x004021fa      83eb14         sub ebx, 0x14               ; 20
│    ╎│╎│   0x004021fd      3bc3           cmp eax, ebx
│    └────< 0x004021ff      7cde           jl 0x4021df
│     │╎│   0x00402201      8b4c2424       mov ecx, dword [var_24h]
│     │╎│   ; CODE XREF from fcn.00402180 @ 0x4021d9(x)
│     └───> 0x00402205      8b442438       mov eax, dword [arg_28h]
│      ╎│   0x00402209      014c243c       add dword [arg_34h], ecx
│      ╎│   0x0040220d      8bdd           mov ebx, ebp
│      ╎│   0x0040220f      83c014         add eax, 0x14               ; 20
│      ╎│   0x00402212      83eb14         sub ebx, 0x14               ; 20
│      ╎│   0x00402215      3bc3           cmp eax, ebx
│      ╎│   0x00402217      89442438       mov dword [arg_28h], eax
│      └──< 0x0040221b      7cb3           jl 0x4021d0
│       │   0x0040221d      89542410       mov dword [var_10h], edx
│       │   ; CODE XREF from fcn.00402180 @ 0x4021b4(x)
│       └─> 0x00402221      d9470c         fld dword [edi + 0xc]
│           0x00402224      33db           xor ebx, ebx
│           0x00402226      da742410       fidiv dword [esp + 0x10]
│           0x0040222a      895f34         mov dword [edi + 0x34], ebx
│           0x0040222d      895f38         mov dword [edi + 0x38], ebx
│           0x00402230      d95f0c         fstp dword [edi + 0xc]
│           0x00402233      d9573c         fst dword [edi + 0x3c]
│           0x00402236      d95740         fst dword [edi + 0x40]
│           0x00402239      db053ca34000   fild dword [0x40a33c]
│           0x0040223f      dd05406e4000   fld qword [0x406e40]
│           0x00402245      dcc9           fmul st(1), st(0)
│           0x00402247      d9c9           fxch st(1)
│           0x00402249      e832290000     call fcn.00404b80
│           0x0040224e      8bd0           mov edx, eax
│           0x00402250      a128a14000     mov eax, dword [0x40a128]   ; [0x40a128:4]=10
│           0x00402255      33c9           xor ecx, ecx
│           0x00402257      2be8           sub ebp, eax
│           0x00402259      3bc5           cmp eax, ebp
│           0x0040225b      89542434       mov dword [arg_30h], edx
│           0x0040225f      894c2410       mov dword [var_10h], ecx
│           0x00402263      89442438       mov dword [arg_28h], eax
│       ┌─< 0x00402267      0f8dbf020000   jge 0x40252c
│       │   0x0040226d      8b2d3ca34000   mov ebp, dword [0x40a33c]   ; [0x40a33c:4]=0
│       │   0x00402273      8bd8           mov ebx, eax
│       │   0x00402275      2bda           sub ebx, edx
│       │   0x00402277      895c2420       mov dword [var_20h], ebx
│      ┌──< 0x0040227b      eb02           jmp 0x40227f
│      ││   ; CODE XREF from fcn.00402180 @ 0x402520(x)
│     ┌───> 0x0040227d      33c9           xor ecx, ecx
│     ╎││   ; CODE XREF from fcn.00402180 @ 0x40227b(x)
│     ╎└──> 0x0040227f      8b5f24         mov ebx, dword [edi + 0x24]
│     ╎ │   0x00402282      894c2424       mov dword [var_24h], ecx
│     ╎ │   0x00402286      8b0d24a14000   mov ecx, dword [0x40a124]   ; [0x40a124:4]=10
│     ╎ │   0x0040228c      2bd9           sub ebx, ecx
│     ╎ │   0x0040228e      3bcb           cmp ecx, ebx
│     ╎┌──< 0x00402290      0f8d6c020000   jge 0x402502
│     ╎││   0x00402296      03d0           add edx, eax
│     ╎││   0x00402298      89542428       mov dword [var_28h], edx
│     ╎││   0x0040229c      8bd1           mov edx, ecx
│     ╎││   0x0040229e      69d2e0010000   imul edx, edx, 0x1e0        ; 480
│     ╎││   0x004022a4      03d0           add edx, eax
│     ╎││   0x004022a6      8d04955063..   lea eax, [edx*4 + 0x536350]
│     ╎││   0x004022ad      8944241c       mov dword [var_1ch], eax
│     ╎││   ; CODE XREF from fcn.00402180 @ 0x4024f8(x)
│    ┌────> 0x004022b1      833d34a340..   cmp dword [0x40a334], 1     ; [0x40a334:4]=0
│   ┌─────< 0x004022b8      0f854c010000   jne 0x40240a
│   │╎╎││   0x004022be      8b4724         mov eax, dword [edi + 0x24]
│   │╎╎││   0x004022c1      8bd0           mov edx, eax
│   │╎╎││   0x004022c3      0faf542420     imul edx, dword [var_20h]
│   │╎╎││   0x004022c8      89542414       mov dword [var_sp_14h], edx
│   │╎╎││   0x004022cc      8bd0           mov edx, eax
│   │╎╎││   0x004022ce      0faf542438     imul edx, dword [arg_28h]
│   │╎╎││   0x004022d3      8954243c       mov dword [arg_34h], edx
│   │╎╎││   0x004022d7      03d1           add edx, ecx
│   │╎╎││   0x004022d9      0fb61c32       movzx ebx, byte [edx + esi]
│   │╎╎││   0x004022dd      8b542428       mov edx, dword [var_28h]
│   │╎╎││   0x004022e1      0fafd0         imul edx, eax
│   │╎╎││   0x004022e4      89542418       mov dword [var_18h], edx
│   │╎╎││   0x004022e8      8b542438       mov edx, dword [arg_28h]
│   │╎╎││   0x004022ec      2bd5           sub edx, ebp
│   │╎╎││   0x004022ee      0fafd0         imul edx, eax
│   │╎╎││   0x004022f1      03d1           add edx, ecx
│   │╎╎││   0x004022f3      0fb61432       movzx edx, byte [edx + esi]
│   │╎╎││   0x004022f7      8bc3           mov eax, ebx
│   │╎╎││   0x004022f9      2bc2           sub eax, edx
│   │╎╎││   0x004022fb      99             cdq
│   │╎╎││   0x004022fc      33c2           xor eax, edx
│   │╎╎││   0x004022fe      2bc2           sub eax, edx
│   │╎╎││   0x00402300      8b542438       mov edx, dword [arg_28h]
│   │╎╎││   0x00402304      03ea           add ebp, edx
│   │╎╎││   0x00402306      0faf6f24       imul ebp, dword [edi + 0x24]
│   │╎╎││   0x0040230a      8944242c       mov dword [var_2ch], eax
│   │╎╎││   0x0040230e      03e9           add ebp, ecx
│   │╎╎││   0x00402310      0fb6142e       movzx edx, byte [esi + ebp]
│   │╎╎││   0x00402314      8bc3           mov eax, ebx
│   │╎╎││   0x00402316      2bc2           sub eax, edx
│   │╎╎││   0x00402318      99             cdq
│   │╎╎││   0x00402319      33c2           xor eax, edx
│   │╎╎││   0x0040231b      2bc2           sub eax, edx
│   │╎╎││   0x0040231d      8b54242c       mov edx, dword [var_2ch]
│   │╎╎││   0x00402321      03d0           add edx, eax
│   │╎╎││   0x00402323      8b442414       mov eax, dword [var_sp_14h]
│   │╎╎││   0x00402327      2b442434       sub eax, dword [arg_30h]
│   │╎╎││   0x0040232b      8954242c       mov dword [var_2ch], edx
│   │╎╎││   0x0040232f      03c1           add eax, ecx
│   │╎╎││   0x00402331      0fb62c30       movzx ebp, byte [eax + esi]
│   │╎╎││   0x00402335      8bc3           mov eax, ebx
│   │╎╎││   0x00402337      2bc5           sub eax, ebp
│   │╎╎││   0x00402339      99             cdq
│   │╎╎││   0x0040233a      33c2           xor eax, edx
│   │╎╎││   0x0040233c      2bc2           sub eax, edx
│   │╎╎││   0x0040233e      8b54242c       mov edx, dword [var_2ch]
│   │╎╎││   0x00402342      03d0           add edx, eax
│   │╎╎││   0x00402344      8b442418       mov eax, dword [var_18h]
│   │╎╎││   0x00402348      2b442434       sub eax, dword [arg_30h]
│   │╎╎││   0x0040234c      8954242c       mov dword [var_2ch], edx
│   │╎╎││   0x00402350      03c1           add eax, ecx
│   │╎╎││   0x00402352      0fb62c30       movzx ebp, byte [eax + esi]
│   │╎╎││   0x00402356      8bc3           mov eax, ebx
│   │╎╎││   0x00402358      2bc5           sub eax, ebp
│   │╎╎││   0x0040235a      99             cdq
│   │╎╎││   0x0040235b      33c2           xor eax, edx
│   │╎╎││   0x0040235d      2bc2           sub eax, edx
│   │╎╎││   0x0040235f      8b54242c       mov edx, dword [var_2ch]
│   │╎╎││   0x00402363      03d0           add edx, eax
│   │╎╎││   0x00402365      8b44243c       mov eax, dword [arg_34h]
│   │╎╎││   0x00402369      2b053ca34000   sub eax, dword [0x40a33c]   ; [0x40a33c:4]=0
│   │╎╎││   0x0040236f      8954242c       mov dword [var_2ch], edx
│   │╎╎││   0x00402373      03c1           add eax, ecx
│   │╎╎││   0x00402375      0fb62c30       movzx ebp, byte [eax + esi]
│   │╎╎││   0x00402379      8bc3           mov eax, ebx
│   │╎╎││   0x0040237b      2bc5           sub eax, ebp
│   │╎╎││   0x0040237d      8b6c2434       mov ebp, dword [arg_30h]
│   │╎╎││   0x00402381      99             cdq
│   │╎╎││   0x00402382      33c2           xor eax, edx
│   │╎╎││   0x00402384      2bc2           sub eax, edx
│   │╎╎││   0x00402386      8b54242c       mov edx, dword [var_2ch]
│   │╎╎││   0x0040238a      03d0           add edx, eax
│   │╎╎││   0x0040238c      8b442414       mov eax, dword [var_sp_14h]
│   │╎╎││   0x00402390      03c5           add eax, ebp
│   │╎╎││   0x00402392      03c1           add eax, ecx
│   │╎╎││   0x00402394      0fb62c30       movzx ebp, byte [eax + esi]
│   │╎╎││   0x00402398      8bc3           mov eax, ebx
│   │╎╎││   0x0040239a      2bc5           sub eax, ebp
│   │╎╎││   0x0040239c      8954242c       mov dword [var_2ch], edx
│   │╎╎││   0x004023a0      99             cdq
│   │╎╎││   0x004023a1      33c2           xor eax, edx
│   │╎╎││   0x004023a3      8b6c2434       mov ebp, dword [arg_30h]
│   │╎╎││   0x004023a7      2bc2           sub eax, edx
│   │╎╎││   0x004023a9      8b54242c       mov edx, dword [var_2ch]
│   │╎╎││   0x004023ad      03d0           add edx, eax
│   │╎╎││   0x004023af      8b442418       mov eax, dword [var_18h]
│   │╎╎││   0x004023b3      03c5           add eax, ebp
│   │╎╎││   0x004023b5      03c1           add eax, ecx
│   │╎╎││   0x004023b7      0fb62c30       movzx ebp, byte [eax + esi]
│   │╎╎││   0x004023bb      8954242c       mov dword [var_2ch], edx
│   │╎╎││   0x004023bf      8bc3           mov eax, ebx
│   │╎╎││   0x004023c1      2bc5           sub eax, ebp
│   │╎╎││   0x004023c3      8b2d3ca34000   mov ebp, dword [0x40a33c]   ; [0x40a33c:4]=0
│   │╎╎││   0x004023c9      99             cdq
│   │╎╎││   0x004023ca      33c2           xor eax, edx
│   │╎╎││   0x004023cc      2bc2           sub eax, edx
│   │╎╎││   0x004023ce      8b54242c       mov edx, dword [var_2ch]
│   │╎╎││   0x004023d2      03d0           add edx, eax
│   │╎╎││   0x004023d4      8b44243c       mov eax, dword [arg_34h]
│   │╎╎││   0x004023d8      03c5           add eax, ebp
│   │╎╎││   0x004023da      03c1           add eax, ecx
│   │╎╎││   0x004023dc      0fb60430       movzx eax, byte [eax + esi]
│   │╎╎││   0x004023e0      8944243c       mov dword [arg_34h], eax
│   │╎╎││   0x004023e4      8bc3           mov eax, ebx
│   │╎╎││   0x004023e6      8b5c243c       mov ebx, dword [arg_34h]
│   │╎╎││   0x004023ea      2bc3           sub eax, ebx
│   │╎╎││   0x004023ec      8954243c       mov dword [arg_34h], edx
│   │╎╎││   0x004023f0      99             cdq
│   │╎╎││   0x004023f1      33c2           xor eax, edx
│   │╎╎││   0x004023f3      2bc2           sub eax, edx
│   │╎╎││   0x004023f5      8b54243c       mov edx, dword [arg_34h]
│   │╎╎││   0x004023f9      03d0           add edx, eax
│   │╎╎││   0x004023fb      8b44241c       mov eax, dword [var_1ch]
│   │╎╎││   0x004023ff      8910           mov dword [eax], edx
│   │╎╎││   0x00402401      8b542434       mov edx, dword [arg_30h]
│  ┌──────< 0x00402405      e9d6000000     jmp 0x4024e0
│  ││╎╎││   ; CODE XREF from fcn.00402180 @ 0x4022b8(x)
│  │└─────> 0x0040240a      8b5724         mov edx, dword [edi + 0x24]
│  │ ╎╎││   0x0040240d      8b5c2428       mov ebx, dword [var_28h]
│  │ ╎╎││   0x00402411      0fafda         imul ebx, edx
│  │ ╎╎││   0x00402414      895c2418       mov dword [var_18h], ebx
│  │ ╎╎││   0x00402418      8b5c2438       mov ebx, dword [arg_28h]
│  │ ╎╎││   0x0040241c      2bdd           sub ebx, ebp
│  │ ╎╎││   0x0040241e      0fafda         imul ebx, edx
│  │ ╎╎││   0x00402421      8bc2           mov eax, edx
│  │ ╎╎││   0x00402423      0faf442420     imul eax, dword [var_20h]
│  │ ╎╎││   0x00402428      89442414       mov dword [var_sp_14h], eax
│  │ ╎╎││   0x0040242c      03d9           add ebx, ecx
│  │ ╎╎││   0x0040242e      0fb61c33       movzx ebx, byte [ebx + esi]
│  │ ╎╎││   0x00402432      8bc2           mov eax, edx
│  │ ╎╎││   0x00402434      0faf442438     imul eax, dword [arg_28h]
│  │ ╎╎││   0x00402439      8944243c       mov dword [arg_34h], eax
│  │ ╎╎││   0x0040243d      03c1           add eax, ecx
│  │ ╎╎││   0x0040243f      0fb60430       movzx eax, byte [eax + esi]
│  │ ╎╎││   0x00402443      03c0           add eax, eax
│  │ ╎╎││   0x00402445      03c0           add eax, eax
│  │ ╎╎││   0x00402447      03c0           add eax, eax
│  │ ╎╎││   0x00402449      2bc3           sub eax, ebx
│  │ ╎╎││   0x0040244b      8b5c2438       mov ebx, dword [arg_28h]
│  │ ╎╎││   0x0040244f      03dd           add ebx, ebp
│  │ ╎╎││   0x00402451      0fafda         imul ebx, edx
│  │ ╎╎││   0x00402454      03d9           add ebx, ecx
│  │ ╎╎││   0x00402456      0fb61433       movzx edx, byte [ebx + esi]
│  │ ╎╎││   0x0040245a      8b5c2414       mov ebx, dword [var_sp_14h]
│  │ ╎╎││   0x0040245e      2bc2           sub eax, edx
│  │ ╎╎││   0x00402460      8b542434       mov edx, dword [arg_30h]
│  │ ╎╎││   0x00402464      2bda           sub ebx, edx
│  │ ╎╎││   0x00402466      03d9           add ebx, ecx
│  │ ╎╎││   0x00402468      0fb61c33       movzx ebx, byte [ebx + esi]
│  │ ╎╎││   0x0040246c      2bc3           sub eax, ebx
│  │ ╎╎││   0x0040246e      8b5c2418       mov ebx, dword [var_18h]
│  │ ╎╎││   0x00402472      2bda           sub ebx, edx
│  │ ╎╎││   0x00402474      03d9           add ebx, ecx
│  │ ╎╎││   0x00402476      0fb61c33       movzx ebx, byte [ebx + esi]
│  │ ╎╎││   0x0040247a      2bc3           sub eax, ebx
│  │ ╎╎││   0x0040247c      8b5c243c       mov ebx, dword [arg_34h]
│  │ ╎╎││   0x00402480      2bdd           sub ebx, ebp
│  │ ╎╎││   0x00402482      03d9           add ebx, ecx
│  │ ╎╎││   0x00402484      0fb61c33       movzx ebx, byte [ebx + esi]
│  │ ╎╎││   0x00402488      2bc3           sub eax, ebx
│  │ ╎╎││   0x0040248a      8b5c2414       mov ebx, dword [var_sp_14h]
│  │ ╎╎││   0x0040248e      03da           add ebx, edx
│  │ ╎╎││   0x00402490      03d9           add ebx, ecx
│  │ ╎╎││   0x00402492      0fb61c33       movzx ebx, byte [ebx + esi]
│  │ ╎╎││   0x00402496      2bc3           sub eax, ebx
│  │ ╎╎││   0x00402498      8b5c2418       mov ebx, dword [var_18h]
│  │ ╎╎││   0x0040249c      03da           add ebx, edx
│  │ ╎╎││   0x0040249e      03d9           add ebx, ecx
│  │ ╎╎││   0x004024a0      0fb61c33       movzx ebx, byte [ebx + esi]
│  │ ╎╎││   0x004024a4      2bc3           sub eax, ebx
│  │ ╎╎││   0x004024a6      8b5c243c       mov ebx, dword [arg_34h]
│  │ ╎╎││   0x004024aa      03dd           add ebx, ebp
│  │ ╎╎││   0x004024ac      03d9           add ebx, ecx
│  │ ╎╎││   0x004024ae      0fb61c33       movzx ebx, byte [ebx + esi]
│  │ ╎╎││   0x004024b2      2bc3           sub eax, ebx
│  │ ╎╎││   0x004024b4      8b5c241c       mov ebx, dword [var_1ch]
│  │ ╎╎││   0x004024b8      8944243c       mov dword [arg_34h], eax
│  │ ╎╎││   0x004024bc      8903           mov dword [ebx], eax
│  │ ╎╎││   0x004024be      db44243c       fild dword [esp + 0x3c]
│  │ ╎╎││   0x004024c2      85c0           test eax, eax
│  │┌─────< 0x004024c4      7e0b           jle 0x4024d1
│  ││╎╎││   0x004024c6      d8473c         fadd dword [edi + 0x3c]
│  ││╎╎││   0x004024c9      ff4734         inc dword [edi + 0x34]
│  ││╎╎││   0x004024cc      d95f3c         fstp dword [edi + 0x3c]
│ ┌───────< 0x004024cf      eb09           jmp 0x4024da
│ │││╎╎││   ; CODE XREF from fcn.00402180 @ 0x4024c4(x)
│ ││└─────> 0x004024d1      d84740         fadd dword [edi + 0x40]
│ ││ ╎╎││   0x004024d4      ff4738         inc dword [edi + 0x38]
│ ││ ╎╎││   0x004024d7      d95f40         fstp dword [edi + 0x40]
│ ││ ╎╎││   ; CODE XREF from fcn.00402180 @ 0x4024cf(x)
│ └───────> 0x004024da      8b2d3ca34000   mov ebp, dword [0x40a33c]   ; [0x40a33c:4]=0
│  │ ╎╎││   ; CODE XREF from fcn.00402180 @ 0x402405(x)
│  └──────> 0x004024e0      8b4724         mov eax, dword [edi + 0x24]
│    ╎╎││   0x004024e3      2b0524a14000   sub eax, dword [0x40a124]   ; [0x40a124:4]=10
│    ╎╎││   0x004024e9      ff442424       inc dword [var_24h]
│    ╎╎││   0x004024ed      8144241c80..   add dword [var_1ch], 0x780  ; [0x780:4]=-1 ; 1920
│    ╎╎││   0x004024f5      41             inc ecx
│    ╎╎││   0x004024f6      3bc8           cmp ecx, eax
│    └────< 0x004024f8      0f8cb3fdffff   jl 0x4022b1
│     ╎││   0x004024fe      8b442438       mov eax, dword [arg_28h]
│     ╎││   ; CODE XREF from fcn.00402180 @ 0x402290(x)
│     ╎└──> 0x00402502      b901000000     mov ecx, 1
│     ╎ │   0x00402507      014c2410       add dword [var_10h], ecx
│     ╎ │   0x0040250b      014c2420       add dword [var_20h], ecx
│     ╎ │   0x0040250f      03c1           add eax, ecx
│     ╎ │   0x00402511      8b4f28         mov ecx, dword [edi + 0x28]
│     ╎ │   0x00402514      2b0d28a14000   sub ecx, dword [0x40a128]   ; [0x40a128:4]=10
│     ╎ │   0x0040251a      89442438       mov dword [arg_28h], eax
│     ╎ │   0x0040251e      3bc1           cmp eax, ecx
│     └───< 0x00402520      0f8c57fdffff   jl 0x40227d
│       │   0x00402526      8b5c2424       mov ebx, dword [var_24h]
│       │   0x0040252a      33c9           xor ecx, ecx
│       │   ; CODE XREF from fcn.00402180 @ 0x402267(x)
│       └─> 0x0040252c      d9473c         fld dword [edi + 0x3c]
│           0x0040252f      8b542410       mov edx, dword [var_10h]
│           0x00402533      da7734         fidiv dword [edi + 0x34]
│           0x00402536      d95f3c         fstp dword [edi + 0x3c]
│           0x00402539      d94740         fld dword [edi + 0x40]
│           0x0040253c      d9e0           fchs
│           0x0040253e      da7738         fidiv dword [edi + 0x38]
│           0x00402541      d95f40         fstp dword [edi + 0x40]
│           0x00402544      d9c9           fxch st(1)
│           0x00402546      891d4ca34000   mov dword [0x40a34c], ebx   ; [0x40a34c:4]=0
│           0x0040254c      891548a34000   mov dword [0x40a348], edx   ; [0x40a348:4]=0
│           0x00402552      d95754         fst dword [edi + 0x54]
│           0x00402555      d997cc000000   fst dword [edi + 0xcc]
│           0x0040255b      898f90000000   mov dword [edi + 0x90], ecx
│           0x00402561      d95758         fst dword [edi + 0x58]
│           0x00402564      898f08010000   mov dword [edi + 0x108], ecx
│           0x0040256a      d997d0000000   fst dword [edi + 0xd0]
│           0x00402570      898f94000000   mov dword [edi + 0x94], ecx
│           0x00402576      d9575c         fst dword [edi + 0x5c]
│           0x00402579      898f0c010000   mov dword [edi + 0x10c], ecx
│           0x0040257f      d997d4000000   fst dword [edi + 0xd4]
│           0x00402585      898f98000000   mov dword [edi + 0x98], ecx
│           0x0040258b      d95760         fst dword [edi + 0x60]
│           0x0040258e      898f10010000   mov dword [edi + 0x110], ecx
│           0x00402594      d997d8000000   fst dword [edi + 0xd8]
│           0x0040259a      898f9c000000   mov dword [edi + 0x9c], ecx
│           0x004025a0      d95764         fst dword [edi + 0x64]
│           0x004025a3      898f14010000   mov dword [edi + 0x114], ecx
│           0x004025a9      d997dc000000   fst dword [edi + 0xdc]
│           0x004025af      898fa0000000   mov dword [edi + 0xa0], ecx
│           0x004025b5      d95768         fst dword [edi + 0x68]
│           0x004025b8      898f18010000   mov dword [edi + 0x118], ecx
│           0x004025be      d997e0000000   fst dword [edi + 0xe0]
│           0x004025c4      898fa4000000   mov dword [edi + 0xa4], ecx
│           0x004025ca      d9576c         fst dword [edi + 0x6c]
│           0x004025cd      898f1c010000   mov dword [edi + 0x11c], ecx
│           0x004025d3      d997e4000000   fst dword [edi + 0xe4]
│           0x004025d9      898fa8000000   mov dword [edi + 0xa8], ecx
│           0x004025df      d95770         fst dword [edi + 0x70]
│           0x004025e2      898f20010000   mov dword [edi + 0x120], ecx
│           0x004025e8      d997e8000000   fst dword [edi + 0xe8]
│           0x004025ee      898fac000000   mov dword [edi + 0xac], ecx
│           0x004025f4      d95774         fst dword [edi + 0x74]
│           0x004025f7      898f24010000   mov dword [edi + 0x124], ecx
│           0x004025fd      d997ec000000   fst dword [edi + 0xec]
│           0x00402603      898fb0000000   mov dword [edi + 0xb0], ecx
│           0x00402609      d95778         fst dword [edi + 0x78]
│           0x0040260c      898f28010000   mov dword [edi + 0x128], ecx
│           0x00402612      d99ff0000000   fstp dword [edi + 0xf0]
│           0x00402618      898fb4000000   mov dword [edi + 0xb4], ecx
│           0x0040261e      898f2c010000   mov dword [edi + 0x12c], ecx
│           0x00402624      c7474c0100..   mov dword [edi + 0x4c], 1
│           ; CODE XREF from fcn.00402180 @ 0x402809(x)
│       ┌─> 0x0040262b      db474c         fild dword [edi + 0x4c]
│       ╎   0x0040262e      d8c9           fmul st(1)
│       ╎   0x00402630      e84b250000     call fcn.00404b80
│       ╎   0x00402635      8b2d28a14000   mov ebp, dword [0x40a128]   ; [0x40a128:4]=10
│       ╎   0x0040263b      8b5728         mov edx, dword [edi + 0x28]
│       ╎   0x0040263e      8bcd           mov ecx, ebp
│       ╎   0x00402640      2bd5           sub edx, ebp
│       ╎   0x00402642      3bca           cmp ecx, edx
│       ╎   0x00402644      89442418       mov dword [var_18h], eax
│       ╎   0x00402648      894c2438       mov dword [arg_28h], ecx
│      ┌──< 0x0040264c      0f8d6c010000   jge 0x4027be
│      │╎   0x00402652      8bd1           mov edx, ecx
│      │╎   0x00402654      2bd0           sub edx, eax
│      │╎   0x00402656      89542424       mov dword [var_24h], edx
│      │╎   ; CODE XREF from fcn.00402180 @ 0x4027b8(x)
│     ┌───> 0x0040265a      8b1524a14000   mov edx, dword [0x40a124]   ; [0x40a124:4]=10
│     ╎│╎   0x00402660      8b5f24         mov ebx, dword [edi + 0x24]
│     ╎│╎   0x00402663      2bda           sub ebx, edx
│     ╎│╎   0x00402665      3bd3           cmp edx, ebx
│    ┌────< 0x00402667      0f8d3b010000   jge 0x4027a8
│    │╎│╎   0x0040266d      03c1           add eax, ecx
│    │╎│╎   0x0040266f      8944242c       mov dword [var_2ch], eax
│    │╎│╎   0x00402673      8bc2           mov eax, edx
│    │╎│╎   0x00402675      69c0e0010000   imul eax, eax, 0x1e0        ; 480
│    │╎│╎   0x0040267b      03c1           add eax, ecx
│    │╎│╎   0x0040267d      8d048550a3..   lea eax, [eax*4 + 0x40a350]
│    │╎│╎   0x00402684      89442434       mov dword [arg_30h], eax
│    │╎│╎   ; CODE XREF from fcn.00402180 @ 0x40279c(x)
│   ┌─────> 0x00402688      8b5f24         mov ebx, dword [edi + 0x24]
│   ╎│╎│╎   0x0040268b      8b442424       mov eax, dword [var_24h]
│   ╎│╎│╎   0x0040268f      0fafc3         imul eax, ebx
│   ╎│╎│╎   0x00402692      8b6f4c         mov ebp, dword [edi + 0x4c]
│   ╎│╎│╎   0x00402695      89442428       mov dword [var_28h], eax
│   ╎│╎│╎   0x00402699      8bc3           mov eax, ebx
│   ╎│╎│╎   0x0040269b      0fafc1         imul eax, ecx
│   ╎│╎│╎   0x0040269e      8bcb           mov ecx, ebx
│   ╎│╎│╎   0x004026a0      0faf4c242c     imul ecx, dword [var_2ch]
│   ╎│╎│╎   0x004026a5      894c2420       mov dword [var_20h], ecx
│   ╎│╎│╎   0x004026a9      8b4c2438       mov ecx, dword [arg_28h]
│   ╎│╎│╎   0x004026ad      03cd           add ecx, ebp
│   ╎│╎│╎   0x004026af      0fafcb         imul ecx, ebx
│   ╎│╎│╎   0x004026b2      8944243c       mov dword [arg_34h], eax
│   ╎│╎│╎   0x004026b6      03c2           add eax, edx
│   ╎│╎│╎   0x004026b8      0fb60430       movzx eax, byte [eax + esi]
│   ╎│╎│╎   0x004026bc      03ca           add ecx, edx
│   ╎│╎│╎   0x004026be      0fb60c31       movzx ecx, byte [ecx + esi]
│   ╎│╎│╎   0x004026c2      03c0           add eax, eax
│   ╎│╎│╎   0x004026c4      03c0           add eax, eax
│   ╎│╎│╎   0x004026c6      894c241c       mov dword [var_1ch], ecx
│   ╎│╎│╎   0x004026ca      03c0           add eax, eax
│   ╎│╎│╎   0x004026cc      8bc8           mov ecx, eax
│   ╎│╎│╎   0x004026ce      8b44241c       mov eax, dword [var_1ch]
│   ╎│╎│╎   0x004026d2      2bc8           sub ecx, eax
│   ╎│╎│╎   0x004026d4      8b442438       mov eax, dword [arg_28h]
│   ╎│╎│╎   0x004026d8      2bc5           sub eax, ebp
│   ╎│╎│╎   0x004026da      0fafc3         imul eax, ebx
│   ╎│╎│╎   0x004026dd      8b5c2428       mov ebx, dword [var_28h]
│   ╎│╎│╎   0x004026e1      03c2           add eax, edx
│   ╎│╎│╎   0x004026e3      0fb60430       movzx eax, byte [eax + esi]
│   ╎│╎│╎   0x004026e7      2bc8           sub ecx, eax
│   ╎│╎│╎   0x004026e9      8b442418       mov eax, dword [var_18h]
│   ╎│╎│╎   0x004026ed      2bd8           sub ebx, eax
│   ╎│╎│╎   0x004026ef      03da           add ebx, edx
│   ╎│╎│╎   0x004026f1      0fb61c33       movzx ebx, byte [ebx + esi]
│   ╎│╎│╎   0x004026f5      2bcb           sub ecx, ebx
│   ╎│╎│╎   0x004026f7      8b5c243c       mov ebx, dword [arg_34h]
│   ╎│╎│╎   0x004026fb      2bdd           sub ebx, ebp
│   ╎│╎│╎   0x004026fd      03da           add ebx, edx
│   ╎│╎│╎   0x004026ff      0fb61c33       movzx ebx, byte [ebx + esi]
│   ╎│╎│╎   0x00402703      2bcb           sub ecx, ebx
│   ╎│╎│╎   0x00402705      8b5c2420       mov ebx, dword [var_20h]
│   ╎│╎│╎   0x00402709      2bd8           sub ebx, eax
│   ╎│╎│╎   0x0040270b      03da           add ebx, edx
│   ╎│╎│╎   0x0040270d      0fb61c33       movzx ebx, byte [ebx + esi]
│   ╎│╎│╎   0x00402711      2bcb           sub ecx, ebx
│   ╎│╎│╎   0x00402713      8b5c2428       mov ebx, dword [var_28h]
│   ╎│╎│╎   0x00402717      03d8           add ebx, eax
│   ╎│╎│╎   0x00402719      03da           add ebx, edx
│   ╎│╎│╎   0x0040271b      0fb61c33       movzx ebx, byte [ebx + esi]
│   ╎│╎│╎   0x0040271f      2bcb           sub ecx, ebx
│   ╎│╎│╎   0x00402721      8b5c243c       mov ebx, dword [arg_34h]
│   ╎│╎│╎   0x00402725      03eb           add ebp, ebx
│   ╎│╎│╎   0x00402727      03ea           add ebp, edx
│   ╎│╎│╎   0x00402729      0fb61c2e       movzx ebx, byte [esi + ebp]
│   ╎│╎│╎   0x0040272d      2bcb           sub ecx, ebx
│   ╎│╎│╎   0x0040272f      8b5c2420       mov ebx, dword [var_20h]
│   ╎│╎│╎   0x00402733      03d8           add ebx, eax
│   ╎│╎│╎   0x00402735      03da           add ebx, edx
│   ╎│╎│╎   0x00402737      0fb61c33       movzx ebx, byte [ebx + esi]
│   ╎│╎│╎   0x0040273b      2bcb           sub ecx, ebx
│   ╎│╎│╎   0x0040273d      8b5c2434       mov ebx, dword [arg_30h]
│   ╎│╎│╎   0x00402741      894c243c       mov dword [arg_34h], ecx
│   ╎│╎│╎   0x00402745      890b           mov dword [ebx], ecx
│   ╎│╎│╎   0x00402747      85c9           test ecx, ecx
│   ╎│╎│╎   0x00402749      db44243c       fild dword [esp + 0x3c]
│   ╎│╎│╎   0x0040274d      8b4f4c         mov ecx, dword [edi + 0x4c]
│  ┌──────< 0x00402750      7e16           jle 0x402768
│  │╎│╎│╎   0x00402752      d8448f50       fadd dword [edi + ecx*4 + 0x50]
│  │╎│╎│╎   0x00402756      8d4c8f50       lea ecx, [edi + ecx*4 + 0x50]
│  │╎│╎│╎   0x0040275a      d919           fstp dword [ecx]
│  │╎│╎│╎   0x0040275c      8b4f4c         mov ecx, dword [edi + 0x4c]
│  │╎│╎│╎   0x0040275f      8d8c8f8c00..   lea ecx, [edi + ecx*4 + 0x8c]
│ ┌───────< 0x00402766      eb1a           jmp 0x402782
│ ││╎│╎│╎   ; CODE XREF from fcn.00402180 @ 0x402750(x)
│ │└──────> 0x00402768      d8848fc800..   fadd dword [edi + ecx*4 + 0xc8]
│ │ ╎│╎│╎   0x0040276f      8d8c8fc800..   lea ecx, [edi + ecx*4 + 0xc8]
│ │ ╎│╎│╎   0x00402776      d919           fstp dword [ecx]
│ │ ╎│╎│╎   0x00402778      8b4f4c         mov ecx, dword [edi + 0x4c]
│ │ ╎│╎│╎   0x0040277b      8d8c8f0401..   lea ecx, [edi + ecx*4 + 0x104]
│ │ ╎│╎│╎   ; CODE XREF from fcn.00402180 @ 0x402766(x)
│ └───────> 0x00402782      ff01           inc dword [ecx]
│   ╎│╎│╎   0x00402784      8b4f24         mov ecx, dword [edi + 0x24]
│   ╎│╎│╎   0x00402787      2b0d24a14000   sub ecx, dword [0x40a124]   ; [0x40a124:4]=10
│   ╎│╎│╎   0x0040278d      8144243480..   add dword [arg_30h], 0x780  ; [0x780:4]=-1 ; 1920
│   ╎│╎│╎   0x00402795      42             inc edx
│   ╎│╎│╎   0x00402796      3bd1           cmp edx, ecx
│   ╎│╎│╎   0x00402798      8b4c2438       mov ecx, dword [arg_28h]
│   └─────< 0x0040279c      0f8ce6feffff   jl 0x402688
│    │╎│╎   0x004027a2      8b2d28a14000   mov ebp, dword [0x40a128]   ; [0x40a128:4]=10
│    │╎│╎   ; CODE XREF from fcn.00402180 @ 0x402667(x)
│    └────> 0x004027a8      8b5728         mov edx, dword [edi + 0x28]
│     ╎│╎   0x004027ab      ff442424       inc dword [var_24h]
│     ╎│╎   0x004027af      41             inc ecx
│     ╎│╎   0x004027b0      2bd5           sub edx, ebp
│     ╎│╎   0x004027b2      3bca           cmp ecx, edx
│     ╎│╎   0x004027b4      894c2438       mov dword [arg_28h], ecx
│     └───< 0x004027b8      0f8c9cfeffff   jl 0x40265a
│      │╎   ; CODE XREF from fcn.00402180 @ 0x40264c(x)
│      └──> 0x004027be      8b474c         mov eax, dword [edi + 0x4c]
│       ╎   0x004027c1      8b8c878c00..   mov ecx, dword [edi + eax*4 + 0x8c]
│       ╎   0x004027c8      894c2438       mov dword [arg_28h], ecx
│       ╎   0x004027cc      85c9           test ecx, ecx
│      ┌──< 0x004027ce      7e0c           jle 0x4027dc
│      │╎   0x004027d0      d9448750       fld dword [edi + eax*4 + 0x50]
│      │╎   0x004027d4      da742438       fidiv dword [esp + 0x38]
│      │╎   0x004027d8      d95c8750       fstp dword [edi + eax*4 + 0x50]
│      │╎   ; CODE XREF from fcn.00402180 @ 0x4027ce(x)
│      └──> 0x004027dc      8b474c         mov eax, dword [edi + 0x4c]
│       ╎   0x004027df      8b8c870401..   mov ecx, dword [edi + eax*4 + 0x104]
│       ╎   0x004027e6      894c2438       mov dword [arg_28h], ecx
│       ╎   0x004027ea      85c9           test ecx, ecx
│      ┌──< 0x004027ec      7e14           jle 0x402802
│      │╎   0x004027ee      d98487c800..   fld dword [edi + eax*4 + 0xc8]
│      │╎   0x004027f5      d9e0           fchs
│      │╎   0x004027f7      da742438       fidiv dword [esp + 0x38]
│      │╎   0x004027fb      d99c87c800..   fstp dword [edi + eax*4 + 0xc8]
│      │╎   ; CODE XREF from fcn.00402180 @ 0x4027ec(x)
│      └──> 0x00402802      ff474c         inc dword [edi + 0x4c]
│       ╎   0x00402805      837f4c0b       cmp dword [edi + 0x4c], 0xb
│       └─< 0x00402809      0f8c1cfeffff   jl 0x40262b
│           0x0040280f      8b4718         mov eax, dword [edi + 0x18]
│           0x00402812      ddd8           fstp st(0)
│           0x00402814      89471c         mov dword [edi + 0x1c], eax
│           0x00402817      40             inc eax
│           0x00402818      894718         mov dword [edi + 0x18], eax
│           0x0040281b      3d10270000     cmp eax, 0x2710             ; '\x10\''
│       ┌─< 0x00402820      7507           jne 0x402829
│       │   0x00402822      c747180000..   mov dword [edi + 0x18], 0
│       │   ; CODE XREF from fcn.00402180 @ 0x402820(x)
│       └─> 0x00402829      5f             pop edi
│           0x0040282a      5e             pop esi
│           0x0040282b      5d             pop ebp
│           0x0040282c      5b             pop ebx
│           0x0040282d      83c420         add esp, 0x20
└           0x00402830      c21000         ret 0x10

```

## 6. fcn.00402af0 完整反汇编原文

```asm
            ; CALL XREF from method.CListener.virtual_8 @ 0x404178(x)
┌ 5584: fcn.00402af0 (int32_t arg_114h, int32_t arg_118h, int32_t arg_11ch);
│ `- args(sp[0x4..0xc]) vars(77:sp[0x4..0x7b0])
│           0x00402af0      6aff           push 0xffffffffffffffff
│           0x00402af2      683e584000     push 0x40583e               ; '>X@'
│           0x00402af7      64a100000000   mov eax, dword fs:[0]
│           0x00402afd      50             push eax
│           0x00402afe      81ecf0000000   sub esp, 0xf0
│           0x00402b04      a178a24000     mov eax, dword [0x40a278]   ; [0x40a278:4]=0xbb40e64e
│           0x00402b09      33c4           xor eax, esp
│           0x00402b0b      898424ec00..   mov dword [var_ech], eax
│           0x00402b12      53             push ebx
│           0x00402b13      55             push ebp
│           0x00402b14      56             push esi
│           0x00402b15      57             push edi
│           0x00402b16      a178a24000     mov eax, dword [0x40a278]   ; [0x40a278:4]=0xbb40e64e
│           0x00402b1b      33c4           xor eax, esp
│           0x00402b1d      50             push eax
│           0x00402b1e      8d84240401..   lea eax, [var_104h]
│           0x00402b25      64a300000000   mov dword fs:[0], eax
│           0x00402b2b      8b84241401..   mov eax, dword [arg_114h]
│           0x00402b32      8bf1           mov esi, ecx
│           0x00402b34      8944242c       mov dword [var_2ch], eax
│           0x00402b38      837e0400       cmp dword [esi + 4], 0
│           0x00402b3c      c784240c01..   mov dword [var_10ch], 0
│       ┌─< 0x00402b47      0f843e150000   je 0x40408b
│       │   0x00402b4d      8b8c241c01..   mov ecx, dword [arg_11ch]
│       │   0x00402b54      85c9           test ecx, ecx
│      ┌──< 0x00402b56      0f842f150000   je 0x40408b
│      ││   0x00402b5c      837e0800       cmp dword [esi + 8], 0
│     ┌───< 0x00402b60      0f8425150000   je 0x40408b
│     │││   0x00402b66      8d542430       lea edx, [var_30h]
│     │││   0x00402b6a      52             push edx
│     │││   0x00402b6b      ff15a0614000   call dword [sym.imp.TIS_UDSHL08_vc9.dll__getBitmapInfoHeader_MemBuffer_DShowLib__QBE_AV__smart_ptr_UtagBITMAPINFOHEADER__V__refcount_ptr_UtagBITMAPINFOHEADER______XZ] ; 0x4061a0
│     │││   0x00402b71      8b8c241c01..   mov ecx, dword [arg_118h]
│     │││   0x00402b78      8b01           mov eax, dword [ecx]
│     │││   0x00402b7a      8b5004         mov edx, dword [eax + 4]
│     │││   0x00402b7d      c684240c01..   mov byte [var_10ch_2], 1
│     │││   0x00402b85      ffd2           call edx
│     │││   0x00402b87      8b4604         mov eax, dword [esi + 4]
│     │││   0x00402b8a      85c0           test eax, eax
│    ┌────< 0x00402b8c      7403           je 0x402b91
│    ││││   0x00402b8e      8b4020         mov eax, dword [eax + 0x20]
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x402b8c(x)
│    └────> 0x00402b91      50             push eax                    ; HWND hWnd
│     │││   0x00402b92      ff15c0614000   call dword [sym.imp.USER32.dll_GetDC] ; 0x4061c0 ; "@\x8b" ; HDC GetDC(HWND hWnd)
│     │││   0x00402b98      8bd8           mov ebx, eax
│     │││   0x00402b9a      53             push ebx
│     │││   0x00402b9b      895c242c       mov dword [var_2ch_2], ebx
│     │││   0x00402b9f      ff153c604000   call dword [sym.imp.GDI32.dll_CreateCompatibleDC] ; 0x40603c ; hdc CreateCompatibleDC(void)
│     │││   0x00402ba5      8b2d40604000   mov ebp, dword [sym.imp.GDI32.dll_SelectObject] ; [0x406040:4]=0x8b9c reloc.GDI32.dll_SelectObject
│     │││   0x00402bab      8bf8           mov edi, eax
│     │││   0x00402bad      8b4608         mov eax, dword [esi + 8]
│     │││   0x00402bb0      50             push eax
│     │││   0x00402bb1      57             push edi
│     │││   0x00402bb2      ffd5           call ebp
│     │││   0x00402bb4      6a03           push 3                      ; 3
│     │││   0x00402bb6      53             push ebx
│     │││   0x00402bb7      8b1d00604000   mov ebx, dword [sym.imp.GDI32.dll_SetStretchBltMode] ; [0x406000:4]=0x8c80 reloc.GDI32.dll_SetStretchBltMode
│     │││   0x00402bbd      ffd3           call ebx
│     │││   0x00402bbf      6a03           push 3                      ; 3
│     │││   0x00402bc1      57             push edi
│     │││   0x00402bc2      ffd3           call ebx
│     │││   0x00402bc4      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x00402bc7      8b542434       mov edx, dword [var_34h]
│     │││   0x00402bcb      8b5e28         mov ebx, dword [esi + 0x28]
│     │││   0x00402bce      682000cc00     push 0xcc0020               ; ' '
│     │││   0x00402bd3      894c241c       mov dword [var_1ch], ecx
│     │││   0x00402bd7      8b8c242001..   mov ecx, dword [var_120h]
│     │││   0x00402bde      8b01           mov eax, dword [ecx]
│     │││   0x00402be0      6a00           push 0
│     │││   0x00402be2      52             push edx
│     │││   0x00402be3      8b5004         mov edx, dword [eax + 4]
│     │││   0x00402be6      ffd2           call edx
│     │││   0x00402be8      50             push eax
│     │││   0x00402be9      8b442428       mov eax, dword [var_1ch]
│     │││   0x00402bed      53             push ebx
│     │││   0x00402bee      50             push eax
│     │││   0x00402bef      6a00           push 0
│     │││   0x00402bf1      6a00           push 0
│     │││   0x00402bf3      53             push ebx
│     │││   0x00402bf4      50             push eax
│     │││   0x00402bf5      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00402bf8      6a00           push 0
│     │││   0x00402bfa      50             push eax                    ; int XDest
│     │││   0x00402bfb      57             push edi                    ; HDC hdc
│     │││   0x00402bfc      ff1504604000   call dword [sym.imp.GDI32.dll_StretchDIBits] ; 0x406004 ; "p\x8c" ; _gdi_error StretchDIBits(HDC hdc, int XDest, int YDest, int nDestWidth, int nDestHeight, int XSrc, int YSrc, int nSrcWidth, int nSrcHeight, VOID *lpBits, BITMAPINFO *lpBitsInfo, _DIB_Color iUsage, _TernaryDrawMode dwRop)
│     │││   0x00402c02      68ff000000     push 0xff                   ; 255 ; COLORREF crColor
│     │││   0x00402c07      57             push edi                    ; HDC hdc
│     │││   0x00402c08      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x00402c0e      6a02           push 2                      ; 2 ; int iBkMode
│     │││   0x00402c10      57             push edi                    ; HDC hdc
│     │││   0x00402c11      ff150c604000   call dword [sym.imp.GDI32.dll_SetBkMode] ; 0x40600c ; "T\x8c" ; long SetBkMode(HDC hdc, int iBkMode)
│     │││   0x00402c17      d9460c         fld dword [esi + 0xc]
│     │││   0x00402c1a      dc1de8734000   fcomp qword [0x4073e8]
│     │││   0x00402c20      8b1d10604000   mov ebx, dword [sym.imp.GDI32.dll_TextOutA] ; [0x406010:4]=0x8c48 reloc.GDI32.dll_TextOutA ; "H\x8c"
│     │││   0x00402c26      dfe0           fnstsw ax
│     │││   0x00402c28      f6c441         test ah, 0x41               ; 65
│    ┌────< 0x00402c2b      7537           jne 0x402c64
│    ││││   0x00402c2d      8d4c2438       lea ecx, [s]
│    ││││   0x00402c31      68bc734000     push 0x4073bc               ; " IMAGE TOO BRIGHT - reduce camera aperture " ; const char *format
│    ││││   0x00402c36      51             push ecx                    ; char *s
│    ││││   0x00402c37      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│    ││││   0x00402c3d      8d442440       lea eax, [s]
│    ││││   0x00402c41      83c408         add esp, 8
│    ││││   0x00402c44      8d5001         lea edx, [eax + 1]
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x402c4c(x)
│   ┌─────> 0x00402c47      8a08           mov cl, byte [eax]
│   ╎││││   0x00402c49      40             inc eax
│   ╎││││   0x00402c4a      84c9           test cl, cl
│   └─────< 0x00402c4c      75f9           jne 0x402c47
│    ││││   0x00402c4e      2bc2           sub eax, edx
│    ││││   0x00402c50      50             push eax
│    ││││   0x00402c51      8b462c         mov eax, dword [esi + 0x2c]
│    ││││   0x00402c54      8d54243c       lea edx, [s]
│    ││││   0x00402c58      52             push edx
│    ││││   0x00402c59      6a64           push 0x64                   ; 'd' ; 100
│    ││││   0x00402c5b      05c8000000     add eax, 0xc8               ; 200
│    ││││   0x00402c60      50             push eax
│    ││││   0x00402c61      57             push edi
│    ││││   0x00402c62      ffd3           call ebx
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x402c2b(x)
│    └────> 0x00402c64      d905b8734000   fld dword [0x4073b8]
│     │││   0x00402c6a      d85e0c         fcomp dword [esi + 0xc]
│     │││   0x00402c6d      dfe0           fnstsw ax
│     │││   0x00402c6f      f6c441         test ah, 0x41               ; 65
│    ┌────< 0x00402c72      7539           jne 0x402cad
│    ││││   0x00402c74      8d4c2438       lea ecx, [s]
│    ││││   0x00402c78      6890734000     push str._IMAGE_TOO_DARK___open_camera_aperture ; 0x407390 ; " IMAGE TOO DARK - open camera aperture"
│    ││││   0x00402c7d      51             push ecx                    ; char *s
│    ││││   0x00402c7e      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│    ││││   0x00402c84      8d442440       lea eax, [s]
│    ││││   0x00402c88      83c408         add esp, 8
│    ││││   0x00402c8b      8d5001         lea edx, [eax + 1]
│    ││││   0x00402c8e      8bff           mov edi, edi
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x402c95(x)
│   ┌─────> 0x00402c90      8a08           mov cl, byte [eax]
│   ╎││││   0x00402c92      40             inc eax
│   ╎││││   0x00402c93      84c9           test cl, cl
│   └─────< 0x00402c95      75f9           jne 0x402c90
│    ││││   0x00402c97      2bc2           sub eax, edx
│    ││││   0x00402c99      50             push eax
│    ││││   0x00402c9a      8b462c         mov eax, dword [esi + 0x2c]
│    ││││   0x00402c9d      8d54243c       lea edx, [s]
│    ││││   0x00402ca1      52             push edx
│    ││││   0x00402ca2      6a64           push 0x64                   ; 'd' ; 100
│    ││││   0x00402ca4      05c8000000     add eax, 0xc8               ; 200
│    ││││   0x00402ca9      50             push eax
│    ││││   0x00402caa      57             push edi
│    ││││   0x00402cab      ffd3           call ebx
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x402c72(x)
│    └────> 0x00402cad      8d4c2438       lea ecx, [s]
│     │││   0x00402cb1      6864734000     push str.__press_space_bar_to_interrupt_or_re_start ; 0x407364 ; "  press space bar to interrupt or re-start"
│     │││   0x00402cb6      51             push ecx                    ; char *s
│     │││   0x00402cb7      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00402cbd      8d442440       lea eax, [s]
│     │││   0x00402cc1      83c408         add esp, 8
│     │││   0x00402cc4      8d5001         lea edx, [eax + 1]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x402ccc(x)
│    ┌────> 0x00402cc7      8a08           mov cl, byte [eax]
│    ╎│││   0x00402cc9      40             inc eax
│    ╎│││   0x00402cca      84c9           test cl, cl
│    └────< 0x00402ccc      75f9           jne 0x402cc7
│     │││   0x00402cce      2bc2           sub eax, edx
│     │││   0x00402cd0      50             push eax
│     │││   0x00402cd1      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00402cd4      8d54243c       lea edx, [s]
│     │││   0x00402cd8      52             push edx
│     │││   0x00402cd9      68cc010000     push 0x1cc                  ; 460
│     │││   0x00402cde      05fa000000     add eax, 0xfa               ; 250
│     │││   0x00402ce3      50             push eax
│     │││   0x00402ce4      57             push edi
│     │││   0x00402ce5      ffd3           call ebx
│     │││   0x00402ce7      6a01           push 1                      ; 1 ; int iBkMode
│     │││   0x00402ce9      57             push edi                    ; HDC hdc
│     │││   0x00402cea      ff150c604000   call dword [sym.imp.GDI32.dll_SetBkMode] ; 0x40600c ; "T\x8c" ; long SetBkMode(HDC hdc, int iBkMode)
│     │││   0x00402cf0      d9460c         fld dword [esi + 0xc]
│     │││   0x00402cf3      83ec08         sub esp, 8
│     │││   0x00402cf6      dd1c24         fstp qword [esp]
│     │││   0x00402cf9      8d4c2440       lea ecx, [var_40h]
│     │││   0x00402cfd      6848734000     push str.average_pixel_value___2.1f ; 0x407348 ; "average pixel value = %2.1f"
│     │││   0x00402d02      51             push ecx                    ; char *s
│     │││   0x00402d03      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00402d09      8d442448       lea eax, [var_40h]
│     │││   0x00402d0d      83c410         add esp, 0x10
│     │││   0x00402d10      8d4801         lea ecx, [eax + 1]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x402d18(x)
│    ┌────> 0x00402d13      8a10           mov dl, byte [eax]
│    ╎│││   0x00402d15      40             inc eax
│    ╎│││   0x00402d16      84d2           test dl, dl
│    └────< 0x00402d18      75f9           jne 0x402d13
│     │││   0x00402d1a      2bc1           sub eax, ecx
│     │││   0x00402d1c      50             push eax
│     │││   0x00402d1d      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00402d20      8d54243c       lea edx, [var_40h]
│     │││   0x00402d24      52             push edx
│     │││   0x00402d25      6a00           push 0
│     │││   0x00402d27      83c00a         add eax, 0xa
│     │││   0x00402d2a      50             push eax
│     │││   0x00402d2b      57             push edi
│     │││   0x00402d2c      ffd3           call ebx
│     │││   0x00402d2e      8b4e18         mov ecx, dword [esi + 0x18]
│     │││   0x00402d31      51             push ecx
│     │││   0x00402d32      8d54243c       lea edx, [var_3ch]
│     │││   0x00402d36      6834734000     push str.frame_number___d   ; 0x407334 ; "frame number = %d"
│     │││   0x00402d3b      52             push edx                    ; char *s
│     │││   0x00402d3c      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00402d42      8d442444       lea eax, [var_3ch]
│     │││   0x00402d46      83c40c         add esp, 0xc
│     │││   0x00402d49      8d4801         lea ecx, [eax + 1]
│     │││   0x00402d4c      8d642400       lea esp, [esp]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x402d55(x)
│    ┌────> 0x00402d50      8a10           mov dl, byte [eax]
│    ╎│││   0x00402d52      40             inc eax
│    ╎│││   0x00402d53      84d2           test dl, dl
│    └────< 0x00402d55      75f9           jne 0x402d50
│     │││   0x00402d57      2bc1           sub eax, ecx
│     │││   0x00402d59      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x00402d5c      50             push eax
│     │││   0x00402d5d      8d44243c       lea eax, [var_3ch]
│     │││   0x00402d61      50             push eax
│     │││   0x00402d62      6a00           push 0
│     │││   0x00402d64      81c1db010000   add ecx, 0x1db              ; 475
│     │││   0x00402d6a      51             push ecx
│     │││   0x00402d6b      57             push edi
│     │││   0x00402d6c      ffd3           call ebx
│     │││   0x00402d6e      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x00402d71      52             push edx
│     │││   0x00402d72      8d44243c       lea eax, [var_3ch_2]
│     │││   0x00402d76      681c734000     push str.video_frame_width___2d ; 0x40731c ; "video frame width = %2d"
│     │││   0x00402d7b      50             push eax                    ; char *s
│     │││   0x00402d7c      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00402d82      8d442444       lea eax, [var_3ch_2]
│     │││   0x00402d86      83c40c         add esp, 0xc
│     │││   0x00402d89      8d4801         lea ecx, [eax + 1]
│     │││   0x00402d8c      8d642400       lea esp, [esp]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x402d95(x)
│    ┌────> 0x00402d90      8a10           mov dl, byte [eax]
│    ╎│││   0x00402d92      40             inc eax
│    ╎│││   0x00402d93      84d2           test dl, dl
│    └────< 0x00402d95      75f9           jne 0x402d90
│     │││   0x00402d97      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x00402d9a      2bc1           sub eax, ecx
│     │││   0x00402d9c      50             push eax
│     │││   0x00402d9d      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00402da0      8d4c243c       lea ecx, [var_3ch_2]
│     │││   0x00402da4      51             push ecx
│     │││   0x00402da5      83ea23         sub edx, 0x23               ; 35
│     │││   0x00402da8      52             push edx
│     │││   0x00402da9      83c00a         add eax, 0xa
│     │││   0x00402dac      50             push eax
│     │││   0x00402dad      57             push edi
│     │││   0x00402dae      ffd3           call ebx
│     │││   0x00402db0      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x00402db3      51             push ecx
│     │││   0x00402db4      8d54243c       lea edx, [var_3ch_3]
│     │││   0x00402db8      6800734000     push str.video_frame_height___2d ; 0x407300 ; "video frame height = %2d"
│     │││   0x00402dbd      52             push edx                    ; char *s
│     │││   0x00402dbe      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00402dc4      8d442444       lea eax, [var_3ch_3]
│     │││   0x00402dc8      83c40c         add esp, 0xc
│     │││   0x00402dcb      8d4801         lea ecx, [eax + 1]
│     │││   0x00402dce      8bff           mov edi, edi
│     │││   ; CODE XREF from fcn.00402af0 @ 0x402dd5(x)
│    ┌────> 0x00402dd0      8a10           mov dl, byte [eax]
│    ╎│││   0x00402dd2      40             inc eax
│    ╎│││   0x00402dd3      84d2           test dl, dl
│    └────< 0x00402dd5      75f9           jne 0x402dd0
│     │││   0x00402dd7      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x00402dda      2bc1           sub eax, ecx
│     │││   0x00402ddc      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x00402ddf      50             push eax
│     │││   0x00402de0      8d44243c       lea eax, [var_3ch_3]
│     │││   0x00402de4      50             push eax
│     │││   0x00402de5      83e914         sub ecx, 0x14               ; 20
│     │││   0x00402de8      51             push ecx
│     │││   0x00402de9      83c20a         add edx, 0xa
│     │││   0x00402dec      52             push edx
│     │││   0x00402ded      57             push edi
│     │││   0x00402dee      ffd3           call ebx
│     │││   0x00402df0      6a00           push 0
│     │││   0x00402df2      57             push edi                    ; HDC hdc
│     │││   0x00402df3      ff1514604000   call dword [sym.imp.GDI32.dll_SetBkColor] ; 0x406014 ; ":\x8c" ; colorref_return SetBkColor(HDC hdc, COLORREF crColor)
│     │││   0x00402df9      68ff64ff00     push 0xff64ff               ; COLORREF crColor
│     │││   0x00402dfe      57             push edi                    ; HDC hdc
│     │││   0x00402dff      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x00402e05      68ffff6400     push 0x64ffff
│     │││   0x00402e0a      6a01           push 1                      ; 1
│     │││   0x00402e0c      6a00           push 0
│     │││   0x00402e0e      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x00402e14      50             push eax
│     │││   0x00402e15      57             push edi
│     │││   0x00402e16      8944241c       mov dword [var_1ch_2], eax
│     │││   0x00402e1a      ffd5           call ebp
│     │││   0x00402e1c      6a05           push 5                      ; 5
│     │││   0x00402e1e      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x00402e24      50             push eax
│     │││   0x00402e25      57             push edi
│     │││   0x00402e26      ffd5           call ebp
│     │││   0x00402e28      8b153ca34000   mov edx, dword [0x40a33c]   ; [0x40a33c:4]=0
│     │││   0x00402e2e      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00402e31      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x00402e34      8d9c1038ff..   lea ebx, [eax + edx - 0xc8]
│     │││   0x00402e3b      53             push ebx
│     │││   0x00402e3c      8d5c1164       lea ebx, [ecx + edx + 0x64]
│     │││   0x00402e40      53             push ebx
│     │││   0x00402e41      8b1d20604000   mov ebx, dword [sym.imp.GDI32.dll_Ellipse] ; [0x406020:4]=0x8c12 reloc.GDI32.dll_Ellipse
│     │││   0x00402e47      2bc2           sub eax, edx
│     │││   0x00402e49      2dc8000000     sub eax, 0xc8               ; 200
│     │││   0x00402e4e      2bca           sub ecx, edx
│     │││   0x00402e50      50             push eax
│     │││   0x00402e51      83c164         add ecx, 0x64               ; 100
│     │││   0x00402e54      51             push ecx
│     │││   0x00402e55      57             push edi
│     │││   0x00402e56      ffd3           call ebx
│     │││   0x00402e58      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00402e5b      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x00402e5e      8d9039ffffff   lea edx, [eax - 0xc7]
│     │││   0x00402e64      52             push edx
│     │││   0x00402e65      8d5165         lea edx, [ecx + 0x65]
│     │││   0x00402e68      52             push edx
│     │││   0x00402e69      0537ffffff     add eax, 0xffffff37         ; 4294967095
│     │││   0x00402e6e      50             push eax
│     │││   0x00402e6f      83c163         add ecx, 0x63               ; 99
│     │││   0x00402e72      51             push ecx
│     │││   0x00402e73      57             push edi
│     │││   0x00402e74      ffd3           call ebx
│     │││   0x00402e76      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00402e79      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x00402e7c      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x00402e7f      51             push ecx
│     │││   0x00402e80      03d0           add edx, eax
│     │││   0x00402e82      52             push edx
│     │││   0x00402e83      6a00           push 0
│     │││   0x00402e85      50             push eax                    ; int nLeftRect
│     │││   0x00402e86      57             push edi                    ; HDC hdc
│     │││   0x00402e87      ff1524604000   call dword [sym.imp.GDI32.dll_Rectangle] ; 0x406024 ; bool Rectangle(HDC hdc, int nLeftRect, int nTopRect, int nRightRect, int nBottomRect)
│     │││   0x00402e8d      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00402e90      8b1528a14000   mov edx, dword [0x40a128]   ; [0x40a128:4]=10
│     │││   0x00402e96      8b0d24a14000   mov ecx, dword [0x40a124]   ; [0x40a124:4]=10
│     │││   0x00402e9c      8d1452         lea edx, [edx + edx*2]
│     │││   0x00402e9f      8bd8           mov ebx, eax
│     │││   0x00402ea1      2bda           sub ebx, edx
│     │││   0x00402ea3      81c3e1010000   add ebx, 0x1e1              ; 481
│     │││   0x00402ea9      03c9           add ecx, ecx
│     │││   0x00402eab      ba81020000     mov edx, 0x281              ; 641
│     │││   0x00402eb0      53             push ebx                    ; int nBottomRect
│     │││   0x00402eb1      2bd1           sub edx, ecx
│     │││   0x00402eb3      52             push edx                    ; int nRightRect
│     │││   0x00402eb4      8b1528a14000   mov edx, dword [0x40a128]   ; [0x40a128:4]=10
│     │││   0x00402eba      8d4410ff       lea eax, [eax + edx - 1]
│     │││   0x00402ebe      50             push eax                    ; int nTopRect
│     │││   0x00402ebf      49             dec ecx
│     │││   0x00402ec0      51             push ecx                    ; int nLeftRect
│     │││   0x00402ec1      57             push edi                    ; HDC hdc
│     │││   0x00402ec2      ff1524604000   call dword [sym.imp.GDI32.dll_Rectangle] ; 0x406024 ; bool Rectangle(HDC hdc, int nLeftRect, int nTopRect, int nRightRect, int nBottomRect)
│     │││   0x00402ec8      8b4c2414       mov ecx, dword [var_14h]
│     │││   0x00402ecc      51             push ecx
│     │││   0x00402ecd      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00402ed3      833d38a340..   cmp dword [0x40a338], 1     ; [0x40a338:4]=0
│    ┌────< 0x00402eda      0f859c010000   jne 0x40307c
│    ││││   0x00402ee0      baf0000000     mov edx, 0xf0               ; 240
│    ││││   0x00402ee5      2b1528a14000   sub edx, dword [0x40a128]   ; [0x40a128:4]=10
│    ││││   0x00402eeb      b840010000     mov eax, 0x140              ; 320
│    ││││   0x00402ef0      2b0524a14000   sub eax, dword [0x40a124]   ; [0x40a124:4]=10
│    ││││   0x00402ef6      03d2           add edx, edx
│    ││││   0x00402ef8      52             push edx
│    ││││   0x00402ef9      03c0           add eax, eax
│    ││││   0x00402efb      50             push eax
│    ││││   0x00402efc      e8efefffff     call fcn.00401ef0
│    ││││   0x00402f01      8b4e28         mov ecx, dword [esi + 0x28]
│    ││││   0x00402f04      8b1528a14000   mov edx, dword [0x40a128]   ; [0x40a128:4]=10
│    ││││   0x00402f0a      a124a14000     mov eax, dword [0x40a124]   ; [0x40a124:4]=10
│    ││││   0x00402f0f      8d4c1114       lea ecx, [ecx + edx + 0x14]
│    ││││   0x00402f13      83c1ec         add ecx, 0xffffffec
│    ││││   0x00402f16      51             push ecx
│    ││││   0x00402f17      03c0           add eax, eax
│    ││││   0x00402f19      50             push eax
│    ││││   0x00402f1a      57             push edi
│    ││││   0x00402f1b      e850f1ffff     call fcn.00402070
│    ││││   0x00402f20      83c414         add esp, 0x14
│    ││││   0x00402f23      68ffffff00     push 0xffffff               ; COLORREF crColor
│    ││││   0x00402f28      57             push edi                    ; HDC hdc
│    ││││   0x00402f29      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│    ││││   0x00402f2f      6a00           push 0
│    ││││   0x00402f31      57             push edi                    ; HDC hdc
│    ││││   0x00402f32      ff1514604000   call dword [sym.imp.GDI32.dll_SetBkColor] ; 0x406014 ; ":\x8c" ; colorref_return SetBkColor(HDC hdc, COLORREF crColor)
│    ││││   0x00402f38      6a02           push 2                      ; 2 ; int iBkMode
│    ││││   0x00402f3a      57             push edi                    ; HDC hdc
│    ││││   0x00402f3b      ff150c604000   call dword [sym.imp.GDI32.dll_SetBkMode] ; 0x40600c ; "T\x8c" ; long SetBkMode(HDC hdc, int iBkMode)
│    ││││   0x00402f41      a148a34000     mov eax, dword [0x40a348]   ; [0x40a348:4]=0
│    ││││   0x00402f46      0faf054ca3..   imul eax, dword [0x40a34c]  ; [0x40a34c:4]=0
│    ││││   0x00402f4d      89442418       mov dword [var_18h_7], eax
│    ││││   0x00402f51      83ec08         sub esp, 8
│    ││││   0x00402f54      8d4c2440       lea ecx, [var_40h_5]
│    ││││   0x00402f58      db442420       fild dword [esp + 0x20]
│    ││││   0x00402f5c      dd1c24         fstp qword [esp]
│    ││││   0x00402f5f      68d4724000     push str._number_of_receptive_fields___6.0f ; 0x4072d4 ; " number of receptive fields = %6.0f"
│    ││││   0x00402f64      51             push ecx                    ; char *s
│    ││││   0x00402f65      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│    ││││   0x00402f6b      8d442448       lea eax, [var_40h_5]
│    ││││   0x00402f6f      83c410         add esp, 0x10
│    ││││   0x00402f72      8d4801         lea ecx, [eax + 1]
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x402f7a(x)
│   ┌─────> 0x00402f75      8a10           mov dl, byte [eax]
│   ╎││││   0x00402f77      40             inc eax
│   ╎││││   0x00402f78      84d2           test dl, dl
│   └─────< 0x00402f7a      75f9           jne 0x402f75
│    ││││   0x00402f7c      8b1d10604000   mov ebx, dword [sym.imp.GDI32.dll_TextOutA] ; [0x406010:4]=0x8c48 reloc.GDI32.dll_TextOutA ; "H\x8c"
│    ││││   0x00402f82      2bc1           sub eax, ecx
│    ││││   0x00402f84      50             push eax
│    ││││   0x00402f85      8b4628         mov eax, dword [esi + 0x28]
│    ││││   0x00402f88      8d54243c       lea edx, [var_40h_5]
│    ││││   0x00402f8c      52             push edx
│    ││││   0x00402f8d      83c00f         add eax, 0xf                ; 15
│    ││││   0x00402f90      50             push eax
│    ││││   0x00402f91      6a28           push 0x28                   ; '(' ; 40
│    ││││   0x00402f93      57             push edi
│    ││││   0x00402f94      ffd3           call ebx
│    ││││   0x00402f96      6a01           push 1                      ; 1 ; int iBkMode
│    ││││   0x00402f98      57             push edi                    ; HDC hdc
│    ││││   0x00402f99      ff150c604000   call dword [sym.imp.GDI32.dll_SetBkMode] ; 0x40600c ; "T\x8c" ; long SetBkMode(HDC hdc, int iBkMode)
│    ││││   0x00402f9f      68ffffff00     push 0xffffff               ; COLORREF crColor
│    ││││   0x00402fa4      57             push edi                    ; HDC hdc
│    ││││   0x00402fa5      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│    ││││   0x00402fab      833d34a340..   cmp dword [0x40a334], 1     ; [0x40a334:4]=0
│   ┌─────< 0x00402fb2      753c           jne 0x402ff0
│   │││││   0x00402fb4      8d4c2438       lea ecx, [var_3ch_8]
│   │││││   0x00402fb8      6898724000     push str.________________absolute_delta ; 0x407298 ; "                absolute delta"
│   │││││   0x00402fbd      51             push ecx                    ; char *s
│   │││││   0x00402fbe      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│   │││││   0x00402fc4      8d442440       lea eax, [var_3ch_8]
│   │││││   0x00402fc8      83c408         add esp, 8
│   │││││   0x00402fcb      8d5001         lea edx, [eax + 1]
│   │││││   0x00402fce      8bff           mov edi, edi
│   │││││   ; CODE XREF from fcn.00402af0 @ 0x402fd5(x)
│  ┌──────> 0x00402fd0      8a08           mov cl, byte [eax]
│  ╎│││││   0x00402fd2      40             inc eax
│  ╎│││││   0x00402fd3      84c9           test cl, cl
│  └──────< 0x00402fd5      75f9           jne 0x402fd0
│   │││││   0x00402fd7      2bc2           sub eax, edx
│   │││││   0x00402fd9      50             push eax
│   │││││   0x00402fda      8b4628         mov eax, dword [esi + 0x28]
│   │││││   0x00402fdd      8d54243c       lea edx, [var_3ch_8]
│   │││││   0x00402fe1      52             push edx
│   │││││   0x00402fe2      83c032         add eax, 0x32               ; 50
│   │││││   0x00402fe5      50             push eax
│   │││││   0x00402fe6      68fa000000     push 0xfa                   ; 250
│  ┌──────< 0x00402feb      e989000000     jmp 0x403079
│  ││││││   ; CODE XREF from fcn.00402af0 @ 0x402fb2(x)
│  │└─────> 0x00402ff0      8b0d3ca34000   mov ecx, dword [0x40a33c]   ; [0x40a33c:4]=0
│  │ ││││   0x00402ff6      51             push ecx
│  │ ││││   0x00402ff7      8d54243c       lea edx, [var_3ch_8]
│  │ ││││   0x00402ffb      6840724000     push str._ON_output_is_in_red__OFF_output_in_blue__for_receptive_field__RF__radius_of__d_pixel ; 0x407240 ; " ON output is in red, OFF output in blue, for receptive field (RF) radius of %d pixel"
│  │ ││││   0x00403000      52             push edx                    ; char *s
│  │ ││││   0x00403001      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│  │ ││││   0x00403007      8d442444       lea eax, [var_3ch_8]
│  │ ││││   0x0040300b      83c40c         add esp, 0xc
│  │ ││││   0x0040300e      8d5001         lea edx, [eax + 1]
│  │ ││││   ; CODE XREF from fcn.00402af0 @ 0x403016(x)
│  │┌─────> 0x00403011      8a08           mov cl, byte [eax]
│  │╎││││   0x00403013      40             inc eax
│  │╎││││   0x00403014      84c9           test cl, cl
│  │└─────< 0x00403016      75f9           jne 0x403011
│  │ ││││   0x00403018      8b4e28         mov ecx, dword [esi + 0x28]
│  │ ││││   0x0040301b      2bc2           sub eax, edx
│  │ ││││   0x0040301d      50             push eax
│  │ ││││   0x0040301e      8d44243c       lea eax, [var_3ch_8]
│  │ ││││   0x00403022      50             push eax
│  │ ││││   0x00403023      83c11e         add ecx, 0x1e               ; 30
│  │ ││││   0x00403026      51             push ecx
│  │ ││││   0x00403027      6a28           push 0x28                   ; '(' ; 40
│  │ ││││   0x00403029      57             push edi
│  │ ││││   0x0040302a      ffd3           call ebx
│  │ ││││   0x0040302c      d94640         fld dword [esi + 0x40]
│  │ ││││   0x0040302f      8b5638         mov edx, dword [esi + 0x38]
│  │ ││││   0x00403032      8b4634         mov eax, dword [esi + 0x34]
│  │ ││││   0x00403035      52             push edx
│  │ ││││   0x00403036      83ec08         sub esp, 8
│  │ ││││   0x00403039      dd1c24         fstp qword [esp]
│  │ ││││   0x0040303c      50             push eax
│  │ ││││   0x0040303d      d9463c         fld dword [esi + 0x3c]
│  │ ││││   0x00403040      83ec08         sub esp, 8
│  │ ││││   0x00403043      dd1c24         fstp qword [esp]
│  │ ││││   0x00403046      8d4c2450       lea ecx, [var_50h]
│  │ ││││   0x0040304a      68f0714000     push str._ave_ON_contrast___3.1f___d_ON_RFs___ave_OFF_contrast___3.1f___d_OFF_RFs_ ; 0x4071f0 ; " ave ON contrast = %3.1f (%d ON RFs), ave OFF contrast = %3.1f (%d OFF RFs)"
│  │ ││││   0x0040304f      51             push ecx                    ; char *s
│  │ ││││   0x00403050      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│  │ ││││   0x00403056      8d442458       lea eax, [var_50h]
│  │ ││││   0x0040305a      83c420         add esp, 0x20
│  │ ││││   0x0040305d      8d4801         lea ecx, [eax + 1]
│  │ ││││   ; CODE XREF from fcn.00402af0 @ 0x403065(x)
│  │┌─────> 0x00403060      8a10           mov dl, byte [eax]
│  │╎││││   0x00403062      40             inc eax
│  │╎││││   0x00403063      84d2           test dl, dl
│  │└─────< 0x00403065      75f9           jne 0x403060
│  │ ││││   0x00403067      2bc1           sub eax, ecx
│  │ ││││   0x00403069      50             push eax
│  │ ││││   0x0040306a      8b4628         mov eax, dword [esi + 0x28]
│  │ ││││   0x0040306d      8d54243c       lea edx, [var_50h]
│  │ ││││   0x00403071      52             push edx
│  │ ││││   0x00403072      8d4c00ce       lea ecx, [eax + eax - 0x32]
│  │ ││││   0x00403076      51             push ecx
│  │ ││││   0x00403077      6a28           push 0x28                   ; '(' ; 40
│  │ ││││   ; CODE XREF from fcn.00402af0 @ 0x402feb(x)
│  └──────> 0x00403079      57             push edi
│    ││││   0x0040307a      ffd3           call ebx
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x402eda(x)
│    └────> 0x0040307c      6a02           push 2                      ; 2 ; int iBkMode
│     │││   0x0040307e      57             push edi                    ; HDC hdc
│     │││   0x0040307f      ff150c604000   call dword [sym.imp.GDI32.dll_SetBkMode] ; 0x40600c ; "T\x8c" ; long SetBkMode(HDC hdc, int iBkMode)
│     │││   0x00403085      68ffffff00     push 0xffffff               ; COLORREF crColor
│     │││   0x0040308a      57             push edi                    ; HDC hdc
│     │││   0x0040308b      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x00403091      6a00           push 0
│     │││   0x00403093      6890010000     push 0x190                  ; 400
│     │││   0x00403098      6a00           push 0
│     │││   0x0040309a      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x004030a0      8bd8           mov ebx, eax
│     │││   0x004030a2      53             push ebx
│     │││   0x004030a3      57             push edi
│     │││   0x004030a4      ffd5           call ebp
│     │││   0x004030a6      6a05           push 5                      ; 5
│     │││   0x004030a8      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x004030ae      50             push eax
│     │││   0x004030af      57             push edi
│     │││   0x004030b0      ffd5           call ebp
│     │││   0x004030b2      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x004030b5      8b4624         mov eax, dword [esi + 0x24]
│     │││   0x004030b8      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x004030bb      81eabe000000   sub edx, 0xbe               ; 190
│     │││   0x004030c1      52             push edx                    ; int nBottomRect
│     │││   0x004030c2      8d9441dc00..   lea edx, [ecx + eax*2 + 0xdc]
│     │││   0x004030c9      52             push edx                    ; int nRightRect
│     │││   0x004030ca      68c8000000     push 0xc8                   ; 200 ; int nTopRect
│     │││   0x004030cf      8d8401c800..   lea eax, [ecx + eax + 0xc8]
│     │││   0x004030d6      50             push eax                    ; int nLeftRect
│     │││   0x004030d7      57             push edi                    ; HDC hdc
│     │││   0x004030d8      ff1524604000   call dword [sym.imp.GDI32.dll_Rectangle] ; 0x406024 ; bool Rectangle(HDC hdc, int nLeftRect, int nTopRect, int nRightRect, int nBottomRect)
│     │││   0x004030de      53             push ebx
│     │││   0x004030df      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x004030e5      68ffffff00     push 0xffffff
│     │││   0x004030ea      6a03           push 3                      ; 3
│     │││   0x004030ec      6a00           push 0
│     │││   0x004030ee      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x004030f4      50             push eax
│     │││   0x004030f5      57             push edi
│     │││   0x004030f6      8944241c       mov dword [var_1ch_3], eax
│     │││   0x004030fa      ffd5           call ebp
│     │││   0x004030fc      6a05           push 5                      ; 5
│     │││   0x004030fe      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x00403104      50             push eax
│     │││   0x00403105      57             push edi
│     │││   0x00403106      ffd5           call ebp
│     │││   0x00403108      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x0040310b      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x0040310e      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00403111      8b1d28604000   mov ebx, dword [sym.imp.GDI32.dll_MoveToEx] ; [0x406028:4]=0x8bfa reloc.GDI32.dll_MoveToEx
│     │││   0x00403117      6a00           push 0
│     │││   0x00403119      83e932         sub ecx, 0x32               ; 50
│     │││   0x0040311c      51             push ecx
│     │││   0x0040311d      8d4c0264       lea ecx, [edx + eax + 0x64]
│     │││   0x00403121      51             push ecx
│     │││   0x00403122      57             push edi
│     │││   0x00403123      ffd3           call ebx
│     │││   0x00403125      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x00403128      8b4624         mov eax, dword [esi + 0x24]
│     │││   0x0040312b      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x0040312e      83ea32         sub edx, 0x32               ; 50
│     │││   0x00403131      52             push edx                    ; int nYEnd
│     │││   0x00403132      8d94088403..   lea edx, [eax + ecx + 0x384]
│     │││   0x00403139      52             push edx                    ; int nXEnd
│     │││   0x0040313a      57             push edi                    ; HDC hdc
│     │││   0x0040313b      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x00403141      b801000000     mov eax, 1
│     │││   0x00403146      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│    ┌────< 0x0040314b      eb03           jmp 0x403150
..
│    ││││   ; CODE XREFS from fcn.00402af0 @ 0x40314b(x), 0x4031a2(x)
│   ┌└────> 0x00403150      8b4e28         mov ecx, dword [esi + 0x28]
│   ╎ │││   0x00403153      8d1480         lea edx, [eax + eax*4]
│   ╎ │││   0x00403156      8b462c         mov eax, dword [esi + 0x2c]
│   ╎ │││   0x00403159      6a00           push 0
│   ╎ │││   0x0040315b      c1e204         shl edx, 4
│   ╎ │││   0x0040315e      035624         add edx, dword [esi + 0x24]
│   ╎ │││   0x00403161      83e932         sub ecx, 0x32               ; 50
│   ╎ │││   0x00403164      51             push ecx
│   ╎ │││   0x00403165      8d4c0264       lea ecx, [edx + eax + 0x64]
│   ╎ │││   0x00403169      51             push ecx
│   ╎ │││   0x0040316a      57             push edi
│   ╎ │││   0x0040316b      ffd3           call ebx
│   ╎ │││   0x0040316d      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│   ╎ │││   0x00403172      8b5628         mov edx, dword [esi + 0x28]
│   ╎ │││   0x00403175      8b4e2c         mov ecx, dword [esi + 0x2c]
│   ╎ │││   0x00403178      8d0480         lea eax, [eax + eax*4]
│   ╎ │││   0x0040317b      c1e004         shl eax, 4
│   ╎ │││   0x0040317e      034624         add eax, dword [esi + 0x24]
│   ╎ │││   0x00403181      81ea90010000   sub edx, 0x190              ; 400
│   ╎ │││   0x00403187      52             push edx                    ; int nYEnd
│   ╎ │││   0x00403188      8d540864       lea edx, [eax + ecx + 0x64]
│   ╎ │││   0x0040318c      52             push edx                    ; int nXEnd
│   ╎ │││   0x0040318d      57             push edi                    ; HDC hdc
│   ╎ │││   0x0040318e      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│   ╎ │││   0x00403194      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│   ╎ │││   0x00403199      40             inc eax
│   ╎ │││   0x0040319a      83f80b         cmp eax, 0xb                ; 11
│   ╎ │││   0x0040319d      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│   └─────< 0x004031a2      7cac           jl 0x403150
│     │││   0x004031a4      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x004031a7      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x004031aa      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x004031ad      6a00           push 0
│     │││   0x004031af      83e832         sub eax, 0x32               ; 50
│     │││   0x004031b2      50             push eax
│     │││   0x004031b3      8d441164       lea eax, [ecx + edx + 0x64]
│     │││   0x004031b7      50             push eax
│     │││   0x004031b8      57             push edi
│     │││   0x004031b9      ffd3           call ebx
│     │││   0x004031bb      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x004031be      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x004031c1      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x004031c4      81e990010000   sub ecx, 0x190              ; 400
│     │││   0x004031ca      51             push ecx                    ; int nYEnd
│     │││   0x004031cb      8d4c0264       lea ecx, [edx + eax + 0x64]
│     │││   0x004031cf      51             push ecx                    ; int nXEnd
│     │││   0x004031d0      57             push edi                    ; HDC hdc
│     │││   0x004031d1      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x004031d7      33c0           xor eax, eax
│     │││   0x004031d9      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│     │││   0x004031de      8bff           mov edi, edi
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403280(x)
│    ┌────> 0x004031e0      8b5628         mov edx, dword [esi + 0x28]
│    ╎│││   0x004031e3      8b4e2c         mov ecx, dword [esi + 0x2c]
│    ╎│││   0x004031e6      2bd0           sub edx, eax
│    ╎│││   0x004031e8      8b4624         mov eax, dword [esi + 0x24]
│    ╎│││   0x004031eb      6a00           push 0
│    ╎│││   0x004031ed      83ea32         sub edx, 0x32               ; 50
│    ╎│││   0x004031f0      52             push edx
│    ╎│││   0x004031f1      8d540864       lea edx, [eax + ecx + 0x64]
│    ╎│││   0x004031f5      52             push edx
│    ╎│││   0x004031f6      57             push edi
│    ╎│││   0x004031f7      ffd3           call ebx
│    ╎│││   0x004031f9      8b4628         mov eax, dword [esi + 0x28]
│    ╎│││   0x004031fc      2b0554236600   sub eax, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403202      8b4e24         mov ecx, dword [esi + 0x24]
│    ╎│││   0x00403205      8b562c         mov edx, dword [esi + 0x2c]
│    ╎│││   0x00403208      83e832         sub eax, 0x32               ; 50
│    ╎│││   0x0040320b      50             push eax                    ; int nYEnd
│    ╎│││   0x0040320c      8d44115f       lea eax, [ecx + edx + 0x5f]
│    ╎│││   0x00403210      50             push eax                    ; int nXEnd
│    ╎│││   0x00403211      57             push edi                    ; HDC hdc
│    ╎│││   0x00403212      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│    ╎│││   0x00403218      8b0d54236600   mov ecx, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x0040321e      51             push ecx                    ;  ...
│    ╎│││   0x0040321f      8d54243c       lea edx, [lpString]
│    ╎│││   0x00403223      68ec714000     push 0x4071ec               ; "%d" ; const char *format
│    ╎│││   0x00403228      52             push edx                    ; char *s
│    ╎│││   0x00403229      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│    ╎│││   0x0040322f      8d442444       lea eax, [lpString]
│    ╎│││   0x00403233      83c40c         add esp, 0xc
│    ╎│││   0x00403236      8d4801         lea ecx, [eax + 1]
│    ╎│││   0x00403239      8da4240000..   lea esp, [esp]
│    ╎│││   ; CODE XREF from fcn.00402af0 @ 0x403245(x)
│   ┌─────> 0x00403240      8a10           mov dl, byte [eax]
│   ╎╎│││   0x00403242      40             inc eax
│   ╎╎│││   0x00403243      84d2           test dl, dl
│   └─────< 0x00403245      75f9           jne 0x403240
│    ╎│││   0x00403247      8b5624         mov edx, dword [esi + 0x24]
│    ╎│││   0x0040324a      2bc1           sub eax, ecx
│    ╎│││   0x0040324c      8b4e28         mov ecx, dword [esi + 0x28]
│    ╎│││   0x0040324f      2b0d54236600   sub ecx, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403255      50             push eax                    ; int cbString
│    ╎│││   0x00403256      8d44243c       lea eax, [lpString]
│    ╎│││   0x0040325a      50             push eax                    ; LPCSTR lpString
│    ╎│││   0x0040325b      8b462c         mov eax, dword [esi + 0x2c]
│    ╎│││   0x0040325e      83e93a         sub ecx, 0x3a               ; 58
│    ╎│││   0x00403261      51             push ecx                    ; int nYStart
│    ╎│││   0x00403262      8d4c023c       lea ecx, [edx + eax + 0x3c]
│    ╎│││   0x00403266      51             push ecx                    ; int nXStart
│    ╎│││   0x00403267      57             push edi                    ; HDC hdc
│    ╎│││   0x00403268      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│    ╎│││   0x0040326e      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403273      83c032         add eax, 0x32               ; 50
│    ╎│││   0x00403276      3d68010000     cmp eax, 0x168              ; 360
│    ╎│││   0x0040327b      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│    └────< 0x00403280      0f8c5affffff   jl 0x4031e0
│     │││   0x00403286      8b542414       mov edx, dword [var_14h_2]
│     │││   0x0040328a      52             push edx
│     │││   0x0040328b      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00403291      8d442438       lea eax, [var_38h_2]
│     │││   0x00403295      6880714000     push str._sum_of_differences_between_RF_center_and_the_eight_peripheral_sampling_points__separately_for_ON_and_OFF ; 0x407180 ; " sum of differences between RF center and the eight peripheral sampling points, separately for ON and OFF"
│     │││   0x0040329a      50             push eax                    ; char *s
│     │││   0x0040329b      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x004032a1      8d442440       lea eax, [var_38h_2]
│     │││   0x004032a5      83c408         add esp, 8
│     │││   0x004032a8      8d4801         lea ecx, [eax + 1]
│    ┌────< 0x004032ab      eb03           jmp 0x4032b0
..
│    ││││   ; CODE XREFS from fcn.00402af0 @ 0x4032ab(x), 0x4032b5(x)
│   ┌└────> 0x004032b0      8a10           mov dl, byte [eax]
│   ╎ │││   0x004032b2      40             inc eax
│   ╎ │││   0x004032b3      84d2           test dl, dl
│   └─────< 0x004032b5      75f9           jne 0x4032b0
│     │││   0x004032b7      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x004032ba      2bc1           sub eax, ecx
│     │││   0x004032bc      50             push eax                    ; int cbString
│     │││   0x004032bd      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x004032c0      8d4c243c       lea ecx, [var_38h_2]
│     │││   0x004032c4      51             push ecx                    ; LPCSTR lpString
│     │││   0x004032c5      6a23           push 0x23                   ; '#' ; 35 ; int nYStart
│     │││   0x004032c7      8d4c0278       lea ecx, [edx + eax + 0x78]
│     │││   0x004032cb      51             push ecx                    ; int nXStart
│     │││   0x004032cc      57             push edi                    ; HDC hdc
│     │││   0x004032cd      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x004032d3      68ffc86400     push 0x64c8ff
│     │││   0x004032d8      6a05           push 5                      ; 5
│     │││   0x004032da      6a00           push 0
│     │││   0x004032dc      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x004032e2      50             push eax
│     │││   0x004032e3      57             push edi
│     │││   0x004032e4      8944241c       mov dword [var_1ch_4], eax
│     │││   0x004032e8      ffd5           call ebp
│     │││   0x004032ea      6a05           push 5                      ; 5
│     │││   0x004032ec      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x004032f2      50             push eax
│     │││   0x004032f3      57             push edi
│     │││   0x004032f4      ffd5           call ebp
│     │││   0x004032f6      a13ca34000     mov eax, dword [0x40a33c]   ; [0x40a33c:4]=0
│     │││   0x004032fb      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x004032fe      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x00403301      8d0480         lea eax, [eax + eax*4]
│     │││   0x00403304      6a00           push 0
│     │││   0x00403306      c1e004         shl eax, 4
│     │││   0x00403309      034624         add eax, dword [esi + 0x24]
│     │││   0x0040330c      83ea32         sub edx, 0x32               ; 50
│     │││   0x0040330f      52             push edx
│     │││   0x00403310      8d540864       lea edx, [eax + ecx + 0x64]
│     │││   0x00403314      52             push edx
│     │││   0x00403315      57             push edi
│     │││   0x00403316      ffd3           call ebx
│     │││   0x00403318      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x0040331b      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x0040331e      2d90010000     sub eax, 0x190              ; 400
│     │││   0x00403323      50             push eax                    ; int nYEnd
│     │││   0x00403324      a13ca34000     mov eax, dword [0x40a33c]   ; [0x40a33c:4]=0
│     │││   0x00403329      8d0c80         lea ecx, [eax + eax*4]
│     │││   0x0040332c      c1e104         shl ecx, 4
│     │││   0x0040332f      034e24         add ecx, dword [esi + 0x24]
│     │││   0x00403332      8d441164       lea eax, [ecx + edx + 0x64]
│     │││   0x00403336      50             push eax                    ; int nXEnd
│     │││   0x00403337      57             push edi                    ; HDC hdc
│     │││   0x00403338      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x0040333e      a13ca34000     mov eax, dword [0x40a33c]   ; [0x40a33c:4]=0
│     │││   0x00403343      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x00403346      8d0480         lea eax, [eax + eax*4]
│     │││   0x00403349      6a00           push 0
│     │││   0x0040334b      8d5409b0       lea edx, [ecx + ecx - 0x50]
│     │││   0x0040334f      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x00403352      c1e004         shl eax, 4
│     │││   0x00403355      034624         add eax, dword [esi + 0x24]
│     │││   0x00403358      52             push edx
│     │││   0x00403359      8d540864       lea edx, [eax + ecx + 0x64]
│     │││   0x0040335d      52             push edx
│     │││   0x0040335e      57             push edi
│     │││   0x0040335f      ffd3           call ebx
│     │││   0x00403361      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00403364      8d8c0052fe..   lea ecx, [eax + eax - 0x1ae]
│     │││   0x0040336b      a13ca34000     mov eax, dword [0x40a33c]   ; [0x40a33c:4]=0
│     │││   0x00403370      8d1480         lea edx, [eax + eax*4]
│     │││   0x00403373      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00403376      c1e204         shl edx, 4
│     │││   0x00403379      035624         add edx, dword [esi + 0x24]
│     │││   0x0040337c      51             push ecx                    ; int nYEnd
│     │││   0x0040337d      8d4c0264       lea ecx, [edx + eax + 0x64]
│     │││   0x00403381      51             push ecx                    ; int nXEnd
│     │││   0x00403382      57             push edi                    ; HDC hdc
│     │││   0x00403383      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x00403389      8b542414       mov edx, dword [var_14h_3]
│     │││   0x0040338d      52             push edx
│     │││   0x0040338e      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00403394      68ffc86400     push 0x64c8ff               ; COLORREF crColor
│     │││   0x00403399      57             push edi                    ; HDC hdc
│     │││   0x0040339a      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x004033a0      6810714000     push str._use_horizontal_arrow_keys_to_choose_the_RF_radius_for_calculating_the_realtime_ON_OFF_image__see_bottom_left_ ; 0x407110 ; " use horizontal arrow keys to choose the RF radius for calculating the realtime ON/OFF image (see bottom left)"
│     │││   0x004033a5      8d44243c       lea eax, [var_3ch_5]
│     │││   0x004033a9      50             push eax                    ; char *s
│     │││   0x004033aa      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x004033b0      8d442440       lea eax, [var_3ch_5]
│     │││   0x004033b4      83c408         add esp, 8
│     │││   0x004033b7      8d4801         lea ecx, [eax + 1]
│     │││   0x004033ba      8d9b00000000   lea ebx, [ebx]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x4033c5(x)
│    ┌────> 0x004033c0      8a10           mov dl, byte [eax]
│    ╎│││   0x004033c2      40             inc eax
│    ╎│││   0x004033c3      84d2           test dl, dl
│    └────< 0x004033c5      75f9           jne 0x4033c0
│     │││   0x004033c7      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x004033ca      2bc1           sub eax, ecx
│     │││   0x004033cc      50             push eax                    ; int cbString
│     │││   0x004033cd      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x004033d0      8d4c243c       lea ecx, [var_3ch_5]
│     │││   0x004033d4      51             push ecx                    ; LPCSTR lpString
│     │││   0x004033d5      6a37           push 0x37                   ; '7' ; 55 ; int nYStart
│     │││   0x004033d7      8d8c02a000..   lea ecx, [edx + eax + 0xa0]
│     │││   0x004033de      51             push ecx                    ; int nXStart
│     │││   0x004033df      57             push edi                    ; HDC hdc
│     │││   0x004033e0      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x004033e6      6800ff0000     push 0xff00
│     │││   0x004033eb      6a05           push 5                      ; 5
│     │││   0x004033ed      6a00           push 0
│     │││   0x004033ef      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x004033f5      50             push eax
│     │││   0x004033f6      57             push edi
│     │││   0x004033f7      8944241c       mov dword [var_1ch_5], eax
│     │││   0x004033fb      ffd5           call ebp
│     │││   0x004033fd      6a05           push 5                      ; 5
│     │││   0x004033ff      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x00403405      50             push eax
│     │││   0x00403406      57             push edi
│     │││   0x00403407      ffd5           call ebp
│     │││   0x00403409      c7464c0100..   mov dword [esi + 0x4c], 1
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403484(x)
│    ┌────> 0x00403410      8b5628         mov edx, dword [esi + 0x28]
│    ╎│││   0x00403413      8b464c         mov eax, dword [esi + 0x4c]
│    ╎│││   0x00403416      83ea50         sub edx, 0x50               ; 80
│    ╎│││   0x00403419      89542418       mov dword [var_18h], edx
│    ╎│││   0x0040341d      db442418       fild dword [esp + 0x18]
│    ╎│││   0x00403421      6a00           push 0
│    ╎│││   0x00403423      d8648650       fsub dword [esi + eax*4 + 0x50]
│    ╎│││   0x00403427      e854170000     call fcn.00404b80
│    ╎│││   0x0040342c      8b4e2c         mov ecx, dword [esi + 0x2c]
│    ╎│││   0x0040342f      50             push eax
│    ╎│││   0x00403430      8b464c         mov eax, dword [esi + 0x4c]
│    ╎│││   0x00403433      8d0480         lea eax, [eax + eax*4]
│    ╎│││   0x00403436      c1e004         shl eax, 4
│    ╎│││   0x00403439      034624         add eax, dword [esi + 0x24]
│    ╎│││   0x0040343c      8d540864       lea edx, [eax + ecx + 0x64]
│    ╎│││   0x00403440      52             push edx
│    ╎│││   0x00403441      57             push edi
│    ╎│││   0x00403442      ffd3           call ebx
│    ╎│││   0x00403444      8b4e28         mov ecx, dword [esi + 0x28]
│    ╎│││   0x00403447      8b464c         mov eax, dword [esi + 0x4c]
│    ╎│││   0x0040344a      83e950         sub ecx, 0x50               ; 80
│    ╎│││   0x0040344d      894c2418       mov dword [var_18h_2], ecx
│    ╎│││   0x00403451      db442418       fild dword [esp + 0x18]
│    ╎│││   0x00403455      d8648654       fsub dword [esi + eax*4 + 0x54]
│    ╎│││   0x00403459      e822170000     call fcn.00404b80
│    ╎│││   0x0040345e      50             push eax                    ; int nYEnd
│    ╎│││   0x0040345f      8b464c         mov eax, dword [esi + 0x4c]
│    ╎│││   0x00403462      8d1480         lea edx, [eax + eax*4]
│    ╎│││   0x00403465      8b462c         mov eax, dword [esi + 0x2c]
│    ╎│││   0x00403468      c1e204         shl edx, 4
│    ╎│││   0x0040346b      035624         add edx, dword [esi + 0x24]
│    ╎│││   0x0040346e      8d8c02b400..   lea ecx, [edx + eax + 0xb4]
│    ╎│││   0x00403475      51             push ecx                    ; int nXEnd
│    ╎│││   0x00403476      57             push edi                    ; HDC hdc
│    ╎│││   0x00403477      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│    ╎│││   0x0040347d      ff464c         inc dword [esi + 0x4c]
│    ╎│││   0x00403480      837e4c0a       cmp dword [esi + 0x4c], 0xa
│    └────< 0x00403484      7c8a           jl 0x403410
│     │││   0x00403486      8b542414       mov edx, dword [var_14h_4]
│     │││   0x0040348a      52             push edx
│     │││   0x0040348b      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00403491      68ff000000     push 0xff                   ; 255
│     │││   0x00403496      6a05           push 5                      ; 5
│     │││   0x00403498      6a00           push 0
│     │││   0x0040349a      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x004034a0      50             push eax
│     │││   0x004034a1      57             push edi
│     │││   0x004034a2      8944241c       mov dword [var_1ch_6], eax
│     │││   0x004034a6      ffd5           call ebp
│     │││   0x004034a8      6a05           push 5                      ; 5
│     │││   0x004034aa      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x004034b0      50             push eax
│     │││   0x004034b1      57             push edi
│     │││   0x004034b2      ffd5           call ebp
│     │││   0x004034b4      c7464c0100..   mov dword [esi + 0x4c], 1
│    ┌────< 0x004034bb      eb03           jmp 0x4034c0
..
│    ││││   ; CODE XREFS from fcn.00402af0 @ 0x4034bb(x), 0x40353a(x)
│   ┌└────> 0x004034c0      8b4e28         mov ecx, dword [esi + 0x28]
│   ╎ │││   0x004034c3      8b464c         mov eax, dword [esi + 0x4c]
│   ╎ │││   0x004034c6      83e950         sub ecx, 0x50               ; 80
│   ╎ │││   0x004034c9      894c2418       mov dword [var_18h_3], ecx
│   ╎ │││   0x004034cd      db442418       fild dword [esp + 0x18]
│   ╎ │││   0x004034d1      6a00           push 0
│   ╎ │││   0x004034d3      d8a486c800..   fsub dword [esi + eax*4 + 0xc8]
│   ╎ │││   0x004034da      e8a1160000     call fcn.00404b80
│   ╎ │││   0x004034df      50             push eax
│   ╎ │││   0x004034e0      8b464c         mov eax, dword [esi + 0x4c]
│   ╎ │││   0x004034e3      8d1480         lea edx, [eax + eax*4]
│   ╎ │││   0x004034e6      8b462c         mov eax, dword [esi + 0x2c]
│   ╎ │││   0x004034e9      c1e204         shl edx, 4
│   ╎ │││   0x004034ec      035624         add edx, dword [esi + 0x24]
│   ╎ │││   0x004034ef      8d4c0264       lea ecx, [edx + eax + 0x64]
│   ╎ │││   0x004034f3      51             push ecx
│   ╎ │││   0x004034f4      57             push edi
│   ╎ │││   0x004034f5      ffd3           call ebx
│   ╎ │││   0x004034f7      8b5628         mov edx, dword [esi + 0x28]
│   ╎ │││   0x004034fa      8b464c         mov eax, dword [esi + 0x4c]
│   ╎ │││   0x004034fd      83ea50         sub edx, 0x50               ; 80
│   ╎ │││   0x00403500      89542418       mov dword [var_18h_4], edx
│   ╎ │││   0x00403504      db442418       fild dword [esp + 0x18]
│   ╎ │││   0x00403508      d8a486cc00..   fsub dword [esi + eax*4 + 0xcc]
│   ╎ │││   0x0040350f      e86c160000     call fcn.00404b80
│   ╎ │││   0x00403514      8b4e2c         mov ecx, dword [esi + 0x2c]
│   ╎ │││   0x00403517      50             push eax                    ; int nYEnd
│   ╎ │││   0x00403518      8b464c         mov eax, dword [esi + 0x4c]
│   ╎ │││   0x0040351b      8d0480         lea eax, [eax + eax*4]
│   ╎ │││   0x0040351e      c1e004         shl eax, 4
│   ╎ │││   0x00403521      034624         add eax, dword [esi + 0x24]
│   ╎ │││   0x00403524      8d9408b400..   lea edx, [eax + ecx + 0xb4]
│   ╎ │││   0x0040352b      52             push edx                    ; int nXEnd
│   ╎ │││   0x0040352c      57             push edi                    ; HDC hdc
│   ╎ │││   0x0040352d      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│   ╎ │││   0x00403533      ff464c         inc dword [esi + 0x4c]
│   ╎ │││   0x00403536      837e4c0a       cmp dword [esi + 0x4c], 0xa
│   └─────< 0x0040353a      7c84           jl 0x4034c0
│     │││   0x0040353c      8b442414       mov eax, dword [var_14h_5]
│     │││   0x00403540      50             push eax
│     │││   0x00403541      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00403547      6800ff0000     push 0xff00                 ; COLORREF crColor
│     │││   0x0040354c      57             push edi                    ; HDC hdc
│     │││   0x0040354d      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x00403553      8d4c2438       lea ecx, [var_38h_3]
│     │││   0x00403557      68f8704000     push str._responses_of_ON_RFs ; 0x4070f8 ; " responses of ON RFs"
│     │││   0x0040355c      51             push ecx                    ; char *s
│     │││   0x0040355d      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00403563      8d442440       lea eax, [var_38h_3]
│     │││   0x00403567      83c408         add esp, 8
│     │││   0x0040356a      8d4801         lea ecx, [eax + 1]
│     │││   0x0040356d      8d4900         lea ecx, [ecx]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403575(x)
│    ┌────> 0x00403570      8a10           mov dl, byte [eax]
│    ╎│││   0x00403572      40             inc eax
│    ╎│││   0x00403573      84d2           test dl, dl
│    └────< 0x00403575      75f9           jne 0x403570
│     │││   0x00403577      2bc1           sub eax, ecx
│     │││   0x00403579      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x0040357c      50             push eax                    ; int cbString
│     │││   0x0040357d      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00403580      8d54243c       lea edx, [var_38h_3]
│     │││   0x00403584      52             push edx                    ; LPCSTR lpString
│     │││   0x00403585      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x00403588      2d68010000     sub eax, 0x168              ; 360
│     │││   0x0040358d      50             push eax                    ; int nYStart
│     │││   0x0040358e      8d8411b603..   lea eax, [ecx + edx + 0x3b6]
│     │││   0x00403595      50             push eax                    ; int nXStart
│     │││   0x00403596      57             push edi                    ; HDC hdc
│     │││   0x00403597      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x0040359d      68ff000000     push 0xff                   ; 255 ; COLORREF crColor
│     │││   0x004035a2      57             push edi                    ; HDC hdc
│     │││   0x004035a3      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x004035a9      8d4c2438       lea ecx, [var_38h_4]
│     │││   0x004035ad      68e0704000     push 0x4070e0               ; " responses of OFF RFs " ; const char *format
│     │││   0x004035b2      51             push ecx                    ; char *s
│     │││   0x004035b3      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x004035b9      8d442440       lea eax, [var_38h_4]
│     │││   0x004035bd      83c408         add esp, 8
│     │││   0x004035c0      8d4801         lea ecx, [eax + 1]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x4035c8(x)
│    ┌────> 0x004035c3      8a10           mov dl, byte [eax]
│    ╎│││   0x004035c5      40             inc eax
│    ╎│││   0x004035c6      84d2           test dl, dl
│    └────< 0x004035c8      75f9           jne 0x4035c3
│     │││   0x004035ca      2bc1           sub eax, ecx
│     │││   0x004035cc      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x004035cf      50             push eax                    ; int cbString
│     │││   0x004035d0      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x004035d3      8d54243c       lea edx, [var_38h_4]
│     │││   0x004035d7      52             push edx                    ; LPCSTR lpString
│     │││   0x004035d8      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x004035db      2d54010000     sub eax, 0x154              ; 340
│     │││   0x004035e0      50             push eax                    ; int nYStart
│     │││   0x004035e1      8d8411b603..   lea eax, [ecx + edx + 0x3b6]
│     │││   0x004035e8      50             push eax                    ; int nXStart
│     │││   0x004035e9      57             push edi                    ; HDC hdc
│     │││   0x004035ea      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x004035f0      68ffffff00     push 0xffffff               ; COLORREF crColor
│     │││   0x004035f5      57             push edi                    ; HDC hdc
│     │││   0x004035f6      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x004035fc      6a00           push 0
│     │││   0x004035fe      6890010000     push 0x190                  ; 400
│     │││   0x00403603      6a00           push 0
│     │││   0x00403605      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x0040360b      50             push eax
│     │││   0x0040360c      57             push edi
│     │││   0x0040360d      8944241c       mov dword [var_1ch_7], eax
│     │││   0x00403611      ffd5           call ebp
│     │││   0x00403613      6a05           push 5                      ; 5
│     │││   0x00403615      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x0040361b      50             push eax
│     │││   0x0040361c      57             push edi
│     │││   0x0040361d      ffd5           call ebp
│     │││   0x0040361f      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00403622      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x00403625      8d94004cff..   lea edx, [eax + eax - 0xb4]
│     │││   0x0040362c      52             push edx                    ; int nBottomRect
│     │││   0x0040362d      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x00403630      8d944adc00..   lea edx, [edx + ecx*2 + 0xdc]
│     │││   0x00403637      52             push edx                    ; int nRightRect
│     │││   0x00403638      05aa000000     add eax, 0xaa               ; 170
│     │││   0x0040363d      50             push eax                    ; int nTopRect
│     │││   0x0040363e      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00403641      8d8408c800..   lea eax, [eax + ecx + 0xc8]
│     │││   0x00403648      50             push eax                    ; int nLeftRect
│     │││   0x00403649      57             push edi                    ; HDC hdc
│     │││   0x0040364a      ff1524604000   call dword [sym.imp.GDI32.dll_Rectangle] ; 0x406024 ; bool Rectangle(HDC hdc, int nLeftRect, int nTopRect, int nRightRect, int nBottomRect)
│     │││   0x00403650      8b4c2414       mov ecx, dword [var_14h_6]
│     │││   0x00403654      51             push ecx
│     │││   0x00403655      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x0040365b      68ffffff00     push 0xffffff
│     │││   0x00403660      6a02           push 2                      ; 2
│     │││   0x00403662      6a00           push 0
│     │││   0x00403664      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x0040366a      50             push eax
│     │││   0x0040366b      57             push edi
│     │││   0x0040366c      8944241c       mov dword [var_1ch_8], eax
│     │││   0x00403670      ffd5           call ebp
│     │││   0x00403672      6a05           push 5                      ; 5
│     │││   0x00403674      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x0040367a      50             push eax
│     │││   0x0040367b      57             push edi
│     │││   0x0040367c      ffd5           call ebp
│     │││   0x0040367e      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x00403681      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x00403684      6a00           push 0
│     │││   0x00403686      8d4412ba       lea eax, [edx + edx - 0x46]
│     │││   0x0040368a      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x0040368d      50             push eax
│     │││   0x0040368e      8d441164       lea eax, [ecx + edx + 0x64]
│     │││   0x00403692      50             push eax
│     │││   0x00403693      57             push edi
│     │││   0x00403694      ffd3           call ebx
│     │││   0x00403696      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x00403699      8b4624         mov eax, dword [esi + 0x24]
│     │││   0x0040369c      8d5409ba       lea edx, [ecx + ecx - 0x46]
│     │││   0x004036a0      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x004036a3      52             push edx                    ; int nYEnd
│     │││   0x004036a4      8d94088403..   lea edx, [eax + ecx + 0x384]
│     │││   0x004036ab      52             push edx                    ; int nXEnd
│     │││   0x004036ac      57             push edi                    ; HDC hdc
│     │││   0x004036ad      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x004036b3      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x004036b6      6a00           push 0
│     │││   0x004036b8      8d8c00f2fe..   lea ecx, [eax + eax - 0x10e]
│     │││   0x004036bf      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x004036c2      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x004036c5      51             push ecx
│     │││   0x004036c6      8d4c0264       lea ecx, [edx + eax + 0x64]
│     │││   0x004036ca      51             push ecx
│     │││   0x004036cb      57             push edi
│     │││   0x004036cc      ffd3           call ebx
│     │││   0x004036ce      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x004036d1      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x004036d4      8d8412f2fe..   lea eax, [edx + edx - 0x10e]
│     │││   0x004036db      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x004036de      50             push eax                    ; int nYEnd
│     │││   0x004036df      8d84119803..   lea eax, [ecx + edx + 0x398]
│     │││   0x004036e6      50             push eax                    ; int nXEnd
│     │││   0x004036e7      57             push edi                    ; HDC hdc
│     │││   0x004036e8      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x004036ee      b801000000     mov eax, 1
│     │││   0x004036f3      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403812(x)
│    ┌────> 0x004036f8      8b4e28         mov ecx, dword [esi + 0x28]
│    ╎│││   0x004036fb      8d0480         lea eax, [eax + eax*4]
│    ╎│││   0x004036fe      6a00           push 0
│    ╎│││   0x00403700      8d5409ba       lea edx, [ecx + ecx - 0x46]
│    ╎│││   0x00403704      8b4e2c         mov ecx, dword [esi + 0x2c]
│    ╎│││   0x00403707      c1e004         shl eax, 4
│    ╎│││   0x0040370a      034624         add eax, dword [esi + 0x24]
│    ╎│││   0x0040370d      52             push edx
│    ╎│││   0x0040370e      8d540864       lea edx, [eax + ecx + 0x64]
│    ╎│││   0x00403712      52             push edx
│    ╎│││   0x00403713      57             push edi
│    ╎│││   0x00403714      ffd3           call ebx
│    ╎│││   0x00403716      8b4628         mov eax, dword [esi + 0x28]
│    ╎│││   0x00403719      8d8c002afe..   lea ecx, [eax + eax - 0x1d6]
│    ╎│││   0x00403720      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403725      8d1480         lea edx, [eax + eax*4]
│    ╎│││   0x00403728      8b462c         mov eax, dword [esi + 0x2c]
│    ╎│││   0x0040372b      c1e204         shl edx, 4
│    ╎│││   0x0040372e      035624         add edx, dword [esi + 0x24]
│    ╎│││   0x00403731      51             push ecx                    ; int nYEnd
│    ╎│││   0x00403732      8d4c0264       lea ecx, [edx + eax + 0x64]
│    ╎│││   0x00403736      51             push ecx                    ; int nXEnd
│    ╎│││   0x00403737      57             push edi                    ; HDC hdc
│    ╎│││   0x00403738      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│    ╎│││   0x0040373e      8b1554236600   mov edx, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403744      52             push edx                    ;  ...
│    ╎│││   0x00403745      8d44243c       lea eax, [var_3ch_6]
│    ╎│││   0x00403749      68ec714000     push 0x4071ec               ; "%d" ; const char *format
│    ╎│││   0x0040374e      50             push eax                    ; char *s
│    ╎│││   0x0040374f      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│    ╎│││   0x00403755      8d442444       lea eax, [var_3ch_6]
│    ╎│││   0x00403759      83c40c         add esp, 0xc
│    ╎│││   0x0040375c      8d4801         lea ecx, [eax + 1]
│    ╎│││   0x0040375f      90             nop
│    ╎│││   ; CODE XREF from fcn.00402af0 @ 0x403765(x)
│   ┌─────> 0x00403760      8a10           mov dl, byte [eax]
│   ╎╎│││   0x00403762      40             inc eax
│   ╎╎│││   0x00403763      84d2           test dl, dl
│   └─────< 0x00403765      75f9           jne 0x403760
│    ╎│││   0x00403767      8b5628         mov edx, dword [esi + 0x28]
│    ╎│││   0x0040376a      2bc1           sub eax, ecx
│    ╎│││   0x0040376c      50             push eax                    ; int cbString
│    ╎│││   0x0040376d      8d4c243c       lea ecx, [var_3ch_6]
│    ╎│││   0x00403771      51             push ecx                    ; LPCSTR lpString
│    ╎│││   0x00403772      8d4412c4       lea eax, [edx + edx - 0x3c]
│    ╎│││   0x00403776      8b562c         mov edx, dword [esi + 0x2c]
│    ╎│││   0x00403779      50             push eax                    ; int nYStart
│    ╎│││   0x0040377a      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x0040377f      8d0c80         lea ecx, [eax + eax*4]
│    ╎│││   0x00403782      c1e104         shl ecx, 4
│    ╎│││   0x00403785      034e24         add ecx, dword [esi + 0x24]
│    ╎│││   0x00403788      8d441162       lea eax, [ecx + edx + 0x62]
│    ╎│││   0x0040378c      50             push eax                    ; int nXStart
│    ╎│││   0x0040378d      57             push edi                    ; HDC hdc
│    ╎│││   0x0040378e      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│    ╎│││   0x00403794      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403799      85c0           test eax, eax
│   ┌─────< 0x0040379b      7e6c           jle 0x403809
│   │╎│││   0x0040379d      db0554236600   fild dword [0x662354]
│   │╎│││   0x004037a3      83ec08         sub esp, 8
│   │╎│││   0x004037a6      8d4c2440       lea ecx, [var_38h_5]
│   │╎│││   0x004037aa      dc3dd8704000   fdivr qword [0x4070d8]
│   │╎│││   0x004037b0      dd1c24         fstp qword [esp]
│   │╎│││   0x004037b3      68cc704000     push str._2.2f              ; 0x4070cc ; "%2.2f"
│   │╎│││   0x004037b8      51             push ecx                    ; char *s
│   │╎│││   0x004037b9      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│   │╎│││   0x004037bf      8d442448       lea eax, [var_38h_5]
│   │╎│││   0x004037c3      83c410         add esp, 0x10
│   │╎│││   0x004037c6      8d5001         lea edx, [eax + 1]
│   │╎│││   0x004037c9      8da4240000..   lea esp, [esp]
│   │╎│││   ; CODE XREF from fcn.00402af0 @ 0x4037d5(x)
│  ┌──────> 0x004037d0      8a08           mov cl, byte [eax]
│  ╎│╎│││   0x004037d2      40             inc eax
│  ╎│╎│││   0x004037d3      84c9           test cl, cl
│  └──────< 0x004037d5      75f9           jne 0x4037d0
│   │╎│││   0x004037d7      2bc2           sub eax, edx
│   │╎│││   0x004037d9      50             push eax                    ; int cbString
│   │╎│││   0x004037da      8b4628         mov eax, dword [esi + 0x28]
│   │╎│││   0x004037dd      8d4c00d3       lea ecx, [eax + eax - 0x2d]
│   │╎│││   0x004037e1      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│   │╎│││   0x004037e6      8d54243c       lea edx, [var_38h_5]
│   │╎│││   0x004037ea      52             push edx                    ; LPCSTR lpString
│   │╎│││   0x004037eb      8d1480         lea edx, [eax + eax*4]
│   │╎│││   0x004037ee      8b462c         mov eax, dword [esi + 0x2c]
│   │╎│││   0x004037f1      c1e204         shl edx, 4
│   │╎│││   0x004037f4      035624         add edx, dword [esi + 0x24]
│   │╎│││   0x004037f7      51             push ecx                    ; int nYStart
│   │╎│││   0x004037f8      8d4c0262       lea ecx, [edx + eax + 0x62]
│   │╎│││   0x004037fc      51             push ecx                    ; int nXStart
│   │╎│││   0x004037fd      57             push edi                    ; HDC hdc
│   │╎│││   0x004037fe      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│   │╎│││   0x00403804      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│   │╎│││   ; CODE XREF from fcn.00402af0 @ 0x40379b(x)
│   └─────> 0x00403809      40             inc eax
│    ╎│││   0x0040380a      83f80b         cmp eax, 0xb                ; 11
│    ╎│││   0x0040380d      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│    └────< 0x00403812      0f8ce0feffff   jl 0x4036f8
│     │││   0x00403818      8d542438       lea edx, [var_38h_5]
│     │││   0x0040381c      68a8704000     push str._receptive_field_radius_in_pixel ; 0x4070a8 ; " receptive field radius in pixel"
│     │││   0x00403821      52             push edx                    ; char *s
│     │││   0x00403822      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00403828      8d442440       lea eax, [var_38h_5]
│     │││   0x0040382c      83c408         add esp, 8
│     │││   0x0040382f      8d5001         lea edx, [eax + 1]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403837(x)
│    ┌────> 0x00403832      8a08           mov cl, byte [eax]
│    ╎│││   0x00403834      40             inc eax
│    ╎│││   0x00403835      84c9           test cl, cl
│    └────< 0x00403837      75f9           jne 0x403832
│     │││   0x00403839      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x0040383c      2bc2           sub eax, edx
│     │││   0x0040383e      50             push eax                    ; int cbString
│     │││   0x0040383f      8d44243c       lea eax, [var_38h_5]
│     │││   0x00403843      50             push eax                    ; LPCSTR lpString
│     │││   0x00403844      8b4624         mov eax, dword [esi + 0x24]
│     │││   0x00403847      8d5409c4       lea edx, [ecx + ecx - 0x3c]
│     │││   0x0040384b      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x0040384e      52             push edx                    ; int nYStart
│     │││   0x0040384f      8d9408b603..   lea edx, [eax + ecx + 0x3b6]
│     │││   0x00403856      52             push edx                    ; int nXStart
│     │││   0x00403857      57             push edi                    ; HDC hdc
│     │││   0x00403858      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x0040385e      8d442438       lea eax, [var_38h_6]
│     │││   0x00403862      688c704000     push str._cyc_deg_for_16_mm_lens ; 0x40708c ; " cyc/deg for 16 mm lens"
│     │││   0x00403867      50             push eax                    ; char *s
│     │││   0x00403868      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x0040386e      8d442440       lea eax, [var_38h_6]
│     │││   0x00403872      83c408         add esp, 8
│     │││   0x00403875      8d4801         lea ecx, [eax + 1]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x40387d(x)
│    ┌────> 0x00403878      8a10           mov dl, byte [eax]
│    ╎│││   0x0040387a      40             inc eax
│    ╎│││   0x0040387b      84d2           test dl, dl
│    └────< 0x0040387d      75f9           jne 0x403878
│     │││   0x0040387f      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x00403882      2bc1           sub eax, ecx
│     │││   0x00403884      50             push eax                    ; int cbString
│     │││   0x00403885      8d4c243c       lea ecx, [var_38h_6]
│     │││   0x00403889      51             push ecx                    ; LPCSTR lpString
│     │││   0x0040388a      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x0040388d      8d4412d3       lea eax, [edx + edx - 0x2d]
│     │││   0x00403891      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x00403894      50             push eax                    ; int nYStart
│     │││   0x00403895      8d8411b603..   lea eax, [ecx + edx + 0x3b6]
│     │││   0x0040389c      50             push eax                    ; int nXStart
│     │││   0x0040389d      57             push edi                    ; HDC hdc
│     │││   0x0040389e      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x004038a4      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x004038a7      8b4624         mov eax, dword [esi + 0x24]
│     │││   0x004038aa      6a00           push 0
│     │││   0x004038ac      8d5409ba       lea edx, [ecx + ecx - 0x46]
│     │││   0x004038b0      8b4e2c         mov ecx, dword [esi + 0x2c]
│     │││   0x004038b3      52             push edx
│     │││   0x004038b4      8d540864       lea edx, [eax + ecx + 0x64]
│     │││   0x004038b8      52             push edx
│     │││   0x004038b9      57             push edi
│     │││   0x004038ba      ffd3           call ebx
│     │││   0x004038bc      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x004038bf      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x004038c2      8d8c002afe..   lea ecx, [eax + eax - 0x1d6]
│     │││   0x004038c9      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x004038cc      51             push ecx                    ; int nYEnd
│     │││   0x004038cd      8d4c0264       lea ecx, [edx + eax + 0x64]
│     │││   0x004038d1      51             push ecx                    ; int nXEnd
│     │││   0x004038d2      57             push edi                    ; HDC hdc
│     │││   0x004038d3      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x004038d9      b838ffffff     mov eax, 0xffffff38         ; 4294967096
│     │││   0x004038de      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403988(x)
│    ┌────> 0x004038e3      8b5628         mov edx, dword [esi + 0x28]
│    ╎│││   0x004038e6      8d8c12f2fe..   lea ecx, [edx + edx - 0x10e]
│    ╎│││   0x004038ed      8b5624         mov edx, dword [esi + 0x24]
│    ╎│││   0x004038f0      6a00           push 0
│    ╎│││   0x004038f2      2bc8           sub ecx, eax
│    ╎│││   0x004038f4      8b462c         mov eax, dword [esi + 0x2c]
│    ╎│││   0x004038f7      51             push ecx
│    ╎│││   0x004038f8      8d4c0264       lea ecx, [edx + eax + 0x64]
│    ╎│││   0x004038fc      51             push ecx
│    ╎│││   0x004038fd      57             push edi
│    ╎│││   0x004038fe      ffd3           call ebx
│    ╎│││   0x00403900      8b5628         mov edx, dword [esi + 0x28]
│    ╎│││   0x00403903      8b4e24         mov ecx, dword [esi + 0x24]
│    ╎│││   0x00403906      8d8412f2fe..   lea eax, [edx + edx - 0x10e]
│    ╎│││   0x0040390d      2b0554236600   sub eax, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403913      8b562c         mov edx, dword [esi + 0x2c]
│    ╎│││   0x00403916      50             push eax                    ; int nYEnd
│    ╎│││   0x00403917      8d44115f       lea eax, [ecx + edx + 0x5f]
│    ╎│││   0x0040391b      50             push eax                    ; int nXEnd
│    ╎│││   0x0040391c      57             push edi                    ; HDC hdc
│    ╎│││   0x0040391d      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│    ╎│││   0x00403923      8b0d54236600   mov ecx, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x00403929      51             push ecx                    ;  ...
│    ╎│││   0x0040392a      8d54243c       lea edx, [var_3ch_7]
│    ╎│││   0x0040392e      68ec714000     push 0x4071ec               ; "%d" ; const char *format
│    ╎│││   0x00403933      52             push edx                    ; char *s
│    ╎│││   0x00403934      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│    ╎│││   0x0040393a      8d442444       lea eax, [var_3ch_7]
│    ╎│││   0x0040393e      83c40c         add esp, 0xc
│    ╎│││   0x00403941      8d4801         lea ecx, [eax + 1]
│    ╎│││   ; CODE XREF from fcn.00402af0 @ 0x403949(x)
│   ┌─────> 0x00403944      8a10           mov dl, byte [eax]
│   ╎╎│││   0x00403946      40             inc eax
│   ╎╎│││   0x00403947      84d2           test dl, dl
│   └─────< 0x00403949      75f9           jne 0x403944
│    ╎│││   0x0040394b      2bc1           sub eax, ecx
│    ╎│││   0x0040394d      8b4e28         mov ecx, dword [esi + 0x28]
│    ╎│││   0x00403950      50             push eax                    ; int cbString
│    ╎│││   0x00403951      8d9409eafe..   lea edx, [ecx + ecx - 0x116]
│    ╎│││   0x00403958      2b1554236600   sub edx, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x0040395e      8b4e2c         mov ecx, dword [esi + 0x2c]
│    ╎│││   0x00403961      8d44243c       lea eax, [var_3ch_7]
│    ╎│││   0x00403965      50             push eax                    ; LPCSTR lpString
│    ╎│││   0x00403966      8b4624         mov eax, dword [esi + 0x24]
│    ╎│││   0x00403969      52             push edx                    ; int nYStart
│    ╎│││   0x0040396a      8d54083c       lea edx, [eax + ecx + 0x3c]
│    ╎│││   0x0040396e      52             push edx                    ; int nXStart
│    ╎│││   0x0040396f      57             push edi                    ; HDC hdc
│    ╎│││   0x00403970      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│    ╎│││   0x00403976      a154236600     mov eax, dword [0x662354]   ; [0x662354:4]=0
│    ╎│││   0x0040397b      83c028         add eax, 0x28               ; 40
│    ╎│││   0x0040397e      3ddc000000     cmp eax, 0xdc               ; 220
│    ╎│││   0x00403983      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│    └────< 0x00403988      0f8c55ffffff   jl 0x4038e3
│     │││   0x0040398e      8b442414       mov eax, dword [var_14h_7]
│     │││   0x00403992      50             push eax
│     │││   0x00403993      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00403999      d9ee           fldz
│     │││   0x0040399b      33c0           xor eax, eax
│     │││   0x0040399d      d95644         fst dword [esi + 0x44]
│     │││   0x004039a0      d95648         fst dword [esi + 0x48]
│     │││   0x004039a3      8d5001         lea edx, [eax + 1]
│     │││   0x004039a6      a354236600     mov dword [0x662354], eax   ; [0x662354:4]=0
│     │││   0x004039ab      89464c         mov dword [esi + 0x4c], eax
│     │││   0x004039ae      8d480b         lea ecx, [eax + 0xb]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x4039d7(x)
│    ┌────> 0x004039b1      8b464c         mov eax, dword [esi + 0x4c]
│    ╎│││   0x004039b4      d9448650       fld dword [esi + eax*4 + 0x50]
│    ╎│││   0x004039b8      d84644         fadd dword [esi + 0x44]
│    ╎│││   0x004039bb      d95e44         fstp dword [esi + 0x44]
│    ╎│││   0x004039be      d98486c800..   fld dword [esi + eax*4 + 0xc8]
│    ╎│││   0x004039c5      d84648         fadd dword [esi + 0x48]
│    ╎│││   0x004039c8      d95e48         fstp dword [esi + 0x48]
│    ╎│││   0x004039cb      011554236600   add dword [0x662354], edx   ; [0x662354:4]=0
│    ╎│││   0x004039d1      01564c         add dword [esi + 0x4c], edx
│    ╎│││   0x004039d4      394e4c         cmp dword [esi + 0x4c], ecx
│    └────< 0x004039d7      7cd8           jl 0x4039b1
│     │││   0x004039d9      d94644         fld dword [esi + 0x44]
│     │││   0x004039dc      da3554236600   fidiv dword [0x662354]      ; [0x662354:4]=0
│     │││   0x004039e2      d95e44         fstp dword [esi + 0x44]
│     │││   0x004039e5      d94648         fld dword [esi + 0x48]
│     │││   0x004039e8      da3554236600   fidiv dword [0x662354]      ; [0x662354:4]=0
│     │││   0x004039ee      d95c2418       fstp dword [var_14h_7]
│     │││   0x004039f2      d9442418       fld dword [var_14h_7]
│     │││   0x004039f6      d95648         fst dword [esi + 0x48]
│     │││   0x004039f9      d86e44         fsubr dword [esi + 0x44]
│     │││   0x004039fc      d95c241c       fstp dword [var_1ch_9]
│     │││   0x00403a00      d85c241c       fcomp dword [esp + 0x1c]
│     │││   0x00403a04      dfe0           fnstsw ax
│     │││   0x00403a06      f6c441         test ah, 0x41               ; 65
│    ┌────< 0x00403a09      0f857c000000   jne 0x403a8b
│    ││││   0x00403a0f      68ff000000     push 0xff                   ; 255
│    ││││   0x00403a14      6a0a           push 0xa                    ; 10
│    ││││   0x00403a16      6a00           push 0
│    ││││   0x00403a18      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│    ││││   0x00403a1e      50             push eax
│    ││││   0x00403a1f      57             push edi
│    ││││   0x00403a20      8944241c       mov dword [var_1ch_10], eax
│    ││││   0x00403a24      ffd5           call ebp
│    ││││   0x00403a26      6a05           push 5                      ; 5
│    ││││   0x00403a28      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│    ││││   0x00403a2e      50             push eax
│    ││││   0x00403a2f      57             push edi
│    ││││   0x00403a30      ffd5           call ebp
│    ││││   0x00403a32      8b4e28         mov ecx, dword [esi + 0x28]
│    ││││   0x00403a35      8d9409f2fe..   lea edx, [ecx + ecx - 0x10e]
│    ││││   0x00403a3c      89542418       mov dword [var_18h_5], edx
│    ││││   0x00403a40      db442418       fild dword [esp + 0x18]
│    ││││   0x00403a44      6a00           push 0
│    ││││   0x00403a46      d8642420       fsub dword [var_20h]
│    ││││   0x00403a4a      e831110000     call fcn.00404b80
│    ││││   0x00403a4f      8b4e2c         mov ecx, dword [esi + 0x2c]
│    ││││   0x00403a52      50             push eax
│    ││││   0x00403a53      8b4624         mov eax, dword [esi + 0x24]
│    ││││   0x00403a56      8d94089803..   lea edx, [eax + ecx + 0x398]
│    ││││   0x00403a5d      52             push edx
│    ││││   0x00403a5e      57             push edi
│    ││││   0x00403a5f      ffd3           call ebx
│    ││││   0x00403a61      8b4628         mov eax, dword [esi + 0x28]
│    ││││   0x00403a64      8b5624         mov edx, dword [esi + 0x24]
│    ││││   0x00403a67      8d8c00f2fe..   lea ecx, [eax + eax - 0x10e]
│    ││││   0x00403a6e      8b462c         mov eax, dword [esi + 0x2c]
│    ││││   0x00403a71      51             push ecx                    ; int nYEnd
│    ││││   0x00403a72      8d8c029803..   lea ecx, [edx + eax + 0x398]
│    ││││   0x00403a79      51             push ecx                    ; int nXEnd
│    ││││   0x00403a7a      57             push edi                    ; HDC hdc
│    ││││   0x00403a7b      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│    ││││   0x00403a81      8b542414       mov edx, dword [var_14h_8]
│    ││││   0x00403a85      52             push edx
│   ┌─────< 0x00403a86      e977000000     jmp 0x403b02
│   │││││   ; CODE XREF from fcn.00402af0 @ 0x403a09(x)
│   │└────> 0x00403a8b      6800ff0000     push 0xff00
│   │ │││   0x00403a90      6a0a           push 0xa                    ; 10
│   │ │││   0x00403a92      6a00           push 0
│   │ │││   0x00403a94      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│   │ │││   0x00403a9a      50             push eax
│   │ │││   0x00403a9b      57             push edi
│   │ │││   0x00403a9c      8944241c       mov dword [var_1ch_10], eax
│   │ │││   0x00403aa0      ffd5           call ebp
│   │ │││   0x00403aa2      6a05           push 5                      ; 5
│   │ │││   0x00403aa4      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│   │ │││   0x00403aaa      50             push eax
│   │ │││   0x00403aab      57             push edi
│   │ │││   0x00403aac      ffd5           call ebp
│   │ │││   0x00403aae      8b4628         mov eax, dword [esi + 0x28]
│   │ │││   0x00403ab1      8d8c00f2fe..   lea ecx, [eax + eax - 0x10e]
│   │ │││   0x00403ab8      894c2418       mov dword [var_18h_5], ecx
│   │ │││   0x00403abc      db442418       fild dword [esp + 0x18]
│   │ │││   0x00403ac0      6a00           push 0
│   │ │││   0x00403ac2      d8642420       fsub dword [var_20h]
│   │ │││   0x00403ac6      e8b5100000     call fcn.00404b80
│   │ │││   0x00403acb      8b5624         mov edx, dword [esi + 0x24]
│   │ │││   0x00403ace      50             push eax
│   │ │││   0x00403acf      8b462c         mov eax, dword [esi + 0x2c]
│   │ │││   0x00403ad2      8d8c029803..   lea ecx, [edx + eax + 0x398]
│   │ │││   0x00403ad9      51             push ecx
│   │ │││   0x00403ada      57             push edi
│   │ │││   0x00403adb      ffd3           call ebx
│   │ │││   0x00403add      8b5628         mov edx, dword [esi + 0x28]
│   │ │││   0x00403ae0      8b4e24         mov ecx, dword [esi + 0x24]
│   │ │││   0x00403ae3      8d8412f2fe..   lea eax, [edx + edx - 0x10e]
│   │ │││   0x00403aea      8b562c         mov edx, dword [esi + 0x2c]
│   │ │││   0x00403aed      50             push eax                    ; int nYEnd
│   │ │││   0x00403aee      8d84119803..   lea eax, [ecx + edx + 0x398]
│   │ │││   0x00403af5      50             push eax                    ; int nXEnd
│   │ │││   0x00403af6      57             push edi                    ; HDC hdc
│   │ │││   0x00403af7      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│   │ │││   0x00403afd      8b4c2414       mov ecx, dword [var_14h_8]
│   │ │││   0x00403b01      51             push ecx
│   │ │││   ; CODE XREF from fcn.00402af0 @ 0x403a86(x)
│   └─────> 0x00403b02      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00403b08      c7464c0100..   mov dword [esi + 0x4c], 1
│     │││   0x00403b0f      90             nop
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403c5d(x)
│    ┌────> 0x00403b10      8b464c         mov eax, dword [esi + 0x4c]
│    ╎│││   0x00403b13      d9448650       fld dword [esi + eax*4 + 0x50]
│    ╎│││   0x00403b17      d8a486c800..   fsub dword [esi + eax*4 + 0xc8]
│    ╎│││   0x00403b1e      e85d100000     call fcn.00404b80
│    ╎│││   0x00403b23      8944241c       mov dword [var_1ch_11], eax
│    ╎│││   0x00403b27      8b464c         mov eax, dword [esi + 0x4c]
│    ╎│││   0x00403b2a      d9448654       fld dword [esi + eax*4 + 0x54]
│    ╎│││   0x00403b2e      d8a486cc00..   fsub dword [esi + eax*4 + 0xcc]
│    ╎│││   0x00403b35      e846100000     call fcn.00404b80
│    ╎│││   0x00403b3a      837c241c00     cmp dword [var_1ch_11], 0
│    ╎│││   0x00403b3f      89442418       mov dword [var_14h_8], eax
│   ┌─────< 0x00403b43      0f8c8a000000   jl 0x403bd3
│   │╎│││   0x00403b49      85c0           test eax, eax
│  ┌──────< 0x00403b4b      0f8c82000000   jl 0x403bd3
│  ││╎│││   0x00403b51      6800ff0000     push 0xff00
│  ││╎│││   0x00403b56      6a05           push 5                      ; 5
│  ││╎│││   0x00403b58      6a00           push 0
│  ││╎│││   0x00403b5a      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│  ││╎│││   0x00403b60      50             push eax
│  ││╎│││   0x00403b61      57             push edi
│  ││╎│││   0x00403b62      8944241c       mov dword [var_1ch_12], eax
│  ││╎│││   0x00403b66      ffd5           call ebp
│  ││╎│││   0x00403b68      6a05           push 5                      ; 5
│  ││╎│││   0x00403b6a      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│  ││╎│││   0x00403b70      50             push eax
│  ││╎│││   0x00403b71      57             push edi
│  ││╎│││   0x00403b72      ffd5           call ebp
│  ││╎│││   0x00403b74      8b5628         mov edx, dword [esi + 0x28]
│  ││╎│││   0x00403b77      8d8412f2fe..   lea eax, [edx + edx - 0x10e]
│  ││╎│││   0x00403b7e      2b44241c       sub eax, dword [var_1ch_13]
│  ││╎│││   0x00403b82      8b562c         mov edx, dword [esi + 0x2c]
│  ││╎│││   0x00403b85      6a00           push 0
│  ││╎│││   0x00403b87      50             push eax
│  ││╎│││   0x00403b88      8b464c         mov eax, dword [esi + 0x4c]
│  ││╎│││   0x00403b8b      8d0c80         lea ecx, [eax + eax*4]
│  ││╎│││   0x00403b8e      c1e104         shl ecx, 4
│  ││╎│││   0x00403b91      034e24         add ecx, dword [esi + 0x24]
│  ││╎│││   0x00403b94      8d441164       lea eax, [ecx + edx + 0x64]
│  ││╎│││   0x00403b98      50             push eax
│  ││╎│││   0x00403b99      57             push edi
│  ││╎│││   0x00403b9a      ffd3           call ebx
│  ││╎│││   0x00403b9c      8b4e28         mov ecx, dword [esi + 0x28]
│  ││╎│││   0x00403b9f      8b464c         mov eax, dword [esi + 0x4c]
│  ││╎│││   0x00403ba2      8d0480         lea eax, [eax + eax*4]
│  ││╎│││   0x00403ba5      8d9409f2fe..   lea edx, [ecx + ecx - 0x10e]
│  ││╎│││   0x00403bac      2b542418       sub edx, dword [nYEnd]
│  ││╎│││   0x00403bb0      8b4e2c         mov ecx, dword [esi + 0x2c]
│  ││╎│││   0x00403bb3      c1e004         shl eax, 4
│  ││╎│││   0x00403bb6      034624         add eax, dword [esi + 0x24]
│  ││╎│││   0x00403bb9      52             push edx                    ; int nYEnd
│  ││╎│││   0x00403bba      8d9408b400..   lea edx, [eax + ecx + 0xb4]
│  ││╎│││   0x00403bc1      52             push edx                    ; int nXEnd
│  ││╎│││   0x00403bc2      57             push edi                    ; HDC hdc
│  ││╎│││   0x00403bc3      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│  ││╎│││   0x00403bc9      8b442414       mov eax, dword [var_14h_9]
│  ││╎│││   0x00403bcd      50             push eax
│ ┌───────< 0x00403bce      e97d000000     jmp 0x403c50
│ │││╎│││   ; CODE XREFS from fcn.00402af0 @ 0x403b43(x), 0x403b4b(x)
│ │└└─────> 0x00403bd3      68ff000000     push 0xff                   ; 255
│ │  ╎│││   0x00403bd8      6a05           push 5                      ; 5
│ │  ╎│││   0x00403bda      6a00           push 0
│ │  ╎│││   0x00403bdc      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│ │  ╎│││   0x00403be2      50             push eax
│ │  ╎│││   0x00403be3      57             push edi
│ │  ╎│││   0x00403be4      8944241c       mov dword [var_1ch_12], eax
│ │  ╎│││   0x00403be8      ffd5           call ebp
│ │  ╎│││   0x00403bea      6a05           push 5                      ; 5
│ │  ╎│││   0x00403bec      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│ │  ╎│││   0x00403bf2      50             push eax
│ │  ╎│││   0x00403bf3      57             push edi
│ │  ╎│││   0x00403bf4      ffd5           call ebp
│ │  ╎│││   0x00403bf6      8b4e28         mov ecx, dword [esi + 0x28]
│ │  ╎│││   0x00403bf9      8b464c         mov eax, dword [esi + 0x4c]
│ │  ╎│││   0x00403bfc      8d0480         lea eax, [eax + eax*4]
│ │  ╎│││   0x00403bff      8d9409f2fe..   lea edx, [ecx + ecx - 0x10e]
│ │  ╎│││   0x00403c06      2b54241c       sub edx, dword [var_1ch_13]
│ │  ╎│││   0x00403c0a      8b4e2c         mov ecx, dword [esi + 0x2c]
│ │  ╎│││   0x00403c0d      6a00           push 0
│ │  ╎│││   0x00403c0f      c1e004         shl eax, 4
│ │  ╎│││   0x00403c12      034624         add eax, dword [esi + 0x24]
│ │  ╎│││   0x00403c15      52             push edx
│ │  ╎│││   0x00403c16      8d540864       lea edx, [eax + ecx + 0x64]
│ │  ╎│││   0x00403c1a      52             push edx
│ │  ╎│││   0x00403c1b      57             push edi
│ │  ╎│││   0x00403c1c      ffd3           call ebx
│ │  ╎│││   0x00403c1e      8b4628         mov eax, dword [esi + 0x28]
│ │  ╎│││   0x00403c21      8d8c00f2fe..   lea ecx, [eax + eax - 0x10e]
│ │  ╎│││   0x00403c28      8b464c         mov eax, dword [esi + 0x4c]
│ │  ╎│││   0x00403c2b      2b4c2418       sub ecx, dword [nYEnd]
│ │  ╎│││   0x00403c2f      8d1480         lea edx, [eax + eax*4]
│ │  ╎│││   0x00403c32      8b462c         mov eax, dword [esi + 0x2c]
│ │  ╎│││   0x00403c35      c1e204         shl edx, 4
│ │  ╎│││   0x00403c38      035624         add edx, dword [esi + 0x24]
│ │  ╎│││   0x00403c3b      51             push ecx                    ; int nYEnd
│ │  ╎│││   0x00403c3c      8d8c02b400..   lea ecx, [edx + eax + 0xb4]
│ │  ╎│││   0x00403c43      51             push ecx                    ; int nXEnd
│ │  ╎│││   0x00403c44      57             push edi                    ; HDC hdc
│ │  ╎│││   0x00403c45      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│ │  ╎│││   0x00403c4b      8b542414       mov edx, dword [var_14h_9]
│ │  ╎│││   0x00403c4f      52             push edx
│ │  ╎│││   ; CODE XREF from fcn.00402af0 @ 0x403bce(x)
│ └───────> 0x00403c50      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│    ╎│││   0x00403c56      ff464c         inc dword [esi + 0x4c]
│    ╎│││   0x00403c59      837e4c0a       cmp dword [esi + 0x4c], 0xa
│    └────< 0x00403c5d      0f8cadfeffff   jl 0x403b10
│     │││   0x00403c63      68ffc86400     push 0x64c8ff
│     │││   0x00403c68      6a05           push 5                      ; 5
│     │││   0x00403c6a      6a00           push 0
│     │││   0x00403c6c      ff1518604000   call dword [sym.imp.GDI32.dll_CreatePen] ; 0x406018 ; ".\x8c" ; hpen CreatePen(_PS fnPenStyle, int nWidth, COLORREF crColor)
│     │││   0x00403c72      50             push eax
│     │││   0x00403c73      57             push edi
│     │││   0x00403c74      8944241c       mov dword [var_1ch_14], eax
│     │││   0x00403c78      ffd5           call ebp
│     │││   0x00403c7a      6a05           push 5                      ; 5
│     │││   0x00403c7c      ff151c604000   call dword [sym.imp.GDI32.dll_GetStockObject] ; 0x40601c ; hgdiobj GetStockObject(void)
│     │││   0x00403c82      50             push eax
│     │││   0x00403c83      57             push edi
│     │││   0x00403c84      ffd5           call ebp
│     │││   0x00403c86      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00403c89      8d4c00ba       lea ecx, [eax + eax - 0x46]
│     │││   0x00403c8d      a13ca34000     mov eax, dword [0x40a33c]   ; [0x40a33c:4]=0
│     │││   0x00403c92      8d1480         lea edx, [eax + eax*4]
│     │││   0x00403c95      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00403c98      6a00           push 0
│     │││   0x00403c9a      c1e204         shl edx, 4
│     │││   0x00403c9d      035624         add edx, dword [esi + 0x24]
│     │││   0x00403ca0      51             push ecx
│     │││   0x00403ca1      8d4c0264       lea ecx, [edx + eax + 0x64]
│     │││   0x00403ca5      51             push ecx
│     │││   0x00403ca6      57             push edi
│     │││   0x00403ca7      ffd3           call ebx
│     │││   0x00403ca9      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x00403cac      8d84122afe..   lea eax, [edx + edx - 0x1d6]
│     │││   0x00403cb3      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x00403cb6      50             push eax                    ; int nYEnd
│     │││   0x00403cb7      a13ca34000     mov eax, dword [0x40a33c]   ; [0x40a33c:4]=0
│     │││   0x00403cbc      8d0c80         lea ecx, [eax + eax*4]
│     │││   0x00403cbf      c1e104         shl ecx, 4
│     │││   0x00403cc2      034e24         add ecx, dword [esi + 0x24]
│     │││   0x00403cc5      8d441164       lea eax, [ecx + edx + 0x64]
│     │││   0x00403cc9      50             push eax                    ; int nXEnd
│     │││   0x00403cca      57             push edi                    ; HDC hdc
│     │││   0x00403ccb      ff152c604000   call dword [sym.imp.GDI32.dll_LineTo] ; 0x40602c ; bool LineTo(HDC hdc, int nXEnd, int nYEnd)
│     │││   0x00403cd1      8b4c2414       mov ecx, dword [var_14h_10]
│     │││   0x00403cd5      51             push ecx
│     │││   0x00403cd6      ff1550604000   call dword [sym.imp.GDI32.dll_DeleteObject] ; 0x406050 ; "h\x8b" ; bool DeleteObject(void)
│     │││   0x00403cdc      68ffffff00     push 0xffffff               ; COLORREF crColor
│     │││   0x00403ce1      57             push edi                    ; HDC hdc
│     │││   0x00403ce2      ff1508604000   call dword [sym.imp.GDI32.dll_SetTextColor] ; 0x406008 ; "`\x8c" ; colorref_return SetTextColor(HDC hdc, COLORREF crColor)
│     │││   0x00403ce8      8d542438       lea edx, [var_38h_7]
│     │││   0x00403cec      6838704000     push str._difference_between_the_summed_ON_and_OFF_output_at_different_spatial_frequencies ; 0x407038 ; " difference between the summed ON and OFF output at different spatial frequencies"
│     │││   0x00403cf1      52             push edx                    ; char *s
│     │││   0x00403cf2      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00403cf8      8d442440       lea eax, [var_38h_7]
│     │││   0x00403cfc      83c408         add esp, 8
│     │││   0x00403cff      8d4801         lea ecx, [eax + 1]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403d07(x)
│    ┌────> 0x00403d02      8a10           mov dl, byte [eax]
│    ╎│││   0x00403d04      40             inc eax
│    ╎│││   0x00403d05      84d2           test dl, dl
│    └────< 0x00403d07      75f9           jne 0x403d02
│     │││   0x00403d09      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x00403d0c      2bc1           sub eax, ecx
│     │││   0x00403d0e      8b4e28         mov ecx, dword [esi + 0x28]
│     │││   0x00403d11      50             push eax                    ; int cbString
│     │││   0x00403d12      8d44243c       lea eax, [var_38h_7]
│     │││   0x00403d16      50             push eax                    ; LPCSTR lpString
│     │││   0x00403d17      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00403d1a      83e914         sub ecx, 0x14               ; 20
│     │││   0x00403d1d      51             push ecx                    ; int nYStart
│     │││   0x00403d1e      8d4c0278       lea ecx, [edx + eax + 0x78]
│     │││   0x00403d22      51             push ecx                    ; int nXStart
│     │││   0x00403d23      57             push edi                    ; HDC hdc
│     │││   0x00403d24      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x00403d2a      6a02           push 2                      ; 2 ; int iBkMode
│     │││   0x00403d2c      57             push edi                    ; HDC hdc
│     │││   0x00403d2d      ff150c604000   call dword [sym.imp.GDI32.dll_SetBkMode] ; 0x40600c ; "T\x8c" ; long SetBkMode(HDC hdc, int iBkMode)
│     │││   0x00403d33      8b1d08604000   mov ebx, dword [sym.imp.GDI32.dll_SetTextColor] ; [0x406008:4]=0x8c60 reloc.GDI32.dll_SetTextColor ; "`\x8c"
│     │││   0x00403d39      6864ffff00     push 0xffff64
│     │││   0x00403d3e      57             push edi
│     │││   0x00403d3f      ffd3           call ebx
│     │││   0x00403d41      8d542438       lea edx, [var_38h_8]
│     │││   0x00403d45      68e86f4000     push str._realtime_ON_OFF_analysis_of_the_visual_world__F._Schaeffel__March_19__2016 ; 0x406fe8 ; " realtime ON-OFF analysis of the visual world, F. Schaeffel, March 19, 2016"
│     │││   0x00403d4a      52             push edx                    ; char *s
│     │││   0x00403d4b      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00403d51      8d442440       lea eax, [var_38h_8]
│     │││   0x00403d55      83c408         add esp, 8
│     │││   0x00403d58      8d4801         lea ecx, [eax + 1]
│    ┌────< 0x00403d5b      eb03           jmp 0x403d60
..
│    ││││   ; CODE XREFS from fcn.00402af0 @ 0x403d5b(x), 0x403d65(x)
│   ┌└────> 0x00403d60      8a10           mov dl, byte [eax]
│   ╎ │││   0x00403d62      40             inc eax
│   ╎ │││   0x00403d63      84d2           test dl, dl
│   └─────< 0x00403d65      75f9           jne 0x403d60
│     │││   0x00403d67      2bc1           sub eax, ecx
│     │││   0x00403d69      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x00403d6c      50             push eax
│     │││   0x00403d6d      8d44243c       lea eax, [var_38h_8]
│     │││   0x00403d71      50             push eax
│     │││   0x00403d72      6a00           push 0
│     │││   0x00403d74      83c150         add ecx, 0x50               ; 80
│     │││   0x00403d77      51             push ecx                    ; int nXStart
│     │││   0x00403d78      57             push edi                    ; HDC hdc
│     │││   0x00403d79      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x00403d7f      c744242400..   mov dword [var_24h], 0
│     │││   0x00403d87      c7442420f8..   mov dword [var_20h_2], vtable.CFont.0 ; [0x406ef8:4]=0x404938 method.CFont.virtual_0 ; "8I@"
│     │││   0x00403d8f      68e06f4000     push str.Arial              ; 0x406fe0 ; "Arial"
│     │││   0x00403d94      6a00           push 0
│     │││   0x00403d96      6a00           push 0
│     │││   0x00403d98      6a00           push 0
│     │││   0x00403d9a      6a00           push 0
│     │││   0x00403d9c      6a01           push 1                      ; 1
│     │││   0x00403d9e      6a00           push 0
│     │││   0x00403da0      6a00           push 0
│     │││   0x00403da2      6a00           push 0
│     │││   0x00403da4      68f4010000     push 0x1f4                  ; 500
│     │││   0x00403da9      6a00           push 0
│     │││   0x00403dab      6a00           push 0
│     │││   0x00403dad      6a00           push 0
│     │││   0x00403daf      6a24           push 0x24                   ; '$' ; 36 ; int nHeight
│     │││   0x00403db1      c684244401..   mov byte [var_144h], 2
│     │││   0x00403db9      ff1530604000   call dword [sym.imp.GDI32.dll_CreateFontA] ; 0x406030 ; hfont CreateFontA(int nHeight, int nWidth, int nEscapement, int nOrientation, _FW fnWeight, DWORD fdwItalic, DWORD fdwUnderline, DWORD fdwStrikeOut, _CHARSET fdwCharSet, _OUT fdwOutputPrecision, _CLIP fdwClipPrecision, _OUT fdwQuality, _FF fdwPitchAndFamily, LPCSTR lpszFace)
│     │││   0x00403dbf      50             push eax
│     │││   0x00403dc0      8d4c2424       lea ecx, [var_24h_2]
│     │││   0x00403dc4      e8750b0000     call sub.mfc90.dll_Ordinal_1358
│     │││   0x00403dc9      8b542424       mov edx, dword [var_24h_2]
│     │││   0x00403dcd      52             push edx
│     │││   0x00403dce      57             push edi
│     │││   0x00403dcf      ffd5           call ebp
│     │││   0x00403dd1      6800ff0000     push 0xff00
│     │││   0x00403dd6      57             push edi
│     │││   0x00403dd7      ffd3           call ebx
│     │││   0x00403dd9      d94644         fld dword [esi + 0x44]
│     │││   0x00403ddc      83ec08         sub esp, 8
│     │││   0x00403ddf      dd1c24         fstp qword [esp]
│     │││   0x00403de2      8d442440       lea eax, [var_40h_2]
│     │││   0x00403de6      68b46f4000     push str._sum_of_all_averaged_ON_responses___3.1f ; 0x406fb4 ; " sum of all averaged ON responses = %3.1f"
│     │││   0x00403deb      50             push eax                    ; char *s
│     │││   0x00403dec      ff1510614000   call dword [sym.imp.MSVCR90.dll_sprintf] ; 0x406110 ; int sprintf(char *s, const char *format, ...)
│     │││   0x00403df2      8d442448       lea eax, [var_40h_2]
│     │││   0x00403df6      83c410         add esp, 0x10
│     │││   0x00403df9      8d6801         lea ebp, [eax + 1]
│     │││   0x00403dfc      8d642400       lea esp, [esp]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403e05(x)
│    ┌────> 0x00403e00      8a08           mov cl, byte [eax]
│    ╎│││   0x00403e02      40             inc eax
│    ╎│││   0x00403e03      84c9           test cl, cl
│    └────< 0x00403e05      75f9           jne 0x403e00
│     │││   0x00403e07      8b5628         mov edx, dword [esi + 0x28]
│     │││   0x00403e0a      2bc5           sub eax, ebp
│     │││   0x00403e0c      50             push eax                    ; int cbString
│     │││   0x00403e0d      8d4c243c       lea ecx, [var_40h_2]
│     │││   0x00403e11      51             push ecx                    ; LPCSTR lpString
│     │││   0x00403e12      8b4e24         mov ecx, dword [esi + 0x24]
│     │││   0x00403e15      8d84123efe..   lea eax, [edx + edx - 0x1c2]
│     │││   0x00403e1c      8b562c         mov edx, dword [esi + 0x2c]
│     │││   0x00403e1f      50             push eax                    ; int nYStart
│     │││   0x00403e20      8d441178       lea eax, [ecx + edx + 0x78]
│     │││   0x00403e24      50             push eax                    ; int nXStart
│     │││   0x00403e25      57             push edi                    ; HDC hdc
│     │││   0x00403e26      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x00403e2c      68ff000000     push 0xff                   ; 255
│     │││   0x00403e31      57             push edi
│     │││   0x00403e32      ffd3           call ebx
│     │││   0x00403e34      d94648         fld dword [esi + 0x48]
│     │││   0x00403e37      8b2d10614000   mov ebp, dword [sym.imp.MSVCR90.dll_sprintf] ; [0x406110:4]=0x87aa reloc.MSVCR90.dll_sprintf
│     │││   0x00403e3d      83ec08         sub esp, 8
│     │││   0x00403e40      dd1c24         fstp qword [esp]
│     │││   0x00403e43      8d4c2440       lea ecx, [var_40h_3]
│     │││   0x00403e47      68886f4000     push str._sum_of_all_averaged_OFF_responses___3.1f ; 0x406f88 ; " sum of all averaged OFF responses = %3.1f"
│     │││   0x00403e4c      51             push ecx
│     │││   0x00403e4d      ffd5           call ebp
│     │││   0x00403e4f      8d442448       lea eax, [var_40h_3]
│     │││   0x00403e53      83c410         add esp, 0x10
│     │││   0x00403e56      8d4801         lea ecx, [eax + 1]
│     │││   0x00403e59      8da4240000..   lea esp, [esp]
│     │││   ; CODE XREF from fcn.00402af0 @ 0x403e65(x)
│    ┌────> 0x00403e60      8a10           mov dl, byte [eax]
│    ╎│││   0x00403e62      40             inc eax
│    ╎│││   0x00403e63      84d2           test dl, dl
│    └────< 0x00403e65      75f9           jne 0x403e60
│     │││   0x00403e67      2bc1           sub eax, ecx
│     │││   0x00403e69      50             push eax                    ; int cbString
│     │││   0x00403e6a      8b4628         mov eax, dword [esi + 0x28]
│     │││   0x00403e6d      8d54243c       lea edx, [var_40h_3]
│     │││   0x00403e71      52             push edx                    ; LPCSTR lpString
│     │││   0x00403e72      8b5624         mov edx, dword [esi + 0x24]
│     │││   0x00403e75      8d8c007eff..   lea ecx, [eax + eax - 0x82]
│     │││   0x00403e7c      8b462c         mov eax, dword [esi + 0x2c]
│     │││   0x00403e7f      51             push ecx                    ; int nYStart
│     │││   0x00403e80      8d4c0278       lea ecx, [edx + eax + 0x78]
│     │││   0x00403e84      51             push ecx                    ; int nXStart
│     │││   0x00403e85      57             push edi                    ; HDC hdc
│     │││   0x00403e86      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x00403e8c      d94644         fld dword [esi + 0x44]
│     │││   0x00403e8f      d86648         fsub dword [esi + 0x48]
│     │││   0x00403e92      6800007f00     push 0x7f0000
│     │││   0x00403e97      57             push edi
│     │││   0x00403e98      dc1d806f4000   fcomp qword [0x406f80]
│     │││   0x00403e9e      dfe0           fnstsw ax
│     │││   0x00403ea0      f6c405         test ah, 5                  ; 5
│    ┌────< 0x00403ea3      0f8ac4000000   jp 0x403f6d
│    ││││   0x00403ea9      ff1514604000   call dword [sym.imp.GDI32.dll_SetBkColor] ; 0x406014 ; ":\x8c" ; colorref_return SetBkColor(HDC hdc, COLORREF crColor)
│    ││││   0x00403eaf      68ff000000     push 0xff                   ; 255
│    ││││   0x00403eb4      57             push edi
│    ││││   0x00403eb5      ffd3           call ebx
│    ││││   0x00403eb7      d94644         fld dword [esi + 0x44]
│    ││││   0x00403eba      d86648         fsub dword [esi + 0x48]
│    ││││   0x00403ebd      83ec08         sub esp, 8
│    ││││   0x00403ec0      8d542440       lea edx, [var_40h_4]
│    ││││   0x00403ec4      dd1c24         fstp qword [esp]
│    ││││   0x00403ec7      68646f4000     push str._more_OFF___3.1f_  ; 0x406f64 ; " more OFF (%3.1f)"
│    ││││   0x00403ecc      52             push edx
│    ││││   0x00403ecd      ffd5           call ebp
│    ││││   0x00403ecf      8d442448       lea eax, [var_40h_4]
│    ││││   0x00403ed3      83c410         add esp, 0x10
│    ││││   0x00403ed6      8d4801         lea ecx, [eax + 1]
│    ││││   0x00403ed9      8da4240000..   lea esp, [esp]
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x403ee5(x)
│   ┌─────> 0x00403ee0      8a10           mov dl, byte [eax]
│   ╎││││   0x00403ee2      40             inc eax
│   ╎││││   0x00403ee3      84d2           test dl, dl
│   └─────< 0x00403ee5      75f9           jne 0x403ee0
│    ││││   0x00403ee7      2bc1           sub eax, ecx
│    ││││   0x00403ee9      8b4e28         mov ecx, dword [esi + 0x28]
│    ││││   0x00403eec      50             push eax                    ; int cbString
│    ││││   0x00403eed      8d44243c       lea eax, [var_40h_4]
│    ││││   0x00403ef1      50             push eax                    ; LPCSTR lpString
│    ││││   0x00403ef2      8b4624         mov eax, dword [esi + 0x24]
│    ││││   0x00403ef5      8d9409e8fe..   lea edx, [ecx + ecx - 0x118]
│    ││││   0x00403efc      8b4e2c         mov ecx, dword [esi + 0x2c]
│    ││││   0x00403eff      52             push edx                    ; int nYStart
│    ││││   0x00403f00      8d9408a203..   lea edx, [eax + ecx + 0x3a2]
│    ││││   0x00403f07      52             push edx                    ; int nXStart
│    ││││   0x00403f08      57             push edi                    ; HDC hdc
│    ││││   0x00403f09      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│    ││││   0x00403f0f      68ff000000     push 0xff                   ; 255 ; COLORREF crColor
│    ││││   0x00403f14      57             push edi                    ; HDC hdc
│    ││││   0x00403f15      ff1514604000   call dword [sym.imp.GDI32.dll_SetBkColor] ; 0x406014 ; ":\x8c" ; colorref_return SetBkColor(HDC hdc, COLORREF crColor)
│    ││││   0x00403f1b      68ffff6400     push 0x64ffff
│    ││││   0x00403f20      57             push edi
│    ││││   0x00403f21      ffd3           call ebx
│    ││││   0x00403f23      8d442438       lea eax, [var_38h_9]
│    ││││   0x00403f27      68506f4000     push str._stimulates_myopia ; 0x406f50 ; " stimulates myopia"
│    ││││   0x00403f2c      50             push eax
│    ││││   0x00403f2d      ffd5           call ebp
│    ││││   0x00403f2f      8d442440       lea eax, [var_38h_9]
│    ││││   0x00403f33      83c408         add esp, 8
│    ││││   0x00403f36      8d4801         lea ecx, [eax + 1]
│    ││││   0x00403f39      8da4240000..   lea esp, [esp]
│    ││││   ; CODE XREF from fcn.00402af0 @ 0x403f45(x)
│   ┌─────> 0x00403f40      8a10           mov dl, byte [eax]
│   ╎││││   0x00403f42      40             inc eax
│   ╎││││   0x00403f43      84d2           test dl, dl
│   └─────< 0x00403f45      75f9           jne 0x403f40
│    ││││   0x00403f47      8b5628         mov edx, dword [esi + 0x28]
│    ││││   0x00403f4a      2bc1           sub eax, ecx
│    ││││   0x00403f4c      50             push eax
│    ││││   0x00403f4d      8d4c243c       lea ecx, [var_38h_9]
│    ││││   0x00403f51      51             push ecx
│    ││││   0x00403f52      8b4e24         mov ecx, dword [esi + 0x24]
│    ││││   0x00403f55      8d841210ff..   lea eax, [edx + edx - 0xf0]
│    ││││   0x00403f5c      8b562c         mov edx, dword [esi + 0x2c]
│    ││││   0x00403f5f      50             push eax
│    ││││   0x00403f60      8d8411a203..   lea eax, [ecx + edx + 0x3a2]
│    ││││   0x00403f67      50             push eax
│   ┌─────< 0x00403f68      e9bb000000     jmp 0x404028
│   │││││   ; CODE XREF from fcn.00402af0 @ 0x403ea3(x)
│   │└────> 0x00403f6d      ff1514604000   call dword [sym.imp.GDI32.dll_SetBkColor] ; 0x406014 ; ":\x8c" ; colorref_return SetBkColor(HDC hdc, COLORREF crColor)
│   │ │││   0x00403f73      6800ff0000     push 0xff00
│   │ │││   0x00403f78      57             push edi
│   │ │││   0x00403f79      ffd3           call ebx
│   │ │││   0x00403f7b      d94644         fld dword [esi + 0x44]
│   │ │││   0x00403f7e      d86648         fsub dword [esi + 0x48]
│   │ │││   0x00403f81      83ec08         sub esp, 8
│   │ │││   0x00403f84      8d4c2440       lea ecx, [var_40h_4]
│   │ │││   0x00403f88      dd1c24         fstp qword [esp]
│   │ │││   0x00403f8b      683c6f4000     push str._more_ON___3.1f_   ; 0x406f3c ; " more ON (%3.1f)"
│   │ │││   0x00403f90      51             push ecx
│   │ │││   0x00403f91      ffd5           call ebp
│   │ │││   0x00403f93      8d442448       lea eax, [var_40h_4]
│   │ │││   0x00403f97      83c410         add esp, 0x10
│   │ │││   0x00403f9a      8d4801         lea ecx, [eax + 1]
│   │ │││   0x00403f9d      8d4900         lea ecx, [ecx]
│   │ │││   ; CODE XREF from fcn.00402af0 @ 0x403fa5(x)
│   │┌────> 0x00403fa0      8a10           mov dl, byte [eax]
│   │╎│││   0x00403fa2      40             inc eax
│   │╎│││   0x00403fa3      84d2           test dl, dl
│   │└────< 0x00403fa5      75f9           jne 0x403fa0
│   │ │││   0x00403fa7      2bc1           sub eax, ecx
│   │ │││   0x00403fa9      50             push eax                    ; int cbString
│   │ │││   0x00403faa      8b4628         mov eax, dword [esi + 0x28]
│   │ │││   0x00403fad      8d54243c       lea edx, [var_40h_4]
│   │ │││   0x00403fb1      52             push edx                    ; LPCSTR lpString
│   │ │││   0x00403fb2      8b5624         mov edx, dword [esi + 0x24]
│   │ │││   0x00403fb5      8d8c00e8fe..   lea ecx, [eax + eax - 0x118]
│   │ │││   0x00403fbc      8b462c         mov eax, dword [esi + 0x2c]
│   │ │││   0x00403fbf      51             push ecx                    ; int nYStart
│   │ │││   0x00403fc0      8d8c02a203..   lea ecx, [edx + eax + 0x3a2]
│   │ │││   0x00403fc7      51             push ecx                    ; int nXStart
│   │ │││   0x00403fc8      57             push edi                    ; HDC hdc
│   │ │││   0x00403fc9      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│   │ │││   0x00403fcf      68007f0000     push 0x7f00                 ; COLORREF crColor
│   │ │││   0x00403fd4      57             push edi                    ; HDC hdc
│   │ │││   0x00403fd5      ff1514604000   call dword [sym.imp.GDI32.dll_SetBkColor] ; 0x406014 ; ":\x8c" ; colorref_return SetBkColor(HDC hdc, COLORREF crColor)
│   │ │││   0x00403fdb      68ffff6400     push 0x64ffff
│   │ │││   0x00403fe0      57             push edi
│   │ │││   0x00403fe1      ffd3           call ebx
│   │ │││   0x00403fe3      8d542438       lea edx, [var_38h_9]
│   │ │││   0x00403fe7      68206f4000     push str.________no_myopia  ; 0x406f20 ; "        no myopia"
│   │ │││   0x00403fec      52             push edx
│   │ │││   0x00403fed      ffd5           call ebp
│   │ │││   0x00403fef      8d442440       lea eax, [var_38h_9]
│   │ │││   0x00403ff3      83c408         add esp, 8
│   │ │││   0x00403ff6      8d4801         lea ecx, [eax + 1]
│   │ │││   0x00403ff9      8da4240000..   lea esp, [esp]
│   │ │││   ; CODE XREF from fcn.00402af0 @ 0x404005(x)
│   │┌────> 0x00404000      8a10           mov dl, byte [eax]
│   │╎│││   0x00404002      40             inc eax
│   │╎│││   0x00404003      84d2           test dl, dl
│   │└────< 0x00404005      75f9           jne 0x404000
│   │ │││   0x00404007      2bc1           sub eax, ecx
│   │ │││   0x00404009      8b4e28         mov ecx, dword [esi + 0x28]
│   │ │││   0x0040400c      50             push eax
│   │ │││   0x0040400d      8d44243c       lea eax, [var_38h_9]
│   │ │││   0x00404011      50             push eax
│   │ │││   0x00404012      8b4624         mov eax, dword [esi + 0x24]
│   │ │││   0x00404015      8d940910ff..   lea edx, [ecx + ecx - 0xf0]
│   │ │││   0x0040401c      8b4e2c         mov ecx, dword [esi + 0x2c]
│   │ │││   0x0040401f      52             push edx
│   │ │││   0x00404020      8d9408a203..   lea edx, [eax + ecx + 0x3a2]
│   │ │││   0x00404027      52             push edx
│   │ │││   ; CODE XREF from fcn.00402af0 @ 0x403f68(x)
│   └─────> 0x00404028      57             push edi                    ; HDC hdc
│     │││   0x00404029      ff1510604000   call dword [sym.imp.GDI32.dll_TextOutA] ; 0x406010 ; "H\x8c" ; bool TextOutA(HDC hdc, int nXStart, int nYStart, LPCSTR lpString, int cbString)
│     │││   0x0040402f      8b4614         mov eax, dword [esi + 0x14]
│     │││   0x00404032      8b4e10         mov ecx, dword [esi + 0x10]
│     │││   0x00404035      8b742428       mov esi, dword [var_28h]
│     │││   0x00404039      682000cc00     push 0xcc0020               ; ' '
│     │││   0x0040403e      6a00           push 0
│     │││   0x00404040      6a00           push 0
│     │││   0x00404042      57             push edi
│     │││   0x00404043      50             push eax
│     │││   0x00404044      51             push ecx
│     │││   0x00404045      6a00           push 0
│     │││   0x00404047      6a00           push 0
│     │││   0x00404049      56             push esi                    ; HDC hdcDest
│     │││   0x0040404a      ff154c604000   call dword [sym.imp.GDI32.dll_BitBlt] ; 0x40604c ; "x\x8b" ; bool BitBlt(HDC hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, HDC hdcSrc, int nXSrc, int nYSrc, _TernaryDrawMode dwRop)
│     │││   0x00404050      57             push edi
│     │││   0x00404051      ff1544604000   call dword [sym.imp.GDI32.dll_DeleteDC] ; 0x406044 ; bool DeleteDC(void)
│     │││   0x00404057      8b4c242c       mov ecx, dword [var_2ch_3]
│     │││   0x0040405b      56             push esi
│     │││   0x0040405c      ff159c614000   call dword [sym.imp.TIS_UDSHL08_vc9.dll__getHWND_Grabber_DShowLib__QBEPAUHWND____XZ] ; 0x40619c
│     │││   0x00404062      50             push eax                    ; HWND hWnd
│     │││   0x00404063      ff15b0614000   call dword [sym.imp.USER32.dll_ReleaseDC] ; 0x4061b0 ; "4\x8b" ; int ReleaseDC(HWND hWnd, HDC hDC)
│     │││   0x00404069      8d4c2420       lea ecx, [var_20h_3]
│     │││   0x0040406d      c684240c01..   mov byte [var_10ch_3], 1
│     │││   0x00404075      c7442420f8..   mov dword [var_20h_3], vtable.CFont.0 ; [0x406ef8:4]=0x404938 method.CFont.virtual_0 ; "8I@"
│     │││   0x0040407d      e8bee7ffff     call fcn.00402840
│     │││   0x00404082      8d4c2430       lea ecx, [var_30h_2]
│     │││   0x00404086      e8c5e9ffff     call fcn.00402a50
│     │││   ; CODE XREFS from fcn.00402af0 @ 0x402b47(x), 0x402b56(x), 0x402b60(x)
│     └└└─> 0x0040408b      8d8c241801..   lea ecx, [arg_118h]
│           0x00404092      c784240c01..   mov dword [var_10ch], 0xffffffff ; [0xffffffff:4]=-1 ; -1
│           0x0040409d      e8dee9ffff     call fcn.00402a80
│           0x004040a2      8b8c240401..   mov ecx, dword [var_104h]
│           0x004040a9      64890d0000..   mov dword fs:[0], ecx
│           0x004040b0      59             pop ecx
│           0x004040b1      5f             pop edi
│           0x004040b2      5e             pop esi
│           0x004040b3      5d             pop ebp
│           0x004040b4      5b             pop ebx
│           0x004040b5      8b8c24ec00..   mov ecx, dword [var_ech]
│           0x004040bc      33cc           xor ecx, esp
│           0x004040be      e8e7090000     call fcn.00404aaa
│           0x004040c3      81c4fc000000   add esp, 0xfc
└           0x004040c9      c20c00         ret 0xc

```
