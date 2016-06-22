import * as vscode from 'vscode';

export interface Substitution {
	ugly: string;
	pretty: string;
	pre?: string;
	post?: string;
}

export interface LanguageEntry {
	language:  vscode.DocumentSelector;
	substitutions: Substitution[];
}

export interface Settings {
  substitutions: LanguageEntry[];
}
