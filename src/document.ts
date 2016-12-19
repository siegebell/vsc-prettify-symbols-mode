import * as vscode from 'vscode';
import * as copyPaste from 'copy-paste';

import {Substitution, UglyRevelation, LanguageEntry, PrettyCursor, PrettyStyleProperties, PrettyStyle, assignStyleProperties, HideTextMethod} from './configuration';
import * as pos from './position';
import {RangeSet} from './RangeSet';
import {DisjointRangeSet} from './DisjointRangeSet';
import * as drangeset from './DisjointRangeSet';
import * as textUtil from './text-util';
import * as tm from './text-mate';
import {MatchResult, iterateMatches, iterateMatchArray, mapIterator} from './regexp-iteration';
import * as decorations from './decorations';
import {PrettyModel, UpdateDecorationEntry} from './PrettyModel';

const debugging = false;
const activeEditorDecorationTimeout = 20;
const inactiveEditorDecorationTimeout = 200;

function arrayEqual<T>(a1: T[], a2: T[], isEqual: (x:T,y:T)=>boolean = ((x,y) => x===y)) : boolean {
  if(a1.length!=a2.length)
    return false;
  for(let idx = 0; idx < a1.length; ++idx) {
    if(!isEqual(a1[idx],a2[idx]))
      return false;
  }
  return true;
}


export class PrettyDocumentController implements vscode.Disposable {
  private readonly model : PrettyModel;
  private readonly subscriptions : vscode.Disposable[] = [];
  private currentDecorations : UpdateDecorationEntry[] = [];

  public constructor(doc: vscode.TextDocument, settings: LanguageEntry, options: {hideTextMethod: HideTextMethod, textMateGrammar?: tm.IGrammar|null},
    private document = doc,
    private adjustCursorMovement = settings.adjustCursorMovement,
  ) {
    const docModel = {
      getText: (r?:vscode.Range) => this.document.getText(r),
      getLine: (n:number) => this.document.lineAt(n).text,
      getLineRange: (n:number) => this.document.lineAt(n).range,
      getLineCount: () => this.document.lineCount,
      validateRange: (r: vscode.Range) => this.document.validateRange(r),
    }
    this.model = new PrettyModel(docModel,settings,options);

    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
      if(e.document == this.document)
        this.onChangeDocument(e);
    }));

    this.applyDecorations(this.getEditors(), this.model.getDecorationsList());
  }

  public dispose() {
    this.model.dispose();
    this.subscriptions.forEach((s) => s.dispose());
  }

  private getEditors() {
    return vscode.window.visibleTextEditors
      .filter((editor) => {
        return editor.document.uri === this.document.uri;
      });
  }

  public gotFocus(editor: vscode.TextEditor) {
    this.applyDecorations(this.getEditors(), this.currentDecorations);
  }

  public copyDecorated(editor: vscode.TextEditor) : Promise<void> {
    function doCopy(x: any) {
      return new Promise<void>((resolve, reject) => copyPaste.copy(x, (err) => err ? reject(err) : resolve()));
    }
    const copy = editor.selections.map(sel => this.model.getDecoratedText(sel));
    if(copy.length === 0)
      return Promise.resolve();
    else
      return doCopy(copy.join('\n'))
  }

  private applyDecorationsTimeout = undefined;
  private applyDecorationsTimeoutActive = undefined;
  private applyDecorations(editors: Iterable<vscode.TextEditor>, decs: UpdateDecorationEntry[]) {
    this.currentDecorations = decs;
    // settings many decorations is pretty slow, so only call this at most ~20ms
    if(!this.applyDecorationsTimeoutActive) {
      this.applyDecorationsTimeoutActive = setTimeout(() => {
        try {
          for(const editor of editors) {
            if(editor !== vscode.window.activeTextEditor)
              continue; // handle ONLY the active editr here
            decs.forEach(d => editor.setDecorations(d.decoration, d.ranges));
          }	
          this.applyDecorationsTimeoutActive = undefined;
        } catch(err) {
          console.error(err)
        }
      }, activeEditorDecorationTimeout);
    }
    if(!this.applyDecorationsTimeout) {
      this.applyDecorationsTimeout = setTimeout(() => {
        try {
          for(const editor of editors) {
            if(editor === vscode.window.activeTextEditor)
              continue; // handle this in another timer
            decs.forEach(d => editor.setDecorations(d.decoration, d.ranges));
          }	
          this.applyDecorationsTimeout = undefined;
        } catch(err) {
          console.error(err)
        }
      }, inactiveEditorDecorationTimeout);
    }
  }

  private onChangeDocument(event: vscode.TextDocumentChangeEvent) {
    if(this.model.applyChanges(event.contentChanges))
      this.applyDecorations(this.getEditors(), this.model.getDecorationsList())
  }

  public refresh() {
    this.model.recomputeDecorations();
    this.applyDecorations(this.getEditors(), this.model.getDecorationsList());
  }

  private lastSelections = new Map<vscode.TextEditor, vscode.Selection[]>();
  public adjustCursor(editor: vscode.TextEditor) {
    let updated = false;
    let adjustedSelections : vscode.Selection[] = [];
    let before = this.lastSelections.get(editor);
    if(!before) {
      this.lastSelections.set(editor,editor.selections);
      return;
    }
    const after = editor.selections;
    if(arrayEqual(before,after))
      return;

    after.forEach((sel,idx) => {
      if(before[idx] === undefined) {
        adjustedSelections.push(new vscode.Selection(sel.anchor,sel.active));
        return;
      }
      const adjusted = pos.adjustCursorMovement(before[idx].active,sel.active,this.document,this.model.getPrettySubstitutionsRanges());
      if(!adjusted.pos.isEqual(sel.active)) {
        updated = true;
      }

      // if anchor==active, then adjust both; otherwise just adjust the active position
      if(sel.anchor.isEqual(sel.active))
        adjustedSelections.push(new vscode.Selection(adjusted.pos,adjusted.pos));
      else
        adjustedSelections.push(new vscode.Selection(sel.anchor,adjusted.pos));
    });

    this.lastSelections.set(editor,adjustedSelections);

    // could cause this method to be called again, but since we've set the
    // last-selection to adjustedSelections, we will immediately return. 
    if(updated)
      editor.selections = adjustedSelections;
  }

  public selectionChanged(editor: vscode.TextEditor) {
    const r1 = this.model.revealSelections(editor.selections);
    const r2 = this.model.renderPrettyCursor(editor.selections);
    if(this.adjustCursorMovement)
      this.adjustCursor(editor);

    if(r1)
      editor.setDecorations(r1.decoration, r1.ranges);
    if(r2)
      editor.setDecorations(r2.decoration, r2.ranges);
  }

}