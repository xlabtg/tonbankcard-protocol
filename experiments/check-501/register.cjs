'use strict';
// Загружаем исходные модули проекта без изменения их кода и tsconfig.
const fs = require('node:fs');
const ts = require('../../node_modules/typescript');
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, resolveJsonModule: true }, fileName: filename,
  });
  module._compile(result.outputText, filename);
};
