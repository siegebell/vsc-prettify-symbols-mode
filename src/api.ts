import * as vscode from 'vscode';

/** Essentially mirrors vscode.DecorationRenderOptions, but restricted to the
 * properties that apply to both :before/:after decorations and plain decorations */
export interface ConcealStyleProperties {
  border?: string,
  textDecoration?: string,
  color?: string,
  backgroundColor?: string,
  hackCSS?: string,
}
export interface ConcealStyle extends ConcealStyleProperties {
  dark?: ConcealStyleProperties,
  light?: ConcealStyleProperties,
}

/** An individual substitution */
export interface Substitution {
  ugly: string;        // regular expression describing the text to replace
  pretty: string;      // plain-text symbol to show instead
  pre?: string;        // regular expression guard on text before "ugly"
  post?: string;       // regular expression guard on text after "ugly"
  style?: ConcealStyle; // stylings to apply to the pretty text, if specified, or else the ugly text
  scope?: string,      // TextMate scope; if specified, the ugly portion's range must be exactly within the given scope
}

export interface LanguageEntry {
  /** language(s) to apply these substitutions on */
  language: vscode.DocumentSelector;
  /** substitution rules */
  substitutions: Substitution[];
  /** The filename of the language's grammar. If specified, substitutions' scope entries refer to scope names in the given grammar. If undefined, then search for a grammar.*/
  textMateGrammar?: string;
  /** Override the TextMate scope for the language */
  textMateInitialScope?: string;
}


export interface ConcealSymbolsMode {
  /** Register a handler to receive notifications when PSM is enabled or disabled.
   * @returns a disposable object to unregister the handler
   */
  onDidEnabledChange: (handler: (enabled: boolean) => void) => vscode.Disposable,
  /** Query whether PSM is "enabled" - this refers to the user's ability to
   * temporarily enable/disable the mode for an instance of vscode."
   * @returns `true` iff PSM is currently enabled
   */
  isEnabled: () => boolean,
  /** Temporarily add more substitutions.
   * @returns a disposable object to remove the provided substitutions
   */
  registerSubstitutions: (substitutions: LanguageEntry) => vscode.Disposable,
}