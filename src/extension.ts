// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as util from 'util';
import {Settings, LanguageEntry, Substitution, UglyRevelation, PrettyCursor, HideTextMethod} from './configuration';
import {PrettyDocumentController} from './document';
import * as api from './api';

/** globally enable or disable all substitutions */
let prettySymbolsEnabled = true;

/** Defaults loaded from the top-level settings; applied to language entries that do not specify each property */
// let defaultAdjustCursorMovement : boolean = false;
// let defaultRevelationStrategy : UglyRevelation = 'cursor';
// let defaultPrettyCursor : PrettyCursor = 'boxed';

/** Tracks all documents that substitutions are being applied to */
let documents = new Map<vscode.Uri,PrettyDocumentController>();
/** The current configuration */
let settings : Settings;

const onEnabledChangeHandlers = new Set<(enabled: boolean)=>void>();
export const additionalSubstitutions = new Set<api.LanguageEntry>();

/** initialize everything; main entry point */
export function activate(context: vscode.ExtensionContext) : api.PrettifySymbolsMode {
  vscode.extensions.getExtension('siegebell.prettify-symbols-mode')
	function registerTextEditorCommand(commandId:string, run:(editor:vscode.TextEditor,edit:vscode.TextEditorEdit,...args:any[])=>void): void {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand(commandId, run));
  }
  function registerCommand(commandId:string, run:(...args:any[])=>void): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
  }

  registerCommand('extension.disablePrettySymbols', disablePrettySymbols);
  registerCommand('extension.enablePrettySymbols', enablePrettySymbols);
  registerCommand('extension.togglePrettySymbols', (editor: vscode.TextEditor) => {
    if(prettySymbolsEnabled) {
      disablePrettySymbols();
    } else {
      enablePrettySymbols();
    }
  });

  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(selectionChanged));

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(openDocument));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(closeDocument));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(onConfigurationChanged));

  reloadConfiguration();

  const result : api.PrettifySymbolsMode = {
    onDidEnabledChange: function(handler: (enabled:boolean)=>void) : vscode.Disposable {
      onEnabledChangeHandlers.add(handler);
      return {
        dispose() {
          onEnabledChangeHandlers.delete(handler);
        }
      }
    },
    isEnabled: function() : boolean {
      return prettySymbolsEnabled;
    },
    registerSubstitutions: function(substitutions: api.LanguageEntry) : vscode.Disposable {
      additionalSubstitutions.add(substitutions);
      // TODO: this could be smart about not unloading & reloading everything 
      reloadConfiguration();
      return {
        dispose() {
          additionalSubstitutions.delete(substitutions);
        }
      }
    }
  };

  return result;
}



/** A text editor selection changed; forward the event to the relevant document */
function selectionChanged(event: vscode.TextEditorSelectionChangeEvent) {
  try {
    const prettyDoc = documents.get(event.textEditor.document.uri);
    if(prettyDoc)
      prettyDoc.selectionChanged(event.textEditor);
  } catch(e) {
    console.error(e);
  }
}

/** Te user updated their settings.json */
function onConfigurationChanged(){
  reloadConfiguration();
}

/** Re-read the settings and recreate substitutions for all documents */
function reloadConfiguration() {
  const configuration = vscode.workspace.getConfiguration("prettifySymbolsMode");
  settings = {
    substitutions: configuration.get<LanguageEntry[]>("substitutions",[]),
    revealOn: configuration.get<UglyRevelation>("revealOn","cursor"),
    adjustCursorMovement: configuration.get<boolean>("adjustCursorMovement",false),
    prettyCursor: configuration.get<PrettyCursor>("prettyCursor","boxed"),
    hideTextMethod: configuration.get<HideTextMethod>("hideTextMethod","hack-letterSpacing"),
  };

  // Set default values for language-properties that were not specified
  for(const language of settings.substitutions) {
    if(language.revealOn === undefined)
      language.revealOn = settings.revealOn;
    if(language.adjustCursorMovement === undefined)
      language.adjustCursorMovement = settings.adjustCursorMovement;
    if(language.prettyCursor === undefined)
      language.prettyCursor = settings.prettyCursor;
  }

  // Recreate the documents
  unloadDocuments();
  for(const doc of vscode.workspace.textDocuments)
    openDocument(doc);
}

function disablePrettySymbols() {
  prettySymbolsEnabled = false;
  onEnabledChangeHandlers.forEach(h => h(false));
  unloadDocuments();
}

function enablePrettySymbols() {
  prettySymbolsEnabled = true;
  onEnabledChangeHandlers.forEach(h => h(true));
  reloadConfiguration();
}


/** Attempts to find the best-matching language entry for the language-id of the given document.
 * @param the document to match
 * @returns the best-matching language entry, or else `undefined` if none was found */
function getLanguageEntry(doc: vscode.TextDocument) : LanguageEntry {
  const rankings = settings.substitutions
    .map((entry) => ({rank: vscode.languages.match(entry.language, doc), entry: entry}))
    .filter(score => score.rank > 0)
    .sort((x,y) => (x.rank > y.rank) ? -1 : (x.rank==y.rank) ? 0 : 1);

  let entry : LanguageEntry = rankings.length > 0
    ? Object.assign({}, rankings[0].entry)
    : {
      language: doc.languageId,
      substitutions: [],
      adjustCursorMovement: settings.adjustCursorMovement,
      revealOn: settings.revealOn,
      prettyCursor: settings.prettyCursor,
    };

  for(const language of additionalSubstitutions) {
    if(vscode.languages.match(language.language, doc) > 0) {
      entry.substitutions.push(...language.substitutions);
    }
  }

  return entry;
}

function openDocument(doc: vscode.TextDocument) {
  if(!prettySymbolsEnabled)
    return;
  const prettyDoc = documents.get(doc.uri);
  if(prettyDoc) {
    prettyDoc.refresh();
  } else {
    const language = getLanguageEntry(doc);
    if(language && language.substitutions.length > 0) {
      documents.set(doc.uri, new PrettyDocumentController(doc, language, {hideTextMethod: settings.hideTextMethod}));
    }
  }
}

function closeDocument(doc: vscode.TextDocument) {
  const prettyDoc = documents.get(doc.uri);
  if(prettyDoc) {
    prettyDoc.dispose();
    documents.delete(doc.uri);
  }
}

function unloadDocuments() {
  for(const prettyDoc of documents.values()) {
    prettyDoc.dispose();
  }
  documents.clear();
}

/** clean-up; this extension is being unloaded */
export function deactivate() {
  onEnabledChangeHandlers.forEach(h => h(false));
  unloadDocuments();
}

