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

/** Essentially mirrors vscode.DecorationRenderOptions */
export interface PrettyStyleProperties {
  border?: string,
	textDecoration?: string,
	color?: string,
	backgroundColor?: string,
}
export interface PrettyStyle extends PrettyStyleProperties {
	dark?: PrettyStyleProperties,
	light?: PrettyStyleProperties,
}

export function assignStyleProperties(target: PrettyStyleProperties, source: PrettyStyleProperties) {
	if(target===undefined || source===undefined)
		return;
	if(source.backgroundColor)
		target.backgroundColor = source.backgroundColor;
	if(source.border)
		target.border = source.border;
	if(source.color)
		target.color = source.color;
	if(source.textDecoration)
		target.textDecoration = source.textDecoration;
}

export interface Substitution {
	ugly: string;
	pretty: string;
	pre?: string;
	post?: string;
	style?: PrettyStyle;
}

export interface LanguageEntry {
	language:  vscode.DocumentSelector;
	substitutions: Substitution[];
	revealOn: UglyRevelation;
	adjustCursorMovement: boolean;
	prettyCursor: PrettyCursor;
}

export interface Settings {
  substitutions: LanguageEntry[];
}