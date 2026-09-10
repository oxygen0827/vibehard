export type BoardView = "assembly" | "routing";
export interface BoardOptions { view: BoardView; top: boolean; bottom: boolean; silk: boolean; zoom: number; pan: [number, number] }

type Point = [number, number];
type Trace = { points: Point[]; width?: number; bottom?: boolean };
type Passive = { ref: string; x: number; y: number; angle?: number; resistor?: boolean; label?: Point };

const passives: Passive[] = [
  { ref: "C1", x: 8.1, y: 10.2 }, { ref: "R1", x: 9.5, y: 13, angle: 90, resistor: true },
  { ref: "R2", x: 9.5, y: 16, angle: 90, resistor: true }, { ref: "C2", x: 12, y: 11 },
  { ref: "C3", x: 12, y: 18.7 }, { ref: "C4", x: 7.5, y: 22.5 },
  { ref: "R3", x: 7, y: 28.2, resistor: true }, { ref: "C5", x: 13, y: 23.2 },
  { ref: "R4", x: 12.7, y: 27.2, resistor: true }, { ref: "C6", x: 15, y: 30.7, angle: 90 },
  { ref: "C7", x: 36.2, y: 25.6, label: [34.7, 25.7] }, { ref: "C8", x: 40.2, y: 23.6 },
  { ref: "R5", x: 36.3, y: 12.1, angle: 90, resistor: true }, { ref: "R6", x: 38.2, y: 12.1, angle: 90, resistor: true },
  { ref: "C9", x: 40.2, y: 6.3 }, { ref: "C10", x: 46.2, y: 16.9, angle: 90 },
  { ref: "R7", x: 36.2, y: 18, resistor: true }, { ref: "R8", x: 36.2, y: 20.2, resistor: true },
  { ref: "R9", x: 17.2, y: 27.4, angle: 90, resistor: true }, { ref: "R10", x: 29.7, y: 29.4, angle: 90, resistor: true },
  { ref: "C11", x: 33, y: 30.4, angle: 90 }, { ref: "R11", x: 42.2, y: 22, resistor: true },
];

// Millimetre coordinates keep package proportions, pad pitch and board dimensions consistent.
const traces: Trace[] = [
  { points: [[5.5, 13.1], [8, 13.1], [10.7, 15.8], [15.6, 15.8]], width: .18 },
  { points: [[5.5, 13.6], [7.8, 13.6], [10.6, 16.4], [15.6, 16.4]], width: .18 },
  { points: [[5.5, 11.3], [7.3, 11.3], [8.4, 12.4], [8.4, 20.5], [9.4, 21.5], [9.4, 23.7]], width: .48 },
  { points: [[8, 31], [8, 29.8], [10.2, 27.6], [10.2, 26]], width: .5 },
  { points: [[10.2, 26], [11.7, 26], [14, 28.3], [28.7, 28.3], [32.6, 24.4], [32.6, 21.2], [36, 21.2]], width: .45, bottom: true },
  { points: [[37.4, 22], [38.6, 22], [39.4, 22.8], [39.4, 25.6], [33.7, 25.6], [30.8, 22.7]], width: .42 },
  { points: [[34.4, 10.7], [35.2, 10.7], [37.5, 8.4], [40.5, 8.4]], width: .2 },
  { points: [[34.4, 12], [35.1, 12], [38.1, 9], [40.5, 9]], width: .2 },
  { points: [[38, 8.4], [39, 7.4], [43.5, 7.4], [45, 8.9], [45, 14.6], [43.8, 15.8]], width: .2, bottom: true },
  { points: [[38.4, 9], [39.3, 8.1], [43.2, 8.1], [44.4, 9.3], [44.4, 14.4], [43, 15.8]], width: .2, bottom: true },
  { points: [[34.4, 13.2], [38.8, 13.2], [40.2, 14.6], [40.2, 26.2], [41.3, 27.3]], width: .2 },
  { points: [[34.4, 14.5], [38.2, 14.5], [39.5, 15.8], [39.5, 26.5], [38.8, 27.2]], width: .2 },
  { points: [[34.4, 15.8], [36.5, 15.8], [38.8, 18.1], [38.8, 24.3], [36.5, 26.6], [36.5, 27.3]], width: .23, bottom: true },
  { points: [[15.6, 20.9], [14.6, 20.9], [14.6, 26], [19.5, 30.9]], width: .2 },
  { points: [[15.6, 22.2], [15.1, 22.2], [15.1, 25.2], [19.2, 29.3], [25.5, 29.3], [27.2, 31]], width: .2, bottom: true },
  { points: [[34.4, 17], [35.5, 17], [36.5, 16], [40.7, 16]], width: .22 },
  { points: [[34.4, 18.3], [35, 18.3], [36.8, 20.1], [40.8, 20.1], [42.2, 18.7]], width: .22 },
  { points: [[43.8, 27.3], [45, 26.1], [45, 23.4], [43.3, 21.7]], width: .4 },
  { points: [[4, 20], [4, 26], [6.3, 28.3]], width: .28, bottom: true },
  { points: [[15.6, 9.4], [13.6, 9.4], [12, 7.8], [7, 7.8], [6, 8.8], [6, 10.5]], width: .22 },
  { points: [[15.6, 10.7], [14.6, 10.7], [12.6, 12.7], [12.6, 14.6]], width: .22 },
  { points: [[15.6, 13.2], [14.3, 13.2], [12, 15.5], [12, 17.9]], width: .22 },
  { points: [[34.4, 19.6], [35.1, 19.6], [37.3, 21.8]], width: .26 },
  { points: [[33, 30.4], [33, 32.1], [35.7, 32.1], [38.4, 29.4]], width: .24 },
];

const vias: Point[] = [
  [6.5, 6.5], [10, 6.5], [13.5, 6.5], [36.5, 4], [40, 4], [43.5, 4],
  [2, 8], [2, 20], [2, 24], [2, 27], [48, 7], [48, 11], [48, 15], [48, 19], [48, 23], [48, 27],
  [13.5, 33], [17.5, 33], [22, 33], [27, 33], [32, 33], [37, 33], [41, 33],
  [14, 19.3], [13.5, 21.3], [6.2, 24], [12, 29], [30, 26.5], [38.3, 6.5], [45.4, 11], [40.7, 18.8],
  [38, 8.4], [38.4, 9], [36, 21.2], [36.5, 26.6], [15.1, 25.2], [25.5, 29.3],
];

export function renderExampleBoard(canvas: HTMLCanvasElement, options: BoardOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const c = ctx;
  const assembly = options.view === "assembly";
  const gold = "#d9b96d";
  const silk = "#d9e5d6";
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = assembly ? "#e4eaea" : "#111d25";
  c.fillRect(0, 0, canvas.width, canvas.height);
  const scale = canvas.width / 61;
  c.scale(scale, scale);
  const height = canvas.height / scale;
  c.strokeStyle = assembly ? "#d5dddd" : "#1e2c34";
  c.lineWidth = .025;
  for (let x = 0; x < 61; x += 2.5) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, height); c.stroke(); }
  for (let y = 0; y < height; y += 2.5) { c.beginPath(); c.moveTo(0, y); c.lineTo(61, y); c.stroke(); }
  c.translate(30.5 + options.pan[0], height / 2 + options.pan[1]);
  c.scale(options.zoom, options.zoom);
  c.translate(-25, -17.5);

  function rect(x: number, y: number, w: number, h: number, fill: string | CanvasGradient, radius = 0, stroke?: string) {
    c.beginPath(); c.roundRect(x, y, w, h, radius); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = .06; c.stroke(); }
  }
  function circle(x: number, y: number, radius: number, fill: string) {
    c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  }
  function line(points: Point[], color: string, width: number) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = color; c.lineWidth = width; c.lineJoin = "round"; c.lineCap = "round"; c.stroke();
  }
  function text(value: string, x: number, y: number, size = .6, color = silk, align: CanvasTextAlign = "left") {
    c.save(); c.translate(x, y); c.scale(.01, .01);
    c.font = `500 ${size * 100}px "SFMono-Regular", Consolas, monospace`; c.textAlign = align; c.textBaseline = "middle"; c.fillStyle = color; c.fillText(value, 0, 0);
    c.restore();
  }
  function metal(x: number, y: number, width: number, height: number, radius = .12) {
    const gradient = c.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, "#b7c0c1"); gradient.addColorStop(.24, "#f0f0e9"); gradient.addColorStop(.5, "#c0c6c4"); gradient.addColorStop(.8, "#dde0d8"); gradient.addColorStop(1, "#8b9998");
    rect(x, y, width, height, gradient, radius, "#6b7a79");
  }
  function pad(x: number, y: number, w: number, h: number) {
    rect(x - .1, y - .1, w + .2, h + .2, assembly ? "#12402f" : "#0c141b", .13);
    rect(x, y, w, h, gold, .09, "#b38b45");
    if (assembly) rect(x + .06, y + .06, w - .12, Math.max(.07, h * .32), "#f1dfaa", .03);
  }
  function shadow() { c.shadowColor = "#00000070"; c.shadowBlur = scale * .23; c.shadowOffsetY = scale * .16; }
  function unshadow() { c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetY = 0; }
  function outline(x: number, y: number, w: number, h: number) {
    if (!options.silk) return;
    c.strokeStyle = silk; c.lineWidth = .075; c.strokeRect(x, y, w, h);
  }
  function chip(x: number, y: number, w: number, h: number, pins: number, ref: string, marking: string, refPosition?: Point) {
    const pitch = (h - .7) / pins;
    for (let i = 0; i < pins; i++) {
      const py = y + .35 + i * pitch;
      pad(x - .65, py, .85, pitch * .55); pad(x + w - .2, py, .85, pitch * .55);
    }
    outline(x - .9, y - .3, w + 1.8, h + .6);
    if (assembly) {
      shadow(); rect(x, y, w, h, "#202927", .16, "#66706a"); unshadow();
      rect(x + .2, y + .15, w - .4, h - .3, "#2b312d", .1);
      circle(x + .42, y + .45, .13, "#9b9e87");
      text(marking, x + w / 2, y + h / 2, .45, "#b6baa8", "center");
    }
    if (options.silk) text(ref, refPosition?.[0] ?? x, refPosition?.[1] ?? y - .8, .53);
  }

  if (assembly) { shadow(); c.shadowBlur = scale * 1.1; c.shadowOffsetY = scale * .65; }
  rect(0, .15, 50, 35, "#54664a", 1.2); unshadow();
  const soldermask = c.createLinearGradient(0, 0, 48, 35);
  soldermask.addColorStop(0, assembly ? "#175747" : "#142d29");
  soldermask.addColorStop(.5, assembly ? "#1d6551" : "#17312b");
  soldermask.addColorStop(1, assembly ? "#124834" : "#102722");
  rect(0, 0, 50, 35, soldermask, 1.2, "#609375");
  rect(.55, .55, 48.9, 33.9, assembly ? "#205d4830" : "#20403740", .85, "#57836b");

  // No copper below the module antenna; the dashed region is shown in routing view.
  rect(15.1, 0, 19.8, 6.6, assembly ? "#103e30" : "#28332b");
  if (!assembly) {
    c.setLineDash([.25, .22]); c.strokeStyle = "#aeb976"; c.lineWidth = .08; c.strokeRect(15.1, 0, 19.8, 6.6); c.setLineDash([]);
    text("ANTENNA / COPPER KEEPOUT", 25, 3, .64, "#c5ce9d", "center");
  }
  for (const trace of traces) {
    if (trace.bottom ? !options.bottom : !options.top) continue;
    line(trace.points, assembly ? (trace.bottom ? "#317361" : "#438b6a") : (trace.bottom ? "#648cd3" : "#e3a269"), trace.width ?? .2);
  }
  for (const [x, y] of vias) { circle(x, y, .31, "#114232"); circle(x, y, .23, assembly ? "#749079" : gold); circle(x, y, .105, "#152820"); }
  for (const [x, y] of [[3, 3], [47, 3], [3, 32], [47, 32]]) {
    circle(x, y, 1.68, "#114432"); circle(x, y, 1.42, "#b49856"); circle(x, y, 1.25, gold); circle(x, y, .91, "#0d231d"); circle(x, y + .07, .78, assembly ? "#c9d4d1" : "#111d25");
    if (options.silk) { c.beginPath(); c.arc(x, y, 1.82, 0, Math.PI * 2); c.strokeStyle = silk; c.lineWidth = .07; c.stroke(); }
  }

  // ESP32-S3-WROOM-1: 18 x 25.5 mm, 1.27 mm castellated pad pitch.
  for (let i = 0; i < 14; i++) { pad(15.55, 7.7 + i * 1.27, 1.3, .72); pad(33.15, 7.7 + i * 1.27, 1.3, .72); }
  for (let i = 0; i < 12; i++) pad(17.65 + i * 1.27, 24.65, .72, 1.15);
  if (!assembly) {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      pad(21.65 + col * 2.3, 16.8 + row * 2.3, 1.7, 1.7);
      circle(22.5 + col * 2.3, 17.65 + row * 2.3, .13, "#132b24");
    }
  }
  outline(15.3, 6.85, 19.4, 19.3);
  if (assembly) {
    shadow(); rect(16, .03, 18, 25.45, "#202826", .14, "#92917b"); unshadow();
    rect(16.3, .25, 17.4, 6.15, "#29332d", .08);
    line([[16.9, 5.6], [16.9, 1.15], [18.2, 1.15], [18.2, 4.1], [20.3, 4.1], [20.3, 1.15], [22.5, 1.15], [22.5, 4.1], [24.7, 4.1], [24.7, 1.15], [27, 1.15], [27, 4.1], [29.2, 4.1], [29.2, 1.15], [32.9, 1.15]], "#b59a52", .43);
    line([[31.1, 6.5], [31.1, 4.1], [32.9, 4.1], [32.9, 1.15]], gold, .43);
    shadow(); metal(16.55, 6.8, 16.9, 17.9, .45); unshadow();
    rect(17, 7.25, 16, 17, "#dae0d210", .3, "#f1f2e8");
    for (let y = 8; y < 24; y += .08) line([[17.15, y], [32.85, y]], "#ffffff0b", .016);
    text("ESPRESSIF", 25, 11.8, 1.45, "#69716c", "center");
    text("ESP32-S3", 25, 15.2, 1.15, "#68726c", "center");
    text("WROOM-1", 25, 17, .97, "#737b70", "center");
    text("Wi-Fi + Bluetooth LE", 25, 19.4, .54, "#778076", "center");
    text("N8R8   2.4 GHz", 25, 21.3, .57, "#788072", "center");
    text("CE   FCC", 25, 23, .77, "#798073", "center");
  } else if (options.silk) { text("U1 / ESP32-S3-WROOM-1", 25, 12, .75, silk, "center"); text("18.0 x 25.5 mm", 25, 13.6, .6, silk, "center"); }

  // USB-C receptacle, metal shell and shell anchor pads are distinct from the signal pins.
  for (let i = 0; i < 12; i++) pad(5.55, 10.65 + i * .46, 1.45, .26);
  for (const y of [9.55, 16.6]) { pad(.7, y, 1.7, 1.1); pad(4.5, y, 1.6, 1.1); }
  outline(.45, 9.25, 6.9, 8.75);
  if (assembly) {
    shadow(); metal(-.7, 9.7, 6.85, 7.7, .6); unshadow();
    metal(-1, 9.7, 1, 7.7, .35); rect(-1.03, 10.35, .45, 6.45, "#15211e", .2);
    rect(1, 10.2, 4, 6.6, "#e1e3da", .18, "#9ba6a0");
    for (const y of [10.8, 15.9]) rect(2.4, y, 1.35, .62, "#88958e", .08);
    line([[.8, 10], [.8, 17.1]], "#fbfff9", .1);
    text("USB-C", 3, 13.6, .65, "#747f78", "center");
  }

  chip(8, 23.7, 3.9, 3.3, 4, "U3", "4056", [10.5, 22.4]);
  chip(35.5, 21.4, 2.8, 3.4, 3, "U4", "3V3", [38.9, 21.3]);
  chip(40.7, 15.3, 3, 3.6, 3, "U5", "1750");
  chip(40.7, 8, 3, 3, 4, "U2", "");
  if (assembly) { metal(41, 8.3, 2.4, 2.4); rect(41.45, 8.75, 1.5, 1.5, "#526356", .12); circle(42.2, 9.5, .47, "#263b31"); }
  if (assembly) { rect(41.25, 16.1, 1.9, 1.8, "#335655", .12); rect(41.45, 16.3, 1.5, 1.4, "#4e737044", .05); }

  for (const p of passives) {
    c.save(); c.translate(p.x, p.y); c.rotate((p.angle ?? 0) * Math.PI / 180);
    pad(-1.05, -.45, .65, .9); pad(.4, -.45, .65, .9);
    if (assembly) { shadow(); rect(-.68, -.42, 1.36, .84, p.resistor ? "#303832" : "#b59962", .09); unshadow(); metal(-.82, -.42, .3, .84); metal(.52, -.42, .3, .84); if (p.resistor) text("103", 0, 0, .29, "#d2d8cc", "center"); }
    c.restore();
    if (options.silk) text(p.ref, p.label?.[0] ?? p.x, p.label?.[1] ?? p.y - (p.angle ? 1.6 : 1), .42, silk, "center");
  }

  for (const [x, name] of [[20.5, "RESET"], [26.3, "BOOT"]] as const) {
    pad(x - 1.8, 28.9, .8, 1); pad(x + 1, 28.9, .8, 1); pad(x - 1.8, 31.1, .8, 1); pad(x + 1, 31.1, .8, 1);
    if (assembly) { shadow(); rect(x - 1.5, 28.8, 3, 3.4, "#222f28", .2); unshadow(); metal(x - 1.35, 29, 2.7, 3, .15); circle(x, 30.5, 1, "#303c31"); circle(x - .1, 30.4, .72, "#586352"); }
    if (options.silk) text(name, x, 27.8, .48, silk, "center");
  }

  for (let i = 0; i < 4; i++) {
    const x = 36.2 + i * 2.54;
    pad(x - .85, 27.6, 1.7, 1.7);
    if (assembly) { rect(x - 1.15, 27.3, 2.3, 2.3, "#1b2721", .2); metal(x - .32, 28.1, .64, .64, .04); rect(x - .19, 28.14, .38, .38, "#edcc76"); }
    else circle(x, 28.45, .42, "#111d25");
    if (options.silk) text(["3V3", "GND", "SCL", "SDA"][i], x, 30.4, .42, silk, "center");
  }
  pad(7, 30.4, 1, 2.1); pad(9, 30.4, 1, 2.1);
  if (assembly) {
    shadow(); rect(5.4, 30, 6.2, 4.5, "#dfdcc4", .25, "#9f9f88"); unshadow();
    rect(6.1, 31, 4.8, 3, "#797f6d", .1); rect(6.4, 31.35, 4.2, 2.55, "#c9c7ae", .1);
    for (const x of [7.4, 9.4]) metal(x, 31.7, .42, 2, .02);
  }
  pad(7.1, 19.3, .7, 1); pad(9.1, 19.3, .7, 1);
  if (assembly) { rect(7.7, 19.4, 1.4, .8, "#c4d4a2", .15); rect(8, 19.52, .8, .55, "#9acd69", .1); }
  if (options.silk) {
    text("J1", .8, 8.45, .62); text("USB / 5V", 3.4, 18.8, .5, silk, "center");
    text("CHG", 8.4, 18.5, .45, silk, "center"); text("BAT +  -", 8.5, 29, .5, silk, "center");
    text("SHT30", 42.2, 12, .62, silk, "center"); text("LIGHT", 42.2, 20.1, .55, silk, "center");
    text("J3 / I2C", 40, 26.4, .55, silk, "center");
    text("VibeHard", 6.3, 3.25, 1.4); text("TH-NODE", 6.3, 4.8, .76); text("REV 0.2", 6.3, 6.05, .5);
    text("ESP32-S3 / ENV", 25, 34, .52, silk, "center");
  }
  if (options.zoom === 1) {
    const dimensionColor = assembly ? "#677d78" : "#8faaa8";
    line([[0, 36.3], [50, 36.3]], dimensionColor, .045);
    for (const x of [0, 50]) line([[x, 35.7], [x, 36.8]], dimensionColor, .06);
    rect(21.4, 35.7, 7.2, 1.2, assembly ? "#e4eaea" : "#111d25"); text("50.0 mm", 25, 36.3, .65, dimensionColor, "center");
    line([[52, 0], [52, 35]], dimensionColor, .045);
    for (const y of [0, 35]) line([[51.5, y], [52.5, y]], dimensionColor, .06);
    c.save(); c.translate(52, 17.5); c.rotate(-Math.PI / 2); rect(-3.5, -.6, 7, 1.2, assembly ? "#e4eaea" : "#111d25"); text("35.0 mm", 0, 0, .65, dimensionColor, "center"); c.restore();
  }
}
