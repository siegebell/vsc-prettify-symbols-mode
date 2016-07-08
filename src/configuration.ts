import * as vscode from 'vscode';

export interface Substitution {
	ugly: string;
	pretty: string;
	pre?: string;
	post?: string;
}

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