// Complete the pinned PDF package before checking standalone portability/pixels.
// Next tracing can leave only pdf.worker.mjs, causing Node to resolve PDF code
// from the producer checkout. Release packagers already do this completion.
import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, realpathSync, unlinkSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve('.next/standalone');
assert.ok(existsSync(path.join(root,'server.js')),'Build standalone first');
const source=realpathSync('node_modules/pdfjs-dist');
const target=path.join(root,'node_modules/pdfjs-dist');
assert.ok(source!==target);
if(existsSync(target)&&lstatSync(target).isSymbolicLink()) unlinkSync(target);
cpSync(source,target,{recursive:true,verbatimSymlinks:true});
console.log('Pinned PDF runtime materialized inside standalone');
