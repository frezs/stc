import ts from "npm:typescript";
import vfs from "npm:@typescript/vfs";

export const generateDeclarationFile = (
  sourceCode: string,
) => {
  sourceCode = `
    export type TypeTest = 1 | 0 | 3;
    export interface ISwagger {
      name: string;
      age: number;
      test: Array<string>;
    }
     
    /**
     * Adds two numbers.
     * @param a The first number.
     * @param b The second number.
     * @returns The sum of a and b.
     */
    export function add(a: any, b: any): number {
      return a + b;
    }
  `;
  const filename = "temp.ts";
  let declarationContent = "";

  // 创建一个编译选项对象
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    declaration: true,
    emitDeclarationOnly: true,
  };

  // const fsMap = await vfs.createDefaultMapFromCDN(
  //   compilerOptions,
  //   ts.version,
  //   true,
  //   ts,
  // );
  // fsMap.set(filename, sourceCode);

  // const system = vfs.createSystem(fsMap);
  // const host = vfs.createVirtualCompilerHost(system, compilerOptions, ts);
  // const program = ts.createProgram({
  //   rootNames: [...fsMap.keys()],
  //   options: compilerOptions,
  //   host: host.compilerHost,
  // });

  // // This will update the fsMap with new files
  // // for the .d.ts and .js files
  // program.emit();

  // // Now I can look at the AST for the .ts file too
  // const index = program.getSourceFile(filename);
  // console.log(index);

  const sourceFile = ts.createSourceFile(
    filename,
    sourceCode,
    ts.ScriptTarget.ESNext,
  );

  const _declarationContent: string[] = [];
  // ts.forEachChild(sourceFile, (node) => {
  //   if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
  //     _declarationContent.push(node.getText(sourceFile));
  //   }

  //   if (ts.isEnumDeclaration(node)) {
  //   }

  //   if (ts.isFunctionDeclaration(node)) {
  //     const _name = node.name?.text;
  //     const _comment = ts.getSyntheticLeadingComments(node);
  //     const _param = node.parameters.map((_p) => {
  //       const _pn = _p.name.getText(sourceFile);
  //       const _pt = _p.type?.getText(sourceFile);

  //       return `${_pn}: ${_pt}`;
  //     }).join(", ");
  //     const _returnType = node.type?.getText(sourceFile);

  //     _declarationContent.push(
  //       `export function ${_name}(${_param}): ${_returnType}`,
  //     );
  //   }
  // });

  // console.log(_declarationContent);

  const defaultCompilerHost = ts.createCompilerHost(compilerOptions);
  const host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      if (fileName === filename) {
        return sourceFile;
      }
      return defaultCompilerHost.getSourceFile(fileName, languageVersion);
    },
    writeFile: (_name, text) => {
      declarationContent = text;
    },
    getDefaultLibFileName: () => "lib.d.ts",
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => "",
    getNewLine: () => "\n",
    getDirectories: () => [],
    fileExists: () => true,
    readFile: () => "",
  };

  // 创建 TypeScript 编译器实例
  const program = ts.createProgram(
    [filename],
    compilerOptions,
    host,
  );

  // 执行编译并处理结果
  const emitResult = program.emit();

  if (emitResult.emitSkipped) {
    console.error("Compilation failed");
    const allDiagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);

    allDiagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        const { line, character } = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start!,
        );
        const message = ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          "\n",
        );
        console.log(
          `${diagnostic.file.fileName} (${line + 1},${
            character + 1
          }): ${message}`,
        );
      } else {
        console.log(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      }
    });
  }

  return declarationContent;
};
