import * as vscode from 'vscode';
import * as copyPaste from 'copy-paste';

import {LanguageEntry, HideTextMethod} from './configuration';
import * as pos from './position';
//import {RangeSet} from './RangeSet';
//import {DisjointRangeSet} from './DisjointRangeSet';
//import * as drangeset from './DisjointRangeSet';
//import * as textUtil from './text-util';
import * as tm from './text-mate';
//import {MatchResult, iterateMatches, iterateMatchArray, mapIterator} from './regexp-iteration';
//import * as decorations from './decorations';
import {PrettyModel, UpdateDecorationEntry, UpdateDecorationInstanceEntry} from './PrettyModel';

//const debugging = false;
const activeEditorDecorationTimeout = 100;
const updateSelectionTimeout = 20;
const inactiveEditorDecorationTimeout = 500;

function arrayEqual<T>(a1: T[], a2: T[], isEqual: (x:T,y:T)=>boolean = ((x,y) => x===y)) : boolean {
  if(a1.length!=a2.length)
    return false;
  for(let idx = 0; idx < a1.length; ++idx) {
    if(!isEqual(a1[idx],a2[idx]))
      return false;
  }
  return true;
}

class DebounceFunction implements vscode.Disposable {
  private timer?: NodeJS.Timer = null;
  private callback?: () => void = null;
  constructor(private timeout: number) {}
  public dispose() {
    if(this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  public call(callback: () => void): void {
    this.callback = callback;
    if (this.timer == null) {
      this.timer = setTimeout(() => {
        this.callback();
        this.callback = null;
        this.timer = null;
      }, this.timeout);
    }
  }
}

export class PrettyDocumentController implements vscode.Disposable {
  private readonly model : PrettyModel;
  private readonly subscriptions : vscode.Disposable[] = [];
  private currentDecorations : UpdateDecorationEntry[] = [];
  private updateActiveEditor = new DebounceFunction(activeEditorDecorationTimeout);
  private updateInactiveEditors = new DebounceFunction(inactiveEditorDecorationTimeout);
  private updateSelection = new DebounceFunction(updateSelectionTimeout);

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

  public gotFocus() {
    this.applyDecorations(this.getEditors(), this.currentDecorations);
  }

  public copyDecorated(editor: vscode.TextEditor) : Promise<void> {
    function doCopy(x: string) {
      return new Promise<void>((resolve, reject) => copyPaste.copy(x, (err) => err ? reject(err) : resolve()));
    }
    const copy = editor.selections.map(sel => this.model.getDecoratedText(sel));
    if(copy.length === 0)
      return Promise.resolve();
    else
      return doCopy(copy.join('\n'))
  }

  private applyActiveEditorDecorations(
    editors: Iterable<vscode.TextEditor>,
    decs: UpdateDecorationEntry[],
    revealRanges?: vscode.Range[],
    prettyCursors?: UpdateDecorationInstanceEntry,
  ): void {
    this.updateActiveEditor.call(() => {
      try {
        for(const editor of editors) {
          const cursors = prettyCursors
            || this.model.renderPrettyCursor(editor.selections);
          // Which ranges should *not* be prettified?
          const reveal = revealRanges
            || this.model.revealSelections(editor.selections).ranges
          decs.forEach(d => editor.setDecorations(
            d.decoration,
            // d.ranges.map(r => {range: r})
            d.ranges
              // Decorate only those not revealed
              .filter(r => reveal.every(s => s.intersection(r) === undefined))
              // Show cursors
              .map(r => ({
                range: r,
                renderOptions: cursors && cursors.ranges.isOverlapping(r)
                  ? cursors.decoration
                  : undefined
              }))
          ));
        }
      } catch(err) {
        console.error(err)
      }
    });
  }

  private applyInactiveEditorDecorations(
    editors: Iterable<vscode.TextEditor>,
    decs: UpdateDecorationEntry[],
  ): void {
    this.updateInactiveEditors.call(() => {
      try {
        for(const editor of editors) {
          if(editor === vscode.window.activeTextEditor)
            continue;
          decs.forEach(d => editor.setDecorations(d.decoration, d.ranges));
        }	
      } catch(err) {
        console.error(err)
      }
    });
  }

  private applyDecorations(editors: Iterable<vscode.TextEditor>, decs: UpdateDecorationEntry[]) {
    this.currentDecorations = decs;
    this.applyActiveEditorDecorations([vscode.window.activeTextEditor], decs);
    this.applyInactiveEditorDecorations(editors, decs);
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
  public adjustCursor(editor: vscode.TextEditor): null|vscode.Selection[] {
    let updated = false;
    const adjustedSelections : vscode.Selection[] = [];
    const before = this.lastSelections.get(editor);
    if(!before) {
      this.lastSelections.set(editor,editor.selections);
      return editor.selections;
    }
    const after = editor.selections;
    if(arrayEqual(before,after))
      return null;

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

    return adjustedSelections;
  }

  // Cache of revealed ranges (to prevent unnecessary updates)
  private revealedRanges: vscode.Range[] = [];
  private cursorRanges: vscode.Range[] = [];
  /**
   * The cursor has moved / the selection has changed. Reveal the original text,
   * box symbols, tec. as needed.
   * @param editor 
   */
  public selectionChanged(editor: vscode.TextEditor) {
    this.updateSelection.call(() => {
      let selections: null|vscode.Selection[];
      if(this.adjustCursorMovement) {
        selections = this.adjustCursor(editor);
      } else {
        selections = editor.selections;
      }
      if(selections == null) {
        return;
      }

      const cursors = this.model.renderPrettyCursor(selections);
      const cR = cursors == null ? [] : cursors.ranges.getRanges();
      const revealed = this.model.revealSelections(selections);
      if (!arrayEqual(revealed.ranges, this.revealedRanges)
      || !arrayEqual(cR, this.cursorRanges)) {
        this.applyActiveEditorDecorations(
          [editor],
          this.model.getDecorationsList(),
          revealed.ranges,
          cursors,
        );
      }
      this.revealedRanges = revealed.ranges;
      this.cursorRanges = cR;
    })

    // const r1 = this.model.revealSelections(editor.selections);
    // const r2 = this.model.renderPrettyCursor(editor.selections);
    // if(this.adjustCursorMovement)
    //   this.adjustCursor(editor);

    // if(r1) {
    //   editor.setDecorations(r1.decoration, r1.ranges);
    // }
    // if(r2)
    //   editor.setDecorations(r2.decoration, r2.ranges);
  }

}