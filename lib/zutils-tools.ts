import {
  Activity,
  ALargeSmall,
  Antenna,
  BatteryCharging,
  Binary,
  Bluetooth,
  Braces,
  Cable,
  Calculator,
  CarFront,
  CircuitBoard,
  Clock,
  Cpu,
  FileCode,
  FileDigit,
  Filter,
  FlaskConical,
  Gauge,
  GitCompare,
  Globe,
  GraduationCap,
  Grid3x3,
  Hash,
  Image,
  Lightbulb,
  Lock,
  Pipette,
  Plug,
  QrCode,
  Radio,
  Route,
  ScanLine,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  SquarePen,
  Timer,
  Type,
  Upload,
  Waves,
  type LucideIcon,
} from "lucide-react";

export interface ZutilsTool {
  slug: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  /** iframe 嵌入地址（public/zutils 下的静态页面） */
  src: string;
  /** 需要浏览器硬件 API（Web Serial / Web Bluetooth），仅在支持的环境中可用 */
  needsDevice?: boolean;
}

export interface ZutilsCategory {
  id: string;
  name: string;
  desc: string;
  tools: ZutilsTool[];
}

const toolSrc = (slug: string) => `/zutils/tools/${slug}/index.html`;

export const zutilsCategories: ZutilsCategory[] = [
  {
    id: "hardware",
    name: "硬件 / PCB",
    desc: "PCB 设计、元器件计算与固件烧录",
    tools: [
      {
        slug: "pcb-via-calculator",
        name: "PCB 过孔电流计算器",
        desc: "基于 IPC-2152 标准，计算过孔最大电流、电阻、压降等参数",
        icon: CircuitBoard,
        src: toolSrc("pcb-via-calculator"),
      },
      {
        slug: "pcb-trace-calculator",
        name: "PCB 走线宽度计算器",
        desc: "基于 IPC-2152 标准，根据电流计算所需走线宽度",
        icon: Route,
        src: toolSrc("pcb-trace-calculator"),
      },
      {
        slug: "resistor-color-code",
        name: "电阻色环阻值计算器",
        desc: "支持 4/5/6 环电阻的色环阻值、容差及温度系数计算",
        icon: SlidersHorizontal,
        src: toolSrc("resistor-color-code"),
      },
      {
        slug: "smd-resistor-code",
        name: "SMD 电阻丝印助手",
        desc: "解析三位、四位及 EIA-96 编码的贴片电阻丝印代码",
        icon: ScanLine,
        src: toolSrc("smd-resistor-code"),
      },
      {
        slug: "led-resistor-calculator",
        name: "LED 限流电阻计算器",
        desc: "计算 LED 限流电阻值，支持串并联配置，E24 标准电阻推荐",
        icon: Lightbulb,
        src: toolSrc("led-resistor-calculator"),
      },
      {
        slug: "rc-filter-calculator",
        name: "RC/RL 滤波器计算器",
        desc: "低通与高通滤波器计算，支持 RC 和 RL 电路模式，实时幅频响应曲线",
        icon: Filter,
        src: toolSrc("rc-filter-calculator"),
      },
      {
        slug: "battery-life-calculator",
        name: "电池续航计算器",
        desc: "计算电池使用寿命，支持恒定功耗和间歇性功耗两种模式",
        icon: BatteryCharging,
        src: toolSrc("battery-life-calculator"),
      },
      {
        slug: "binary-viewer",
        name: "二进制文件查看器",
        desc: "在线查看二进制文件，十六进制和 ASCII 视图，支持大文件虚拟滚动",
        icon: FileDigit,
        src: toolSrc("binary-viewer"),
      },
      {
        slug: "esp32-flash",
        name: "ESP32 在线烧录",
        desc: "基于 Web Serial API 在线烧录 ESP8266/ESP32 固件，支持多文件与自定义地址",
        icon: Upload,
        src: toolSrc("esp32-flash"),
        needsDevice: true,
      },
    ],
  },
  {
    id: "instrument",
    name: "仪器仪表",
    desc: "仿真仪器，随时随地练习测量操作",
    tools: [
      {
        slug: "oscilloscope",
        name: "示波器",
        desc: "仿真示波器，直观学习触发、时基、垂直档位等波形测量操作",
        icon: Activity,
        src: toolSrc("oscilloscope"),
      },
      {
        slug: "multimeter",
        name: "万用表",
        desc: "仿真万用表，练习电压、电流、电阻及通断档位的测量方法",
        icon: Gauge,
        src: toolSrc("multimeter"),
      },
      {
        slug: "waveform-generator",
        name: "波形发生器",
        desc: "仿真信号发生器，学习正弦、方波、三角波等波形与频率幅值调节",
        icon: Waves,
        src: toolSrc("waveform-generator"),
      },
    ],
  },
  {
    id: "labs",
    name: "仿真实验台",
    desc: "电路板级联调实验，接近真实操作手感",
    tools: [
      {
        slug: "lab-oscilloscope",
        name: "示波器仿真实验台",
        desc: "在练习电路板上实操触发、时基、探头补偿等示波器技能",
        icon: FlaskConical,
        src: "/zutils/labs/oscilloscope-learning-lab.html",
      },
      {
        slug: "lab-multimeter",
        name: "万用表测量实验台",
        desc: "配合练习电路板，实操电压、电流、电阻与通断测量",
        icon: GraduationCap,
        src: "/zutils/labs/multimeter-learning-lab.html",
      },
      {
        slug: "lab-waveform",
        name: "任意波形发生器实验台",
        desc: "学习任意波形编辑与输出，可配合示波器实验台联调",
        icon: Waves,
        src: "/zutils/labs/arbitrary-waveform-generator-lab.html",
      },
    ],
  },
  {
    id: "network",
    name: "串口 / 网络调试",
    desc: "串口、总线协议与物联网通信调试",
    tools: [
      {
        slug: "web-serial",
        name: "Web 串口助手",
        desc: "基于 Web Serial API 的在线调试",
        icon: Cable,
        src: toolSrc("web-serial"),
        needsDevice: true,
      },
      {
        slug: "baud-rate-calculator",
        name: "波特率计算器",
        desc: "51/STM32/ESP32 串口波特率与分频寄存器计算，含误差分析与初始化代码",
        icon: Gauge,
        src: toolSrc("baud-rate-calculator"),
      },
      {
        slug: "mcu-timer-calculator",
        name: "定时器/PWM 计算器",
        desc: "STM32 定时器/PWM 与 51 定时器初值计算，含误差分析与初始化代码",
        icon: Timer,
        src: toolSrc("mcu-timer-calculator"),
      },
      {
        slug: "modbus-frame-tool",
        name: "Modbus 帧工具",
        desc: "Modbus RTU 帧解析、构建和 CRC16 校验计算",
        icon: Plug,
        src: toolSrc("modbus-frame-tool"),
      },
      {
        slug: "can-bus-decoder",
        name: "CAN 总线解码器",
        desc: "11/29 位 CAN ID 与 J1939 PGN 解析，支持 Intel/Motorola 字节序信号提取与物理值换算",
        icon: CarFront,
        src: toolSrc("can-bus-decoder"),
      },
      {
        slug: "lorawan-decoder",
        name: "LoRaWAN 解码器",
        desc: "LoRaWAN PHYPayload 解析与构建、FCtrl 位拆分、JoinRequest/Accept 解析、空中时间计算",
        icon: Radio,
        src: toolSrc("lorawan-decoder"),
      },
      {
        slug: "mqtt-client",
        name: "MQTT 客户端",
        desc: "基于 WebSocket 的 MQTT 连接、订阅、发布和消息日志调试",
        icon: Antenna,
        src: toolSrc("mqtt-client"),
      },
      {
        slug: "bluetooth-debugger",
        name: "蓝牙调试器",
        desc: "基于 Web Bluetooth API 的 BLE/GATT 服务、特征值读写和通知调试",
        icon: Bluetooth,
        src: toolSrc("bluetooth-debugger"),
        needsDevice: true,
      },
      {
        slug: "matter-protocol",
        name: "Matter TLV 编解码",
        desc: "Matter 协议 TLV 二进制编解码，支持 22 种类型码与嵌套容器，JSON 双向转换",
        icon: Cpu,
        src: toolSrc("matter-protocol"),
      },
      {
        slug: "http-client",
        name: "HTTP 客户端",
        desc: "支持 GET/POST/PUT/DELETE/PATCH，自定义请求头和参数",
        icon: Globe,
        src: toolSrc("http-client"),
      },
    ],
  },
  {
    id: "crc",
    name: "校验 / 加解密",
    desc: "CRC、哈希与常见加解密编解码",
    tools: [
      {
        slug: "crc-calculator",
        name: "CRC 在线计算",
        desc: "循环冗余校验 - 支持多种 CRC 算法",
        icon: ShieldCheck,
        src: toolSrc("crc-calculator"),
      },
      {
        slug: "hash-calculator",
        name: "Hash / MD5 / SHA",
        desc: "文件与文本哈希值在线计算",
        icon: Hash,
        src: toolSrc("hash-calculator"),
      },
      {
        slug: "aes-encoder",
        name: "AES 在线加密",
        desc: "AES 对称加密解密，支持 CBC/GCM/CTR 模式和多种填充方式",
        icon: Lock,
        src: toolSrc("aes-encoder"),
      },
      {
        slug: "base64-converter",
        name: "Base64 编解码",
        desc: "Base64 标准编解码，支持 UTF-8",
        icon: FileCode,
        src: toolSrc("base64-converter"),
      },
    ],
  },
  {
    id: "radix",
    name: "进制转换与位操作",
    desc: "进制、编码与点阵字库工具",
    tools: [
      {
        slug: "base-converter",
        name: "进制互转",
        desc: "2/8/10/16 进制及位域可视化",
        icon: Binary,
        src: toolSrc("base-converter"),
      },
      {
        slug: "ascii-converter",
        name: "ASCII 编码转换器",
        desc: "将文本转换为十进制、十六进制、二进制和 Unicode 编码",
        icon: Type,
        src: toolSrc("ascii-converter"),
      },
      {
        slug: "chinese-dot-matrix",
        name: "汉字点阵取模",
        desc: "汉字/字符转点阵字库，支持横向/纵向扫描、MSB/LSB 位序，导出 C 数组/十六进制",
        icon: Grid3x3,
        src: toolSrc("chinese-dot-matrix"),
      },
    ],
  },
  {
    id: "time",
    name: "时间 / 计算器",
    desc: "时间戳与工程师计算器",
    tools: [
      {
        slug: "timestamp",
        name: "时间戳转换",
        desc: "Unix 时间戳与日期时间相互转换",
        icon: Clock,
        src: toolSrc("timestamp"),
      },
      {
        slug: "calculator",
        name: "进制计算器",
        desc: "支持 10 进制与 16 进制的专业计算器，实时切换显示",
        icon: Calculator,
        src: toolSrc("calculator"),
      },
    ],
  },
  {
    id: "code",
    name: "代码美化 / 转换",
    desc: "格式化、对比与文档工具",
    tools: [
      {
        slug: "json-formatter",
        name: "JSON 格式化",
        desc: "美化、压缩、转义 JSON 数据",
        icon: Braces,
        src: toolSrc("json-formatter"),
      },
      {
        slug: "code-diff",
        name: "代码对比",
        desc: "实时按行对比两段代码，高亮显示差异",
        icon: GitCompare,
        src: toolSrc("code-diff"),
      },
      {
        slug: "log-viewer",
        name: "日志查看器",
        desc: "高性能日志分析，支持大文件、实时过滤和关键字高亮",
        icon: ScrollText,
        src: toolSrc("log-viewer"),
      },
      {
        slug: "markdown-editor",
        name: "Markdown 编辑器",
        desc: "实时预览、工具栏快捷操作、支持导出 .md/.html 文件",
        icon: SquarePen,
        src: toolSrc("markdown-editor"),
      },
    ],
  },
  {
    id: "design",
    name: "设计工具",
    desc: "LVGL、颜色与二维码生成",
    tools: [
      {
        slug: "lvgl-font-converter",
        name: "LVGL 字体转换",
        desc: "TTF/WOFF 字体转 LVGL C 数组或二进制字体，支持 Unicode 范围和多字体合并",
        icon: ALargeSmall,
        src: toolSrc("lvgl-font-converter"),
      },
      {
        slug: "lvgl-image-converter",
        name: "LVGL 图片转换",
        desc: "图片转 LVGL v9 点阵，支持 RGB565/RGB888/ARGB8888 等，导出 C 数组或 .bin",
        icon: Image,
        src: toolSrc("lvgl-image-converter"),
      },
      {
        slug: "color-picker",
        name: "颜色选择器",
        desc: "HEX/RGB/HSL/CMYK 颜色转换与配色方案生成",
        icon: Pipette,
        src: toolSrc("color-picker"),
      },
      {
        slug: "qrcode-generator",
        name: "二维码生成器",
        desc: "支持网址、文本、WiFi、名片、邮件、短信等多种类型，可自定义颜色和 Logo",
        icon: QrCode,
        src: toolSrc("qrcode-generator"),
      },
    ],
  },
];

export const allZutilsTools: ZutilsTool[] = zutilsCategories.flatMap(
  (c) => c.tools
);

export function findZutilsTool(slug: string) {
  return allZutilsTools.find((t) => t.slug === slug);
}

export function findZutilsCategory(categoryId: string) {
  return zutilsCategories.find((c) => c.id === categoryId);
}

export function getZutilsToolCategory(slug: string) {
  return zutilsCategories.find((c) => c.tools.some((t) => t.slug === slug));
}
