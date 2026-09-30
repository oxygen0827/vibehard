// Exercise the deployed dependency tree, not the development node_modules.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const root=resolve(process.argv[2] || '.next/standalone');
const require=createRequire(`${root}/server.js`);
const pdfPath=realpathSync(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
const canvasPath=realpathSync(require.resolve('@napi-rs/canvas'));
assert.ok(pdfPath.startsWith(realpathSync(root)+sep),`PDF dependency escapes standalone: ${pdfPath}`);
assert.ok(canvasPath.startsWith(realpathSync(root)+sep),`Canvas dependency escapes standalone: ${canvasPath}`);
assert.equal(realpathSync(createRequire(pdfPath).resolve('@napi-rs/canvas')),canvasPath,'PDF and renderer must share one native Canvas instance');
const {createCanvas}=require('@napi-rs/canvas');
const {getDocument}=await import(pathToFileURL(pdfPath));
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>'];
const content='0 0 0 rg 72 700 100 12 re f';
objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
let text='%PDF-1.4\n'; const offsets=[];
objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${o}\nendobj\n`;});
const xref=Buffer.byteLength(text);
text+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n${xref}\n%%EOF`;
const task=getDocument({data:new Uint8Array(Buffer.from(text))});
try {
  const pdf=await task.promise; const page=await pdf.getPage(1);
  const viewport=page.getViewport({scale:2}); const canvas=createCanvas(viewport.width,viewport.height);
  await page.render({canvasContext:canvas.getContext('2d'),canvas,viewport}).promise;
  assert.deepEqual([...canvas.getContext('2d').getImageData(160,170,1,1).data].slice(0,3),[0,0,0]);
  const png=await canvas.encode('png');assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  console.log(JSON.stringify({standalonePdfRender:true,pixelsVerified:true,pngBytes:png.length}));
} finally { await task.destroy(); }
