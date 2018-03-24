import * as path from 'path';
const tm = loadTextMate();

function loadTextMate(): any {
  try {
    require(path.join(require.main.filename, '../../node_modules/vscode-textmate/release/main.js'));
  } catch(error) {
    return null;
  }
}

// namespace N {
//   /**
//    * The registry that will hold all grammars.
//    */
//   export declare class Registry {
//     private readonly _locator;
//     private readonly _syncRegistry;
//     constructor(locator?: IGrammarLocator);
//     /**
//      * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
//      */
//     loadGrammar(initialScopeName: string, callback: (err: any, grammar: IGrammar) => void): void;
//     /**
//      * Load the grammar at `path` synchronously.
//      */
//     loadGrammarFromPathSync(path: string): IGrammar;
//     /**
//      * Get the grammar for `scopeName`. The grammar must first be created via `loadGrammar` or `loadGrammarFromPathSync`.
//      */
//     grammarForScopeName(scopeName: string): IGrammar;
//   }  
// }

export function matchScope(scope: string, scopes: string[]) : boolean {
  if(!scope)
    return true;
  const parts = scope.split(/\s+/);
  let idx = 0;
  for(let part of parts) {
    while(idx < scopes.length && !scopes[idx].startsWith(part))
      ++idx;
    if(idx >= scopes.length)
      return false;
    ++idx;
  }
  return true;
}

export interface Registry {
  new (locator?: IGrammarLocator);
  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   */
  loadGrammar(initialScopeName: string, callback: (err: any, grammar: IGrammar) => void): void;
  /**
   * Load the grammar at `path` synchronously.
   */
  loadGrammarFromPathSync(path: string): IGrammar;
  /**
   * Get the grammar for `scopeName`. The grammar must first be created via `loadGrammar` or `loadGrammarFromPathSync`.
   */
  grammarForScopeName(scopeName: string): IGrammar;
}  

class DummyRegistry {
  public constructor(locator?: IGrammarLocator) {}
  loadGrammar(initialScopeName: string, callback: (err: any, grammar: IGrammar) => void) {}
  loadGrammarFromPathSync(path: string): IGrammar {
    throw "TextMate is not available"
  }
  grammarForScopeName(scopeName: string): IGrammar {
    throw "TextMate is not available";
  }
}

export const Registry : Registry = tm == null ? (DummyRegistry as any) : tm.Registry;

/**
 * A registry helper that can locate grammar file paths given scope names.
 */
export interface IGrammarLocator {
  getFilePath(scopeName: string): string;
  getInjections?(scopeName: string): string[];
}

export interface IGrammarInfo {
  readonly fileTypes: string[];
  readonly name: string;
  readonly scopeName: string;
  readonly firstLineMatch: string;
}
/**
 * A grammar
 */
export interface IGrammar {
  /**
   * Tokenize `lineText` using previous line state `prevState`.
   */
  tokenizeLine(lineText: string, prevState: StackElement): ITokenizeLineResult;
}
export interface ITokenizeLineResult {
  readonly tokens: IToken[];
  /**
   * The `prevState` to be passed on to the next line tokenization.
   */
  readonly ruleStack: StackElement;
}
export interface IToken {
  startIndex: number;
  readonly endIndex: number;
  readonly scopes: string[];
}
/**
 * **IMPORTANT** - Immutable!
 */
export interface StackElement {
  _stackElementBrand: void;
  readonly _parent: StackElement;
  equals(other: StackElement): boolean;
}


export function combineIdenticalTokenScopes(tokens: IToken[]) : IToken[] {
  if(!tokens || tokens.length === 0)
    return [];
  const result = [tokens[0]];
  let prevToken = tokens[0];
  for(let idx = 1; idx < tokens.length; ++idx) {
    const token = tokens[idx];
    if(prevToken.endIndex===token.startIndex && token.scopes.length === prevToken.scopes.length && token.scopes.every((t,idx) => t === prevToken.scopes[idx])) {
      // Note: create a copy of the object so the source tokens are unmodified
      result[result.length-1] = {startIndex: prevToken.startIndex, endIndex: token.endIndex, scopes: prevToken.scopes}
      prevToken = result[result.length-1];
    } else {
      result.push(token);
      prevToken = token;
    }
  }
  return result;
}

