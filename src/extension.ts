// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'; 
import * as util from 'util'; 
import {Settings, LanguageEntry, Substitution} from './configuration'; 
import {PrettyDocumentController} from './document'; 

let prettySymbolsEnabled = true;
let prettyCursorEnabled = true;

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
  registerTextEditorCommand('extension.disablePrettyCursor', (editor: vscode.TextEditor) => {
    prettyCursorEnabled = false;
  });
  registerTextEditorCommand('extension.enablePrettyCursor', (editor: vscode.TextEditor) => {
    prettyCursorEnabled = true;
  });

  // registerCommand('cursorLeft', cursorLeft);
  // registerCommand('cursorRight', cursorRight);
  // registerCommand('cursorDown', cursorDown);
  // registerCommand('cursorUp', cursorUp);
  registerTextEditorCommand('extension.prettyCursorLeft', cursorLeft);
  registerTextEditorCommand('extension.prettyCursorRight', cursorRight);
  registerTextEditorCommand('extension.prettyCursorLeftSelect', cursorLeftSelect);
  registerTextEditorCommand('extension.prettyCursorRightSelect', cursorRightSelect);

  reloadConfiguration();

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(openDocument));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(closeDocument));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(onConfigurationChanged));

}

async function adjustCursor(editor: vscode.TextEditor, command: string, handler: (doc: PrettyDocumentController, editor:vscode.TextEditor, before: vscode.Selection[], after: vscode.Selection[]) => void) {
  const before = editor.selections;
  await vscode.commands.executeCommand(command,editor);
  if(!prettyCursorEnabled)
    return;
  try {
    const after = editor.selections;
    const prettyDoc = documents.get(editor.document.uri);
    if(prettyDoc)
      handler(prettyDoc, editor, before, after)
  } catch(e) {}
}

async function cursorLeft(editor: vscode.TextEditor) {
  adjustCursor(editor,'cursorLeft', (d,e,b,a) => d.adjustCursor(e, b, a));
}

async function cursorRight(editor: vscode.TextEditor) {
  adjustCursor(editor,'cursorRight', (d,e,b,a) => d.adjustCursor(e, b, a));
}

async function cursorLeftSelect(editor: vscode.TextEditor) {
  adjustCursor(editor,'cursorLeftSelect', (d,e,b,a) => d.adjustCursorSelect(e, b, a));
}

async function cursorRightSelect(editor: vscode.TextEditor) {
  adjustCursor(editor,'cursorRightSelect', (d,e,b,a) => d.adjustCursorSelect(e, b, a));
}

function onConfigurationChanged(){
  reloadConfiguration();
}

function reloadConfiguration() {
  const configuration = vscode.workspace.getConfiguration("prettifySymbolsMode");
  languageSettings = configuration.get<LanguageEntry[]>("substitutions");

  // Recreate the documents
  for(const prettyDoc of documents.values()) {
    prettyDoc.dispose();
  }
  documents.clear();
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

function getLanguageEntry(doc: vscode.TextDocument) {
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
    if(language)
      documents.set(doc.uri, new PrettyDocumentController(doc, language.substitutions));
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

