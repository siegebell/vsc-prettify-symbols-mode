// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'; 
import * as util from 'util'; 
import {Settings, LanguageEntry, Substitution, UglyRevelation, PrettyCursor} from './configuration'; 
import {PrettyDocumentController} from './document'; 

let prettySymbolsEnabled = true;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	function registerTextEditorCommand(commandId:string, run:(editor:vscode.TextEditor,edit:vscode.TextEditorEdit,...args:any[])=>void): void {
    context.subscriptions.push(vscode.commands.registerTextEditorCommand(commandId, run));
  }
  function registerCommand(commandId:string, run:(...args:any[])=>void): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
  }

  registerTextEditorCommand('extension.disablePrettySymbols', (editor: vscode.TextEditor) => {
    prettySymbolsEnabled = false;
    unloadDocuments();
  });
  registerTextEditorCommand('extension.enablePrettySymbols', (editor: vscode.TextEditor) => {
    prettySymbolsEnabled = true;
    reloadConfiguration();
  });
  registerTextEditorCommand('extension.togglePrettySymbols', (editor: vscode.TextEditor) => {
    if(prettySymbolsEnabled) {
      prettySymbolsEnabled = false;
      unloadDocuments();
    } else {
      prettySymbolsEnabled = true;
      reloadConfiguration();
    }
  });

  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(selectionChanged));

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(openDocument));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(closeDocument));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(onConfigurationChanged));

  reloadConfiguration();
}

function selectionChanged(event: vscode.TextEditorSelectionChangeEvent) {
  try {
    const prettyDoc = documents.get(event.textEditor.document.uri);
    if(prettyDoc)
      prettyDoc.selectionChanged(event.textEditor);
  } catch(e) {
    console.error(e);
  }  
}

function onConfigurationChanged(){
  reloadConfiguration();
}

let defaultAdjustCursorMovement : boolean = false;
let defaultRevelationStrategy : UglyRevelation = 'cursor';
let defaultPrettyCursor : PrettyCursor = 'boxed';

function reloadConfiguration() {
  const configuration = vscode.workspace.getConfiguration("prettifySymbolsMode");
  languageSettings = configuration.get<LanguageEntry[]>("substitutions");
  defaultRevelationStrategy = configuration.get<UglyRevelation>("revealOn");
  defaultAdjustCursorMovement = configuration.get<boolean>("adjustCursorMovement");
  defaultPrettyCursor = configuration.get<PrettyCursor>("prettyCursor");

  for(const language of languageSettings) {
    if(language.revealOn === undefined)
      language.revealOn = defaultRevelationStrategy;
    if(language.adjustCursorMovement === undefined)
      language.adjustCursorMovement = defaultAdjustCursorMovement;
    if(language.prettyCursor === undefined)
      language.prettyCursor = defaultPrettyCursor;
  }

  // Recreate the documents
  unloadDocuments();
  for(const doc of vscode.workspace.textDocuments)
    openDocument(doc);
}






// // →↔⇒⇔∃∀ ∎∴∵⋀⋁□⟷⟵⟶∧∨∎←→
// const prettySubstitutions =
//   [ {ugly: "\\b(forall)\\b", pretty: "∀"},
//     {ugly: "\\b(exists)\\b", pretty: "∃"},
//     {ugly: "(/\\\\)", pretty: "∧"},
//     {ugly: "(\\\\/)", pretty: "∨"},
//     {ugly: "([<][-][>])", pretty: "⟷"},
//     {ugly: "([-][>])", pretty: "⟶"},
//     {ugly: "\\b(Qed)[.]", pretty: "∎"},
//   ];

let documents = new Map<vscode.Uri,PrettyDocumentController>();
let languageSettings : LanguageEntry[] = [];

function getLanguageEntry(doc: vscode.TextDocument) : LanguageEntry {
  return languageSettings
    .find((entry) => {
      const match = vscode.languages.match(entry.language, doc);
      return match > 0;
    });
}


function openDocument(doc: vscode.TextDocument) {
  if(!prettySymbolsEnabled)
    return;
  const prettyDoc = documents.get(doc.uri);
  if(prettyDoc) {
    prettyDoc.refresh();
  } else {
    const language = getLanguageEntry(doc);
    if(language) {
      documents.set(doc.uri, new PrettyDocumentController(doc, language));
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


// this method is called when your extension is deactivated
export function deactivate() {
  unloadDocuments();
}

