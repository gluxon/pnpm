import { stripTypeScriptTypes } from 'node:module';

// This file was created referencing:
// https://github.com/jestjs/jest/issues/15443

export default {
  process(sourceText, sourcePath) {
    const code = stripTypeScriptTypes(sourceText, {
      mode: 'transform',
      sourceMap: true,
      sourceUrl: sourcePath
    });
    return { code };
  }
};
