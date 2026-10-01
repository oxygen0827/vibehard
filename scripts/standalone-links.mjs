import assert from 'node:assert/strict';
import { existsSync, lstatSync, readlinkSync, readdirSync } from 'node:fs';
import path from 'node:path';

// The standalone tree must work without any development-machine path.
export function assertPortableStandalone(root) {
  root=path.resolve(root);
  assert.ok(existsSync(path.join(root,'node_modules/next/package.json')),'Missing standalone Next runtime');
  function walk(directory) {
    for(const name of readdirSync(directory)) {
      const file=path.join(directory,name), stat=lstatSync(file);
      if(stat.isSymbolicLink()) {
        const target=readlinkSync(file), resolved=path.resolve(directory,target);
        assert.ok(!path.isAbsolute(target),`Absolute dependency link: ${path.relative(root,file)}`);
        assert.ok(resolved.startsWith(`${root}${path.sep}`),`Escaping dependency link: ${path.relative(root,file)}`);
        assert.ok(existsSync(file),`Dangling dependency link: ${path.relative(root,file)}`);
      } else if(stat.isDirectory()) walk(file);
    }
  }
  walk(root);
}
