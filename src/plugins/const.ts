import ts from "typescript";

// @ts-expect-error
export enum KeyWord {
	StringKeyword = "string_keyword",
	NumberKeyword = "number_keyword",
	BooleanKeyword = "boolean_keyword",
	UndefinedKeyword = "undefined_keyword",
	NullKeyword = "null_keyword",
	AnyKeyword = "any_keyword",
	UnknownKeyword = "unknown_keyword",
	NeverKeyword = "never_keyword",
	BigKeyword = "big_keyword",
	SymbolKeyword = "symbol_keyword",
}
export const AttributeValueType = {
	TypeReference: "typeReference", // 引用对象类型
	TypeLiteral: "typeLiteral", // 匿名对象类型
	BaseType: "baseType", // 基本对象类型
	Alias: "alias", // 别名类型
};
export const TsBaseKeyword = {
	[ts.SyntaxKind.StringKeyword]: KeyWord.StringKeyword,
	[ts.SyntaxKind.NumberKeyword]: KeyWord.NumberKeyword,
	[ts.SyntaxKind.BooleanKeyword]: KeyWord.BooleanKeyword,
	[ts.SyntaxKind.UndefinedKeyword]: KeyWord.UndefinedKeyword,
	[ts.SyntaxKind.NullKeyword]: KeyWord.NullKeyword,
	[ts.SyntaxKind.AnyKeyword]: KeyWord.AnyKeyword,
	[ts.SyntaxKind.UnknownKeyword]: KeyWord.UnknownKeyword,
	[ts.SyntaxKind.NeverKeyword]: KeyWord.NeverKeyword,
	[ts.SyntaxKind.BigIntKeyword]: KeyWord.BigKeyword,
	[ts.SyntaxKind.SymbolKeyword]: KeyWord.SymbolKeyword,
};
export const DeclarationTypeKey = "_DeclarationTypeKey";
// @ts-expect-error
export enum DeclarationType {
	InterfaceDeclaration = "interface",
	TypeLiteralDeclaration = "typeLiteral", // 类型字面 type user = {name: string,age:number}
	TypeAliasDeclaration = "typeAlias", // 类型别名 type name = 'student' | 'teacher'
}

const transformStringKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.StringKeyword) {
		return KeyWord.StringKeyword;
	}
};
const transformNumberKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.NumberKeyword) {
		return KeyWord.NumberKeyword;
	}
};
const transformBooleanKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.BooleanKeyword) {
		return KeyWord.BooleanKeyword;
	}
};
const transformUndefinedKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
		return KeyWord.UndefinedKeyword;
	}
};
const transformNullKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.NullKeyword) {
		return KeyWord.NullKeyword;
	}
};
const transformAnyKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.AnyKeyword) {
		return KeyWord.AnyKeyword;
	}
};
const transformUnknownKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.UnknownKeyword) {
		return KeyWord.UnknownKeyword;
	}
};
const transformNeverKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.NeverKeyword) {
		return KeyWord.NeverKeyword;
	}
};
const transformBigKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.BigIntKeyword) {
		return KeyWord.BigKeyword;
	}
};
const transformSymbolKeyword = (node: ts.Node) => {
	if (node.kind === ts.SyntaxKind.SymbolKeyword) {
		return KeyWord.SymbolKeyword;
	}
};

export const ParseTool = {
	transformBigKeyword,
	transformBooleanKeyword,
	transformStringKeyword,
	transformNumberKeyword,
	transformUndefinedKeyword,
	transformNullKeyword,
	transformAnyKeyword,
	transformUnknownKeyword,
	transformNeverKeyword,
	transformSymbolKeyword,
};
