import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import InterfaceSchemaParser from './InterfaceSchemaParser';

// Resolve file path for both ESM and CJS outputs
const fileUrl =
  typeof import.meta !== 'undefined' && import.meta.url
    ? import.meta.url
    : pathToFileURL(typeof __filename !== 'undefined' ? __filename : '').href;
const __filename = fileURLToPath(fileUrl);
const __dirname = path.dirname(__filename);
const defaultDebugFile = 'default-debug.ts';

const BuildInterfaceGuarderCode = (absPath: string, relPath?: string) => {
  function loadTsFileAsString(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }
  const exampleInterface = loadTsFileAsString(absPath);
  let extraExports = '';
  const tsTool = new InterfaceSchemaParser(
    exampleInterface,
    defaultDebugFile,
    true,
  );
  // 读取文件内容并返回 string
  extraExports = tsTool.build();

  const outputPath = path.resolve(
    __dirname,
    `interface-guarder-debug/${relPath || defaultDebugFile}`,
  );
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('Created directory:', outputDir);
  }
  // 写入编译后的 JS
  fs.writeFileSync(outputPath, extraExports, 'utf-8');

  return extraExports;
};

export { BuildInterfaceGuarderCode };
