// plugins/interfaceGuarder.ts
import type {Plugin} from 'vite';
import parser from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import type {ImportDeclaration as T_ImportDeclaration} from '@babel/types';
import {BuildInterfaceGuarderCode} from './BuildInterfaceGuarder';
import {groupValuesByMappedKey, formatObjectName} from './Tool';
import pathTool from 'node:path';
// @ts-ignore
const traverse = traverseModule.default;
// @ts-ignore
const generate = generateModule.default;

/* =========================================================
 *  配置常量区域（集中定义，方便修改和维护）
 * ========================================================= */
const CONFIG = {
  /** 虚拟模块前缀，用于区分由插件生成的“伪模块” */
  VIRTUAL_PREFIX: 'virtual:type/object/',

  /** 目标 Hook 函数名称 —— 识别 useInterfaceGuarder<Type>() */
  HOOK_NAME: 'useInterfaceGuarder',

  /** 目标 Hook 的导入路径（只有从这个路径导入才会被识别） */
  HOOK_PATH: 'react-interface-guarder',
};

/* =========================================================
 *  类型定义区域
 * ========================================================= */
type SourceId = string; // 模块唯一标识（Vite 的 id，通常为绝对路径）
type GeneratedCode = string; // 插件生成的虚拟模块代码

/** 用于描述 import { importedName as localName } 这样的映射关系 */
interface ImportNames {
  importedName: string; // 原始导入名
  localName: string; // 当前文件中使用的别名
}

/* =========================================================
 *  全局共享数据：记录“需要生成虚拟模块的文件”及对应生成代码
 * ========================================================= */
const interfaceSourceCodeMap = new Map<SourceId, GeneratedCode>();

/* =========================================================
 *  插件主体函数
 * ========================================================= */
export default function InterfaceGuarderPlugin(): Plugin {
  let root: string = '';

  return {
    name: 'vite-plugin-interface-guarder',
    enforce: 'pre', // 在 Vite 转换阶段提前执行（优先于默认 transform）
    configResolved(config) {
      root = config.root; // absolute root path
    },
    /**
     * transform 钩子：
     * 在 Vite 加载每个文件时执行（适用于 dev + build）
     * 主要职责：
     * 1️⃣ 检查是否导入目标 Hook
     * 2️⃣ 收集文件 import 类型信息
     * 3️⃣ 处理 useInterfaceGuarder<Type>() 调用
     * 4️⃣ 自动插入虚拟 import 语句
     */
    async transform(code: string, id: string) {
      // 仅处理 ts/tsx 文件
      if (!/\.(ts|tsx)$/.test(id)) return null;
      const cleanId = id.split('?')[0];

      const absolutePathSelf = cleanId;
      const relativePathSelf = pathTool.posix.relative(root, cleanId);
      // 使用 Babel parser 生成 AST
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      /* -----------------------------------------------------
       * 阶段1：检测文件中是否导入 useInterfaceGuarder
       * ----------------------------------------------------- */
      const importedTypeToAbsPath = new Map<string, string>(); // 类型 -> 绝对路径
      const importedTypeToRelPath = new Map<string, string>(); // 类型 -> 相对路径
      const aliasToOriginalName = new Map<string, string>(); // 记录 import 的别名对应关系
      let hasTargetHookImport = false; // 是否引入 useInterfaceGuarder
      let actualHookName = CONFIG.HOOK_NAME; // 实际在代码中使用的 Hook 名（考虑被重命名导入情况）

      const viteResolve = this.resolve.bind(this); // Vite 提供的路径解析方法

      // 遍历 AST，查找 useInterfaceGuarder 的导入语句
      traverse(ast, {
        // @ts-ignore
        // biome-ignore lint/correctness/noNestedComponentDefinitions: <explanation>
        ImportDeclaration(path) {
          if (path.node.source.value !== CONFIG.HOOK_PATH) return;

          // 判断是否导入了 useInterfaceGuarder 函数
          // @ts-ignore
          path.node.specifiers.forEach((spec) => {
            if (
              t.isImportSpecifier(spec) &&
              // @ts-ignore
              spec.imported.name === CONFIG.HOOK_NAME
            ) {
              hasTargetHookImport = true;
              actualHookName = spec.local.name; // 若重命名，如 import { useInterfaceGuarder as useIG }
            }
          });
        },
      });

      // 若未导入目标 Hook，则无需继续处理
      if (!hasTargetHookImport) return code;

      /* -----------------------------------------------------
       * 阶段2：收集当前文件的 import 信息
       * -----------------------------------------------------
       * 目的：后续识别 useInterfaceGuarder<T> 中的 T 是否来自外部模块
       * 并记录类型对应的“相对路径/绝对路径”
       */
      const importPromises: Promise<void>[] = [];

      traverse(ast, {
        // biome-ignore lint/correctness/noNestedComponentDefinitions: <explanation>
        ImportDeclaration(path: T_ImportDeclaration) {
          // @ts-ignore
          const source = path.node.source.value;

          // @ts-ignore
          path.node.specifiers.forEach((spec: t.Node | null | undefined) => {
            // 仅处理 import { X } / import X / import * as X
            if (
              t.isImportSpecifier(spec) ||
              t.isImportDefaultSpecifier(spec) ||
              t.isImportNamespaceSpecifier(spec)
            ) {
              // 若存在别名导入，如 import { A as B } from './x'
              if (
                t.isImportSpecifier(spec) &&
                // @ts-ignore
                spec.imported.name !== spec.local.name
              ) {
                // @ts-ignore
                aliasToOriginalName.set(spec.local.name, spec.imported.name);
              }

              // 记录相对路径
              importedTypeToRelPath.set(spec.local.name, source);

              // 使用 Vite 内置解析方法获取绝对路径
              const p = viteResolve(source, id).then((resolved) => {
                if (resolved)
                  importedTypeToAbsPath.set(spec.local.name, resolved.id);
              });
              importPromises.push(p);
            }
          });
        },
      });

      // 等待所有 import 解析完成（异步）
      await Promise.all(importPromises);

      /* -----------------------------------------------------
       * 阶段3：扫描 Hook 调用并生成类型对象参数
       * -----------------------------------------------------
       * 查找 useInterfaceGuarder<T>()，对每个类型参数：
       *   1️⃣ 判断类型是否来自外部模块；
       *   2️⃣ 若外部类型，生成对应虚拟模块；
       *   3️⃣ 为 useInterfaceGuarder 添加对象参数；
       */
      const typeToImportSpec = new Map<string, ImportNames>();

      traverse(ast, {
        // @ts-ignore
        // biome-ignore lint/correctness/noNestedComponentDefinitions: <explanation>
        CallExpression(path) {
          // 匹配 useInterfaceGuarder<Type>() 调用
          if (
            t.isIdentifier(path.node.callee, {name: actualHookName}) &&
            path.node.typeParameters
          ) {
            const typeParam = path.node.typeParameters.params[0];
            const typeName = getElementTypeName(typeParam);
            const isArrayType = t.isTSArrayType(typeParam);
            if (typeName === null) return;
            // 确保类型参数为简单的标识符（T）


            // 获取类型定义来源文件（若无则认为在当前文件中）
            const sourceId = importedTypeToAbsPath.get(typeName) ?? id;

            // Step 3.1 生成虚拟模块代码
            if (
              !interfaceSourceCodeMap.has(sourceId) &&
              importedTypeToAbsPath.has(typeName)
            ) {
              const relPath = importedTypeToRelPath.get(typeName)!;
              const code = BuildInterfaceGuarderCode(
                importedTypeToAbsPath.get(typeName)!,
                relPath,
              );
              const cleanSource = relPath.replace(/^(\.\/|\/)/, '');
              // 存入全局虚拟模块映射
              interfaceSourceCodeMap.set(
                `${CONFIG.VIRTUAL_PREFIX}${cleanSource}`,
                code,
              );
            }
            // 为当前文件生成类型对象 文件
            if (sourceId === id && !interfaceSourceCodeMap.has(sourceId)) {
              const code = BuildInterfaceGuarderCode(
                absolutePathSelf,
                relativePathSelf,
              );
              const cleanSource = relativePathSelf.replace(/^(\.\/|\/)/, '');
              // 存入全局虚拟模块映射
              interfaceSourceCodeMap.set(
                `${CONFIG.VIRTUAL_PREFIX}${cleanSource}`,
                code,
              );
              importedTypeToRelPath.set(typeName, relativePathSelf);
            }

            // Step 3.2 若类型来自外部模块，则记录需导入的类型对象

            const originalName = aliasToOriginalName.get(typeName) || typeName;

            typeToImportSpec.set(typeName, {
              importedName: formatObjectName(originalName),
              localName: formatObjectName(typeName),
            });
            // Step 3.3 在调用参数中追加类型对象
            path.node.arguments.push(t.identifier(formatObjectName(typeName)));
            path.node.arguments.push(t.booleanLiteral(isArrayType));
          }
        },
      });

      /* -----------------------------------------------------
       * 阶段4：插入 import 语句
       * -----------------------------------------------------
       * 将上一步生成的类型对象引用插入当前模块顶部，
       * 来源为虚拟模块 virtual:type/object/<path>
       */
      const importGroupMap = groupValuesByMappedKey(
        typeToImportSpec,
        importedTypeToRelPath,
      );
      const newImportNodes: t.ImportDeclaration[] = [];

      for (const [source, specs] of importGroupMap) {
        // 构造 import { A, B } from 'virtual:type/object/x'
        const importSpecifiers = specs.map((s) =>
          t.importSpecifier(
            t.identifier(s.localName),
            t.identifier(s.importedName),
          ),
        );
        const cleanSource = source.replace(/^(\.\/|\/)/, '');
        const virtualSource = `${CONFIG.VIRTUAL_PREFIX}${cleanSource}`;

        newImportNodes.push(
          t.importDeclaration(importSpecifiers, t.stringLiteral(virtualSource)),
        );
      }

      // 插入新 import 到现有 import 区域之后
      const {body} = ast.program;
      const firstNonImportIdx = body.findIndex(
        (n) => n.type !== 'ImportDeclaration',
      );
      const insertIndex =
        firstNonImportIdx === -1 ? body.length : firstNonImportIdx;
      body.splice(insertIndex, 0, ...newImportNodes);

      // 输出修改后的代码
      return generate(ast, {}, code).code;
    },

    /* -----------------------------------------------------
     * resolveId 钩子：
     * 当模块被 import 时触发，用于告知 Vite 我来处理特定 ID
     * ----------------------------------------------------- */
    resolveId(id) {
      if (id.startsWith(CONFIG.VIRTUAL_PREFIX)) return id; // 由插件拦截虚拟模块
      return null;
    },

    /* -----------------------------------------------------
     * load 钩子：
     * 为上面 resolveId 返回的虚拟模块提供实际内容
     * ----------------------------------------------------- */
    load(id) {
      return interfaceSourceCodeMap.get(id) || null;
    },
  };
}
// @ts-ignore
function getElementTypeName(node) {
  if (t.isTSTypeReference(node) && t.isIdentifier(node.typeName)) {
    return node.typeName.name;
  }
  if (t.isTSArrayType(node)) {
    return getElementTypeName(node.elementType);
  }
  return null;
}
