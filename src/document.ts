import * as vscode from 'vscode';
import {Substitution} from './configuration';
import * as pos from './position';


interface PrettySubstitution {
	ugly: RegExp,
	pretty: string,
	preDecorationType: vscode.TextEditorDecorationType,
	postDecorationType: vscode.TextEditorDecorationType,
	// prettyCursorPreDecorationType: vscode.TextEditorDecorationType,
	// prettyCursorPostDecorationType: vscode.TextEditorDecorationType,
	preRanges: vscode.Range[],
	postRanges: vscode.Range[],
}


export class PrettyDocumentController implements vscode.Disposable {
  private document: vscode.TextDocument;
  private prettyDecorations : PrettySubstitution[] = [];
  private prettySubstitutions : Substitution[] = [];  
  private uglyAll = new RegExp("","g");
  private uglyDecorationRanges: vscode.Range[] = [];
  private subscriptions : vscode.Disposable[] = [];

  private uglyDecoration: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
		color: "transparent; font-size: 0.5pt", // for some reason, the cursor dissappears if the font is too small or display:none
  });

  constructor(doc: vscode.TextDocument, prettySubstitutions: Substitution[]) {
    this.document = doc;
    this.prettySubstitutions = prettySubstitutions;
    this.loadDecorations();

    // Parse whole document
    const docRange = new vscode.Range(0,0,this.document.lineCount,0);
    this.parsePretty(docRange);
    this.applyDecorations(this.getEditors());

    this.subscriptions.push(this.uglyDecoration);
    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
      if(e.document == this.document)
        this.onChangeDocument(e);
    }));
  }

  public dispose() {
    this.unloadDecorations();
    this.subscriptions.forEach((s) => s.dispose());
  }

  private getEditors() {
    return vscode.window.visibleTextEditors
      .filter((editor) => {
        return editor.document == this.document;
      });
  }

  private unloadDecorations() {
    this.uglyDecorationRanges = [];
    for(const subst of this.prettyDecorations) {
      subst.preRanges = [];
      subst.postRanges = [];
    }
    this.applyDecorations(vscode.window.visibleTextEditors.filter((editor) => editor.document == this.document));

    for(const oldDecoration of this.prettyDecorations) {
      oldDecoration.preDecorationType.dispose();
      oldDecoration.postDecorationType.dispose();
    }	
  }

  private loadDecorations() {
    this.unloadDecorations();
    this.prettyDecorations = [];
    const uglyAllStrings = [];
    for(const prettySubst of this.prettySubstitutions) {
      const uglyStr = (prettySubst.pre || "") + "(" + prettySubst.ugly + ")" + (prettySubst.post || "");
      try {
        this.prettyDecorations.push({
          ugly: new RegExp(uglyStr,"g"),
          pretty: prettySubst.pretty,
          preRanges: [],
          postRanges: [],
          preDecorationType: vscode.window.createTextEditorDecorationType({
            after: {
              contentText: prettySubst.pretty,
            },
          }),
          postDecorationType: vscode.window.createTextEditorDecorationType({
            before: {
              contentText: prettySubst.pretty,
            },
          }),
        });
        uglyAllStrings.push(`(?:${uglyStr})`);
      } catch(e) {
        console.warn(`Could not add rule "${uglyStr}" --> "${prettySubst.pretty}"; invalid regular expression`)
      }
    }
    this.uglyAll = new RegExp(uglyAllStrings.join('|'), 'g');
  }

  private applyDecorations(editors: Iterable<vscode.TextEditor>) {
    for(const editor of editors) {
      editor.setDecorations(this.uglyDecoration,this.uglyDecorationRanges);
      for(const subst of this.prettyDecorations) {
        editor.setDecorations(subst.preDecorationType,subst.preRanges);
        editor.setDecorations(subst.postDecorationType,subst.postRanges);
      }
    }	
  }

  private parsePretty(range: vscode.Range) {
    if(this.prettyDecorations.length == 0)
      return;
    range = this.document.validateRange(range);

    for(let idx = range.start.line; idx <= range.end.line; ++idx) {
      const line = this.document.lineAt(idx);

      let match : RegExpExecArray;
      this.uglyAll.lastIndex = 0;
      while(match = this.uglyAll.exec(line.text)) {
        try {
          const matches = match
            .map((value,idx) => ({index:idx,match:value}))
            .filter((value) => value.match !== undefined);
          if(matches.length <= 1)
            break;
          const matchIdx = matches[matches.length-1].index;
          const matchStr = match[matchIdx];
          const start = match.index + match[0].indexOf(matchStr);
          const end = start + matchStr.length;

          // if(start == 0 && end >= line.text.length)
          // 	continue; // do not attempt to prettify a symbol if it is the only thing on a line because vscode cannot display it
          // Cannot seem to figure out how to display two pretty notations right next to each other,
          // but we want to continue the search as close to the end of the symbol as possible
          // so: we choose `end` as the last index, but add 1 if possible to make sure it is at least a character away
          this.uglyAll.lastIndex = Math.min(this.uglyAll.lastIndex,end+1);

          const subst = this.prettyDecorations[matchIdx-1];
          this.uglyDecorationRanges.push(new vscode.Range(line.range.start.line,start,line.range.end.line,end));
          if (end < line.text.length)
            subst.postRanges.push(new vscode.Range(line.range.end.line,end,line.range.end.line,end));
          else
            subst.preRanges.push(new vscode.Range(line.range.start.line,start-1,line.range.start.line,start));
        } catch(e) {}
      }
    }
  }

  private onChangeDocument(event: vscode.TextDocumentChangeEvent) {
    this.refresh();
  }

  /// reparses the document and recreates the highlights for all editors  
  public refresh() {
    this.uglyDecorationRanges = [];
    for(const subst of this.prettyDecorations) {
      subst.preRanges = [];
      subst.postRanges = [];
    }
    this.applyDecorations(vscode.window.visibleTextEditors.filter((editor) => editor.document == this.document));

    const docRange = new vscode.Range(0,0,this.document.lineCount,0);
    this.parsePretty(docRange);

    this.applyDecorations(this.getEditors()); 
  }

  public cursorLeft(editor: vscode.TextEditor) {
    const adjustment = pos.adjustCaretLeft(editor.selection.active, this.uglyDecorationRanges, editor.document); 
    editor.selection = new vscode.Selection(adjustment.pos,adjustment.pos);
  }

  public cursorRight(editor: vscode.TextEditor) {
    const adjustment = pos.adjustCaretRight(editor.selection.active, this.uglyDecorationRanges, editor.document); 
    editor.selection = new vscode.Selection(adjustment.pos,adjustment.pos);
  }

  public cursorDown(editor: vscode.TextEditor) {
    const adjustment = pos.adjustCaret(editor.selection.active, editor.document, this.uglyDecorationRanges, 'down'); 
    editor.selection = new vscode.Selection(adjustment.pos,adjustment.pos);
  }

  public cursorUp(editor: vscode.TextEditor) {
    const adjustment = pos.adjustCaret(editor.selection.active, editor.document, this.uglyDecorationRanges, 'up'); 
    editor.selection = new vscode.Selection(adjustment.pos,adjustment.pos);
  }
  
}