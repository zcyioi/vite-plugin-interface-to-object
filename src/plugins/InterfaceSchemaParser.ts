/**
 * InterfaceSchemaParser
 * -------------------------------------------------------------
 * 该类负责解析 TypeScript 文件中的 Interface 定义，
 * 生成结构化的 Schema 对象并输出为 JS 对象代码。
 * -------------------------------------------------------------
 */

import ts from 'typescript';
import {
  AttributeValueType,
  DeclarationType,
  TsBaseKeyword,
  DeclarationTypeKey,
} from './const';
import {formatObjectName} from './Tool';

/* =========================================================
 * 一、类型声明区域
 * ========================================================= */

/** 属性值定义（如 string | number[]） */
export interface AttributeValue {
  value: any; // 实际属性值（可为字符串、数组或嵌套对象）
  isArray?: boolean; // 是否为数组类型
  valueType?: string; // 属性值类型（基础类型、引用类型、字面量等）
}

/** 单个属性定义（如 name: string[];） */
export interface SchemaPropertyType {
  key: string; // 属性名
  attribute: AttributeValue[]; // 属性值数组
  isOptional?: boolean; // 是否可选（即带 ?）
}

/** 接口定义结构（如 interface User { id: number; name: string }） */
interface SchemaInterface {
  objectName: string; // 转换后的接口对象名
  props: SchemaPropertyType[]; // 接口的属性集合
  isExport: boolean | undefined; // 是否导出（export）
  _declarationType: DeclarationType;
}

/* =========================================================
 * 二、主类定义区域
 * ========================================================= */
class InterfaceSchemaParser {
  /** 文件内容（源码字符串） */
  private fileContent: string;

  /** 文件路径（用于生成 AST 时的文件名） */
  private filePath: string;

  /** TypeScript AST 根节点 */
  private sourceFileAst!: ts.SourceFile;
  /** 是否导出全部对象 */
  private isExport: boolean;

  /** 解析结果（接口对象集合） */
  private parsedInterfaces: SchemaInterface[] = [];

  constructor(
    fileContent: string,
    filePath: string,
    isExport: boolean = false,
  ) {
    this.fileContent = fileContent;
    this.filePath = filePath;
    this.isExport = isExport;
  }

  /* =========================================================
   * 三、AST 解析阶段
   * ========================================================= */

  /**
   * 创建 TypeScript AST 抽象语法树
   */
  private createTsAst(): this {
    try {
      this.sourceFileAst = ts.createSourceFile(
        this.filePath,
        this.fileContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
    } catch (e) {
      this.error('AST 解析失败', e);
    }
    return this;
  }

  /**
   * 遍历文件顶层节点，收集所有 Interface 定义
   */
  private parseNode(): void {
    this.sourceFileAst.forEachChild((node) => {
      if (ts.isInterfaceDeclaration(node)) {
        this.parseInterfaceNode(node);
      }
      if (ts.isTypeAliasDeclaration(node)) {
        this.parsedTypeLiteralNode(node);
      }
    });
  }
  private parsedTypeLiteralNode(node: ts.TypeAliasDeclaration): void {
    const typeAliasName = node.name.text;
    let declarationType = DeclarationType.TypeLiteralDeclaration;
    const isExport =
      node.modifiers?.some(
        (m) =>
          m.kind === ts.SyntaxKind.ExportKeyword ||
          m.kind === ts.SyntaxKind.DefaultKeyword,
      ) ?? false;

    const properties: SchemaPropertyType[] = [];
    // 遍历 type 内部属性
    if (ts.isTypeLiteralNode(node.type)) {
      node.type.members.forEach((member) => {
        const property = this.parsePropertyNode(member);
        if (property) properties.push(property);
      });
    } // 如果是联合类型 (UnionTypeNode) 或交叉类型 (IntersectionTypeNode)，也可以递归解析
    else if (ts.isIntersectionTypeNode(node.type)) {
      console.log('UnionTypeNode or IntersectionTypeNode:', typeAliasName);
      node.type.types.forEach((subType) => {
        // 若其中某一项是对象类型，也继续解析
        if (ts.isTypeLiteralNode(subType)) {
          subType.members.forEach((member) => {
            const property = this.parsePropertyNode(member);
            if (property) properties.push(property);
          });
        }
      });
    } else if (
      ts.isUnionTypeNode(node.type) ||
      ts.isLiteralTypeNode(node.type)
    ) {
      const property = this.parseTypeAliasNode(node, typeAliasName);
      console.log('LiteralTypeNode:', property);
      if (property) properties.push(property);
      declarationType = DeclarationType.TypeAliasDeclaration;
    }
    // node.members.forEach((member) => {
    //   const property = this.parsePropertyNode(member);
    //   if (property) properties.push(property);
    // });
    // 检查是否重复（如同名 interface 合并声明）
    const existing = this.parsedInterfaces.find(
      (item) => item.objectName === formatObjectName(typeAliasName),
    );

    if (existing) {
      existing.props.push(...properties);
    } else {
      this.parsedInterfaces.push({
        objectName: formatObjectName(typeAliasName),
        props: properties,
        isExport: isExport,
        _declarationType: declarationType,
      });
    }
  }
  /**
   * 解析单个 interface 节点
   */
  private parseInterfaceNode(node: ts.InterfaceDeclaration): void {
    const interfaceName = node.name.text;
    const isExport =
      node.modifiers?.some(
        (m) =>
          m.kind === ts.SyntaxKind.ExportKeyword ||
          m.kind === ts.SyntaxKind.DefaultKeyword,
      ) ?? false;

    const properties: SchemaPropertyType[] = [];

    // 遍历 interface 内部属性
    node.members.forEach((member) => {
      const property = this.parsePropertyNode(member);
      if (property) properties.push(property);
    });

    // 检查是否重复（如同名 interface 合并声明）
    const existing = this.parsedInterfaces.find(
      (item) => item.objectName === formatObjectName(interfaceName),
    );

    if (existing) {
      existing.props.push(...properties);
    } else {
      this.parsedInterfaces.push({
        objectName: formatObjectName(interfaceName),
        props: properties,
        isExport: isExport,
        _declarationType: DeclarationType.InterfaceDeclaration,
      });
    }
  }

  /**
   * 解析单个属性节点（PropertySignature）
   */
  private parsePropertyNode(
    member: ts.Node,
    keyP?: string,
  ): SchemaPropertyType | null {
    if (!ts.isPropertySignature(member)) return null;

    const key = (member.name as ts.Identifier).text || keyP;
    if (key == null) return null;
    const isOptional = !!member.questionToken || false;

    // 解析属性类型
    const attributes = this.parseTypeNode(member.type);
    const validAttributes = attributes?.filter((a) => a.value !== ParseError);

    if (!validAttributes || validAttributes.length === 0) return null;
    return {
      key,
      attribute: validAttributes,
      isOptional,
    };
  }

  private parseTypeAliasNode(
    member: ts.Node,
    key: string,
  ): SchemaPropertyType | null {
    if (key == null) return null;
    const isOptional = false;

    // 解析属性类型
    // @ts-ignore
    const attributes = this.parseTypeNode(member.type);
    const validAttributes = attributes?.filter((a) => a.value !== ParseError);

    if (!validAttributes || validAttributes.length === 0) return null;
    return {
      key,
      attribute: validAttributes,
      isOptional,
    };
  }

  /* =========================================================
   * 四、类型解析阶段
   * ========================================================= */

  private parseTypeNode(typeNode?: ts.TypeNode): AttributeValue[] {
    if (!typeNode) return [this.createErrorAttr('空类型节点')];

    switch (typeNode.kind) {
      // 基础类型：string、number、boolean 等
      case ts.SyntaxKind.StringKeyword:
      case ts.SyntaxKind.NumberKeyword:
      case ts.SyntaxKind.BooleanKeyword:
      case ts.SyntaxKind.UndefinedKeyword:
      case ts.SyntaxKind.NullKeyword:
      case ts.SyntaxKind.AnyKeyword:
      case ts.SyntaxKind.UnknownKeyword:
      case ts.SyntaxKind.NeverKeyword:
      case ts.SyntaxKind.BigIntKeyword:
      case ts.SyntaxKind.SymbolKeyword:
        return [this.createBaseAttr(typeNode)];

      // 数组类型
      case ts.SyntaxKind.ArrayType:
        return this.createArrayAttr(typeNode as ts.ArrayTypeNode);

      // 字面量类型（如 "male" | 123）
      case ts.SyntaxKind.LiteralType:
        return [this.createLiteralAttr(typeNode)];

      // 联合类型（如 string | number）
      case ts.SyntaxKind.UnionType:
        return this.createUnionAttr(typeNode as ts.UnionTypeNode);

      // 类型引用（如 User、Partial<T>）
      case ts.SyntaxKind.TypeReference:
        return [this.createTypeRefAttr(typeNode)];

      // 内联对象类型（如 { id: number; name: string }）
      case ts.SyntaxKind.TypeLiteral:
        return [this.createTypeLiteralAttr(typeNode)];

      default:
        return [this.createErrorAttr(`未知类型: ${typeNode.getText()}`)];
    }
  }

  /** 创建基础类型属性 */
  private createBaseAttr(typeNode: ts.Node): AttributeValue {
    return {
      // @ts-ignore
      value: `'${TsBaseKeyword[typeNode.kind]}'`,
      isArray: false,
      valueType: AttributeValueType.BaseType,
    };
  }

  /** 创建数组类型属性 */
  private createArrayAttr(typeNode: ts.ArrayTypeNode): AttributeValue[] {
    const elementTypes = this.parseTypeNode(typeNode.elementType);
    return elementTypes.map((el) => ({...el, isArray: true}));
  }

  /** 创建字面量属性（如 'admin'） */
  private createLiteralAttr(typeNode: ts.Node): AttributeValue {
    return {
      value: typeNode.getText(),
      isArray: false,
      valueType: AttributeValueType.Alias,
    };
  }

  /** 创建联合类型属性（如 string | number） */
  private createUnionAttr(typeNode: ts.UnionTypeNode): AttributeValue[] {
    return typeNode.types.flatMap((t) => this.parseTypeNode(t));
  }

  /** 创建类型引用属性（如 User / Promise<string>） */
  private createTypeRefAttr(typeNode: ts.Node): AttributeValue {
    const text = typeNode.getText();
    if (text.includes('<')) {
      return this.createErrorAttr(`暂不支持带泛型的类型: ${text}`);
    }
    return {
      value: formatObjectName(text),
      isArray: false,
      valueType: AttributeValueType.TypeReference,
    };
  }

  /** 创建内联对象类型属性 */
  private createTypeLiteralAttr(typeNode: ts.Node): AttributeValue {
    return {
      // @ts-ignore
      value: typeNode.members.map((m: any) => this.parsePropertyNode(m)),
      isArray: false,
      valueType: AttributeValueType.TypeLiteral,
    };
  }

  /** 创建错误类型属性 */
  private createErrorAttr(message: string): AttributeValue {
    this.warning('暂不支持的类型', message);
    return {
      value: ParseError,
      isArray: false,
      valueType: AttributeValueType.BaseType,
    };
  }

  /* =========================================================
   * 五、构建输出阶段
   * ========================================================= */

  /** 入口函数：执行解析并生成输出代码 */
  public build(): string {
    this.createTsAst();
    this.parseNode();
    return this.generateExportCode();
  }

  /** 生成最终输出代码字符串 */
  private generateExportCode(): string {
    // 类型字段属性
    const valueToString = (values: AttributeValue[]): string =>
      values
        .map((v) => {
          if (v.valueType === AttributeValueType.TypeLiteral) {
            return `{value:{${propsToString(v.value)}},isArray:${v.isArray},valueType:'${v.valueType}'}`;
          }
          return `{value:${v.value},isArray:${v.isArray},valueType:'${v.valueType}'}`;
        })
        .join(',');
    // 生成 类型字段对象, attribute 使用惰性引用，解决变量提升带来的错误
    const propsToString = (props: SchemaPropertyType[]): string =>
      props
        .map((p) => {
          const valStr = valueToString(p.attribute);
          return `${p.key}:{isOptional:${p.isOptional},get attribute() {return [${valStr}]},key:'${p.key}'}`;
        })
        .join(',');

    return this.parsedInterfaces
      .map((intf) => {
        const body = propsToString(intf.props);
        return `\n${intf.isExport || this.isExport ? 'export' : ''} var ${intf.objectName} = { ${body}};\n
        Object.defineProperty(${intf.objectName},'${DeclarationTypeKey}',{
           value: '${intf._declarationType}',
           enumerable: false
        });\n
        `;
      })
      .join('');
  }

  /* =========================================================
   * 六、日志与错误处理
   * ========================================================= */
  private warning(title: string, msg?: string) {
    console.warn(`[Warning] ${title}`, msg ?? '');
  }

  private error(title: string, e?: any) {
    console.error(`[Error] ${title}`, e);
    throw e;
  }

  // @ts-ignore
  private info(msg: string) {
    console.info(`[Info] ${msg}`);
  }
}

/** 特殊标识：用于过滤解析失败的属性值 */
const ParseError = Symbol('ParseError');

export default InterfaceSchemaParser;
