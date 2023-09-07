import * as vscode from 'vscode';

/** Describes conditions in which a symbol may be temporarily revealed */
export type UglyRevelation = 
  'cursor'        // the cursor reveals any ugly symbol it touches
	| 'cursor-inside' // the cursor reveals any symbol it enters
	| 'active-line'   // the cursor reveals all symbols on the same line
	| 'selection'     // the cursor reveals all symbols within a selection
	| 'none';         // the cursor does not reveal any symbol

/** Controls how a symbol is rendered when a cursor is on it */
export type PrettyCursor =
    'boxed' // render an outline around the symbol
	| 'none'  // do change to the symbol

/** Essentially mirrors vscode.DecorationRenderOptions, but restricted to the
 * properties that apply to both :before/:after decorations and plain decorations */
export interface ConcealStyleProperties {
  border?: string,
	textDecoration?: string,
	color?: string | vscode.ThemeColor,
	backgroundColor?: string | vscode.ThemeColor,
	hackCSS?: string,
}
export interface ConcealStyle extends ConcealStyleProperties {
	dark?: ConcealStyleProperties,
	light?: ConcealStyleProperties,
}

/** Copy all defined stying properties to the target */
export function assignStyleProperties(target: ConcealStyleProperties, source: ConcealStyleProperties) {
	if(target===undefined || source===undefined)
		return;
	if(source.backgroundColor)
		target.backgroundColor = source.backgroundColor;
	if(source.border)
		target.border = source.border;
	if(source.color)
		target.color = source.color;
	if(source.textDecoration) {
		target.textDecoration = source.textDecoration + (source.hackCSS ? '; ' + source.hackCSS : "");
	} else if(source.hackCSS)
		target.textDecoration = 'none; ' + source.hackCSS;
}

/** An individual substitution */
export interface Substitution {
	ugly: string,        // regular expression describing the text to replace
	pretty: string,      // plain-text symbol to show instead
	pre?: string,        // regular expression guard on text before "ugly"
	post?: string,       // regular expression guard on text after "ugly"
	style?: ConcealStyle, // stylings to apply to the "pretty" text, if specified, or else the ugly text
	scope?: string,      // TextMate scope; if specified, the ugly portion's range must be exactly within the given scope
}

/** The substitution settings for a language (or group of languages) */
export interface LanguageEntry {
	/** language(s) to apply these substitutions on */
	language:  vscode.DocumentSelector;
	/** substitution rules */
	substitutions: Substitution[];
	/** If `true`, combine adjacent tokens if they have the same scope name */
	combineIdenticalScopes: boolean;
	/** try to make pretty-symbol act like a single character */
	adjustCursorMovement?: boolean;
	/** when to unfold a symbol to reveal its underlying text; in response to cursors or selections */
	revealOn?: UglyRevelation;
	/** rendering tweaks to a symbol when in proximity to the cursor */
	prettyCursor?: PrettyCursor;
	/** The filename of the language's grammar. If specified, substitutions' scope entries refer to scope names in the given grammar. If undefined, then search for a grammar.*/
	textMateGrammar?: string;
	/** Override the TextMate scope for the language */
	textMateInitialScope?: string;
}

export type HideTextMethod = "hack-fontSize" | "hack-letterSpacing" | "none";

/** The settings for `prettifySymbolsMode.substitutions` */
export interface Settings {
	/** Main substitution settings, each targetting a different set of languages.
	 * If more than one entry matches a document, we will pick the one with the
	 * highest match-score, as determined by vscode.languages.match()
	*/
  substitutions: LanguageEntry[],
  // Defaults loaded from the top-level settings; applied to language entries that do not specify each property */
	/** try to make pretty-symbol act like a single character */
  adjustCursorMovement: boolean, 
	/** when to unfold a symbol to reveal its underlying text; in response to cursors or selections */
  revealOn: UglyRevelation,
	/** rendering tweaks to a symbol when in proximity to the cursor */
  prettyCursor: PrettyCursor,
	/** */
	hideTextMethod: HideTextMethod,
}