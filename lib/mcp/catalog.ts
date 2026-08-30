export interface McpServer {
  id: string;
  name: string;
  author: string;
  description: string;
  category: string;
  downloads: string;
  stars: number;
  tags: string[];
  verified: boolean;
}

export const mcpServers: McpServer[] = [
  { id: "lcsc-components", name: "LCSC Components", author: "vibehard", description: "立创商城元器件查询：按分类/参数搜索电阻、电容、IC，获取实时价格、库存和封装信息。", category: "元器件", downloads: "3.2k", stars: 486, tags: ["立创", "BOM", "选型"], verified: true },
  { id: "eda-schematic", name: "EDA Schematic Tools", author: "vibehard", description: "立创 EDA 原理图操作：创建/读取/修改原理图，自动布线，导出网表和 BOM。", category: "EDA", downloads: "2.8k", stars: 412, tags: ["立创EDA", "原理图", "PCB"], verified: true },
  { id: "openocd-debug", name: "OpenOCD Debug", author: "vibehard", description: "通过 OpenOCD 连接调试器：读写 Flash/寄存器、JTAG/SWD 调试、实时采集传感器数据。", category: "调试", downloads: "1.9k", stars: 358, tags: ["OpenOCD", "SWD", "调试"], verified: true },
  { id: "datasheet-parser", name: "Datasheet Parser", author: "community", description: "解析芯片 Datasheet PDF：提取引脚表、电气特性、时序图和典型应用电路。", category: "资料", downloads: "1.5k", stars: 264, tags: ["PDF", "Datasheet", "提取"], verified: false },
  { id: "serial-monitor", name: "Serial Monitor", author: "community", description: "串口监控与交互：多串口监听、日志解析、AT 指令交互和自动化测试脚本。", category: "调试", downloads: "1.2k", stars: 197, tags: ["串口", "日志", "AT指令"], verified: false },
  { id: "pcb-review", name: "PCB Review", author: "vibehard", description: "PCB 设计审查：DRC 检查、阻抗计算、EMC 风险分析和可制造性评估。", category: "EDA", downloads: "986", stars: 156, tags: ["PCB", "DRC", "EMC"], verified: true },
  { id: "firmware-builder", name: "Firmware Builder", author: "community", description: "嵌入式固件构建：支持 ESP-IDF、STM32 HAL、Arduino 工程的云端编译和 OTA 打包。", category: "固件", downloads: "754", stars: 132, tags: ["编译", "ESP-IDF", "OTA"], verified: false },
  { id: "power-analyzer", name: "Power Analyzer", author: "community", description: "功耗分析：读取功耗仪数据，生成电流曲线，识别异常功耗尖峰并给出优化建议。", category: "调试", downloads: "432", stars: 89, tags: ["功耗", "低功耗", "分析"], verified: false },
];
