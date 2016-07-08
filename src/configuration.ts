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

export interface LanguageEntry {
	language:  vscode.DocumentSelector;
	substitutions: Substitution[];
	revealOn: UglyRevelation;
}

export interface Settings {
  substitutions: LanguageEntry[];
}