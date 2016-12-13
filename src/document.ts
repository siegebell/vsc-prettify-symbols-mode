import * as vscode from 'vscode';
import {Substitution, UglyRevelation, LanguageEntry, PrettyCursor, PrettyStyleProperties, PrettyStyle, assignStyleProperties, HideTextMethod} from './configuration';
import * as pos from './position';
import {RangeSet} from './RangeSet';
import {DisjointRangeSet} from './DisjointRangeSet';
import * as drangeset from './DisjointRangeSet';
import * as textUtil from './text-util';
import * as tm from './text-mate';

const debugging = false;
const activeEditorDecorationTimeout = 20;
const inactiveEditorDecorationTimeout = 200;

interface PrettySubstitution {
	ugly: RegExp,
	pretty: string,
	decorationType: vscode.TextEditorDecorationType,
	ranges: DisjointRangeSet,
  index: number,
  scope?: string,
}


function arrayEqual<T>(a1: T[], a2: T[], isEqual: (x:T,y:T)=>boolean = ((x,y) => x==y)) : boolean {
  if(a1.length!=a2.length)
    return false;
  for(let idx = 0; idx < a1.length; ++idx) {
    if(!isEqual(a1[idx],a2[idx]))
      return false;
  }
  return true;
}

function makePrettyDecoration_fontSize_hack(prettySubst: Substitution) {
  const showAttachmentStyling = '; font-size: 1000em';

  let styling : vscode.DecorationRenderOptions = { before: {}, dark: {before: {}}, light: {before: {}} };
  if(prettySubst.style) {
    assignStyleProperties(styling.before, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark.before, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light.before, prettySubst.style.light);
  }
  styling.before.contentText = prettySubst.pretty;

  // Use a dirty hack to change the font size (code injection)
  styling.before.textDecoration = (styling.before.textDecoration || 'none') + showAttachmentStyling;
  // and make sure the user's textDecoration does not break our hack
  if(styling.light.before.textDecoration)
    styling.light.before.textDecoration = styling.light.before.textDecoration + showAttachmentStyling;
  if(styling.dark.before.textDecoration)
    styling.dark.before.textDecoration = styling.dark.before.textDecoration + showAttachmentStyling;

  return vscode.window.createTextEditorDecorationType(styling);
}

function makePrettyDecoration_letterSpacing_hack(prettySubst: Substitution) {
  const showAttachmentStyling = '; font-size: 10em; letter-spacing: normal; visibility: visible';

  let styling : vscode.DecorationRenderOptions = { after: {}, dark: {after: {}}, light: {after: {}} };
  if(prettySubst.style) {
    assignStyleProperties(styling.after, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark.after, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light.after, prettySubst.style.light);
  }
  styling.after.contentText = prettySubst.pretty;

  // Use a dirty hack to change the font size (code injection)
  styling.after.textDecoration = (styling.after.textDecoration || 'none') + showAttachmentStyling;
  // and make sure the user's textDecoration does not break our hack
  if(styling.light.after.textDecoration)
    styling.light.after.textDecoration = styling.light.after.textDecoration + showAttachmentStyling;
  if(styling.dark.after.textDecoration)
    styling.dark.after.textDecoration = styling.dark.after.textDecoration + showAttachmentStyling;

  return vscode.window.createTextEditorDecorationType(styling);
}

function makePrettyDecoration_noPretty(prettySubst: Substitution) {
  const showAttachmentStyling = '';

  let styling : vscode.DecorationRenderOptions = { dark: {}, light: {} };
  if(prettySubst.style) {
    assignStyleProperties(styling, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light, prettySubst.style.light);
  }

  return vscode.window.createTextEditorDecorationType(styling);
}

function makePrettyDecoration_noHide(prettySubst: Substitution) {
  const showAttachmentStyling = '';

  let styling : vscode.DecorationRenderOptions = { after: {}, dark: {after: {}}, light: {after: {}} };
  if(prettySubst.style) {
    assignStyleProperties(styling.after, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark.after, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light.after, prettySubst.style.light);
  }
  styling.after.contentText = prettySubst.pretty;

  // Use a dirty hack to change the font size (code injection)
  styling.after.textDecoration = (styling.after.textDecoration || 'none') + showAttachmentStyling;
  // and make sure the user's textDecoration does not break our hack
  if(styling.light.after.textDecoration)
    styling.light.after.textDecoration = styling.light.after.textDecoration + showAttachmentStyling;
  if(styling.dark.after.textDecoration)
    styling.dark.after.textDecoration = styling.dark.after.textDecoration + showAttachmentStyling;

  return vscode.window.createTextEditorDecorationType(styling);
}

interface MatchResult {
  start: number,
  end: number,
  matchStart: number,
  matchEnd: number,
  id: number,
}

/**
 * Iterates through each match-group that occurs in the `str`; note that the offset within the given string increments according with the length of the matched group, effectively treating any other portion of the matched expression as a "pre" or "post" match that do not contribute toward advancing through the string.
 * The iterator's `next' method accepts a new offset to jump to within the string.
 */
function *iterateMatches(str: string, re: RegExp, start?: number) : IterableIterator<MatchResult> {
  re.lastIndex = start===undefined ? 0 : start;
  let match : RegExpExecArray;
  while(match = re.exec(str)) {
    if(match.length <= 1)
      return;
    const validMatches = match
      .map((value,idx) => ({index:idx,match:value}))
      .filter((value) => value.match !== undefined);
    if(validMatches.length > 1) {
      const matchIdx = validMatches[validMatches.length-1].index;
      const matchStr = match[matchIdx];
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      const start = matchStart + match[0].indexOf(matchStr);
      const end = start + matchStr.length;

      const newOffset = yield {start: start, end: end, matchStart: matchStart, matchEnd: matchEnd, id: matchIdx-1};
      if(typeof newOffset === 'number')
        re.lastIndex = Math.max(0,Math.min(str.length,newOffset));
      else
        re.lastIndex = end;
    }
  }
}

function *iterateMatchArray(str: string, res: RegExp[], start?: number) : IterableIterator<MatchResult> {
  start = start===undefined ? 0 : start;
  res.forEach(re => re.lastIndex = start);
  let matches = res.map(re => re.exec(str));
  let matchIdx = matches.findIndex(m => m && m.length > 1);
  while(matchIdx >= 0) {
    const match = matches[matchIdx];
    const matchStr = match[1];
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const start = matchStart + match[0].indexOf(matchStr);
    const end = start + matchStr.length;

    const newOffset = yield {start: start, end: end, matchStart: matchStart, matchEnd: matchEnd, id: matchIdx};
    if(typeof newOffset === 'number') {
      const next =  Math.max(0,Math.min(str.length,newOffset));
      res.forEach(re => re.lastIndex = next)
    } else
      res.forEach(re => re.lastIndex = end)
    matches = res.map(re => re.exec(str));
    matchIdx = matches.findIndex(m => m!==undefined && matches.length > 1);
  }
}

function *mapIterator<T1,T2>(iter: IterableIterator<T1>, f: (x:T1)=>T2, current?: IteratorResult<T1>) : IterableIterator<T2> {
  if(!current)
    current = iter.next();
  while(!current.done) {
    current = iter.next(yield f(current.value));
  }
}



export class PrettyDocumentController implements vscode.Disposable {
  private prettyDecorations : {scoped: PrettySubstitution[], unscoped: PrettySubstitution[]} = {scoped: [], unscoped: []};
  /** matches all of the target substitutions that ignore grammar scopes */
  private uglyUnscoped = new RegExp("","g");
  /** condictional ranges: tracks ranges where any edit within the range should cause the entire range to be reparsed */
  private conditionalRanges = new RangeSet();
  /** ranges of hidden text */
  private uglyDecorationRanges = new DisjointRangeSet();
  // /** ranges of non-hidden, styled text */
  // private styledDecorationRanges = new DisjointRangeSet();
  /** things to dispose of at the end */
  private subscriptions : vscode.Disposable[] = [];
  private changedUglies = false; // flag used to determine if the uglies have been updated

  // hides a "ugly" decorations
  private uglyDecoration: vscode.TextEditorDecorationType = null;
  // reveals the "ugly" decorations; is applied on top of uglyDecoration and should take priority
  private revealedUglyDecoration: vscode.TextEditorDecorationType = null;
  // draws a box around a pretty symbol
  private boxedSymbolDecoration: vscode.TextEditorDecorationType = null;

  // Stores the state for each line
  private grammarState : tm.StackElement[] = [];
  private grammar : null|tm.IGrammar = null;

  public constructor(doc: vscode.TextDocument, settings: LanguageEntry, options: {hideTextMethod: HideTextMethod, textMateGrammar?: tm.IGrammar|null},
    private document = doc,
    // private prettySubstitutions = settings.substitutions,  
    private revealStrategy = settings.revealOn,
    private adjustCursorMovement = settings.adjustCursorMovement,
    private prettyCursor = settings.prettyCursor,
    private hideTextMethod = options.hideTextMethod
  ) {
    this.grammar = options.textMateGrammar || null; 
    this.loadDecorations(settings.substitutions);

    this.subscriptions.push(vscode.languages.registerHoverProvider(doc.languageId, {provideHover: (d,pos,tok) : vscode.Hover => {
      if(d.uri.toString() !== doc.uri.toString())
        return undefined;
      const state = this.grammarState[pos.line-1];
      if(!state)
        return;
      const line = doc.lineAt(pos.line);
      const tokens = this.grammar.tokenizeLine(line.text, state);
      for(let t of tokens.tokens) {
        if(t.startIndex <= pos.character && pos.character < t.endIndex)
          return {contents: [t.scopes.join(' ')], range: new vscode.Range(pos.line,t.startIndex,pos.line,t.endIndex)}
      }
      return undefined;
    }}));
    
    // Parse whole document
    const docRange = new vscode.Range(0,0,this.document.lineCount,0);
    this.reparsePretties(docRange);
    this.applyDecorations(this.getEditors());

    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
      if(e.document == this.document)
        this.onChangeDocument(e);
    }));
  }

  public dispose() {
    this.unloadDecorations();
    this.debugDecorations.forEach((val) => val.dec.dispose());
    this.subscriptions.forEach((s) => s.dispose());
  }

  private getEditors() {
    return vscode.window.visibleTextEditors
      .filter((editor) => {
        return editor.document == this.document;
      });
  }

  private unloadDecorations() {
    if(this.uglyDecoration)
      this.uglyDecoration.dispose();
    if(this.revealedUglyDecoration)
      this.revealedUglyDecoration.dispose();
    if(this.boxedSymbolDecoration)
      this.boxedSymbolDecoration.dispose();

    this.conditionalRanges = new RangeSet();
    this.uglyDecorationRanges = new DisjointRangeSet();
    // this.styledDecorationRanges = new DisjointRangeSet();
    for(const subst of this.prettyDecorations.unscoped)
      subst.ranges = new DisjointRangeSet();
    for(const subst of this.prettyDecorations.scoped)
      subst.ranges = new DisjointRangeSet();
    this.debugDecorations.forEach((val) => val.ranges = []);

    this.applyDecorations(this.getEditors());

    for(const oldDecoration of this.prettyDecorations.unscoped)
      oldDecoration.decorationType.dispose();
    for(const oldDecoration of this.prettyDecorations.scoped)
      oldDecoration.decorationType.dispose();
  }

  private regexpOptionalGroup(re: string) {
    if(re)
      return `(?:${re})`;
    else
      return "";
  }

  private loadDecorations(prettySubstitutions: Substitution[]) {
    this.unloadDecorations();

    if(this.hideTextMethod === "hack-fontSize") {
      this.uglyDecoration = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; font-size: 0.001em',
      });
      this.revealedUglyDecoration = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; font-size: inherit !important',
        before: {
          textDecoration: 'none; font-size: 0pt',
        }
      });
      this.boxedSymbolDecoration = vscode.window.createTextEditorDecorationType({
        before: {
          border: '0.1em solid',
          margin: '-0em -0.05em -0em -0.1em',
        }
      });
    } else if(this.hideTextMethod === "hack-letterSpacing") {
      this.uglyDecoration = vscode.window.createTextEditorDecorationType({
        letterSpacing: "-0.55em; font-size: 0.1em; visibility: hidden",
      });
      this.revealedUglyDecoration = vscode.window.createTextEditorDecorationType({
        letterSpacing: "normal !important; font-size: inherit !important; visibility: visible !important",
        after: {
          textDecoration: 'none; font-size: 0pt; display: none',
        }
      });
      this.boxedSymbolDecoration = vscode.window.createTextEditorDecorationType({
        after: {
          border: '0.1em solid',
          margin: '-0em -0.05em -0em -0.1em',
        }
      });
    } else {
      this.uglyDecoration = vscode.window.createTextEditorDecorationType({ });
      this.revealedUglyDecoration = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; font-size: inherit !important',
        after: {
          textDecoration: 'none; font-size: 0pt',
        }
      });
      this.boxedSymbolDecoration = vscode.window.createTextEditorDecorationType({
        after: {
          border: '0.1em solid',
          margin: '-0em -0.05em -0em -0.1em',
        }
      });
    }

    this.prettyDecorations.scoped = [];
    this.prettyDecorations.unscoped = [];
    const uglyAllUnscopedStrings = [];
    for(const prettySubst of prettySubstitutions) {
      const uglyStr = this.regexpOptionalGroup(prettySubst.pre) + "(" + prettySubst.ugly + ")" + this.regexpOptionalGroup(prettySubst.post);
      try {
        const re = new RegExp(uglyStr, "g");
        if(re.test("")) {
          console.warn(`Substitution ignored because it matches the empty string: "${uglyStr}" --> "${prettySubst.pretty}"`);
          continue;
        }

        let decoration = undefined;
        if(!prettySubst.pretty)
          decoration = makePrettyDecoration_noPretty(prettySubst);
        else if(this.hideTextMethod === "hack-fontSize")
          decoration = makePrettyDecoration_fontSize_hack(prettySubst);
        else if(this.hideTextMethod === "hack-letterSpacing")
          decoration = makePrettyDecoration_letterSpacing_hack(prettySubst);
        else
          decoration = makePrettyDecoration_noHide(prettySubst);

        if(prettySubst.scope) {
          this.prettyDecorations.scoped.push({
            ugly: re,
            pretty: prettySubst.pretty,
            ranges: new DisjointRangeSet(),
            decorationType: decoration,
            index: this.prettyDecorations.scoped.length,
            scope: prettySubst.scope,
          });
        } else {
          this.prettyDecorations.unscoped.push({
            ugly: re,
            pretty: prettySubst.pretty,
            ranges: new DisjointRangeSet(),
            decorationType: decoration,
            index: this.prettyDecorations.scoped.length,
          });
          uglyAllUnscopedStrings.push(`(?:${uglyStr})`);
        }

      } catch(e) {
        console.warn(`Could not add rule "${uglyStr}" --> "${prettySubst.pretty}"; invalid regular expression`)
      }
    }
    this.uglyUnscoped = new RegExp(uglyAllUnscopedStrings.join('|'), 'g');
  }

  private applyDecorationsTimeout = undefined;
  private applyDecorationsTimeoutActive = undefined;
  private applyDecorations(editors: Iterable<vscode.TextEditor>) {
    // settings many decorations is pretty slow, so only call this at most ~20ms
    if(!this.applyDecorationsTimeoutActive) {
      this.applyDecorationsTimeoutActive = setTimeout(() => {
        try {
          for(const editor of editors) {
            if(editor !== vscode.window.activeTextEditor)
              break; // handle ONLY the active editr here
            editor.setDecorations(this.uglyDecoration,this.uglyDecorationRanges.getRanges());
            for(const subst of this.prettyDecorations.unscoped)
              editor.setDecorations(subst.decorationType,subst.ranges.getRanges());
            for(const subst of this.prettyDecorations.scoped)
              editor.setDecorations(subst.decorationType,subst.ranges.getRanges());
            if(debugging)
              this.debugDecorations.forEach((val) => editor.setDecorations(val.dec,val.ranges));
          }	
          this.applyDecorationsTimeoutActive = undefined;
        } catch(err) {
          console.error(err)
          console.error('\n')
        }
      }, activeEditorDecorationTimeout);
    }
    if(!this.applyDecorationsTimeout) {
      this.applyDecorationsTimeout = setTimeout(() => {
        try {
          for(const editor of editors) {
            if(editor === vscode.window.activeTextEditor)
              break; // handle this in another timer
            editor.setDecorations(this.uglyDecoration,this.uglyDecorationRanges.getRanges());
            for(const subst of this.prettyDecorations.unscoped)
              editor.setDecorations(subst.decorationType,subst.ranges.getRanges());
            for(const subst of this.prettyDecorations.scoped)
              editor.setDecorations(subst.decorationType,subst.ranges.getRanges());
            if(debugging)
              this.debugDecorations.forEach((val) => editor.setDecorations(val.dec,val.ranges));
          }	
          this.applyDecorationsTimeout = undefined;
        } catch(err) {
          console.error(err)
          console.error('\n')
        }
      }, inactiveEditorDecorationTimeout);
    }
  }

  // helper function to determine which ugly has been matched
  private getUglyFromMatch(match: RegExpExecArray, line: number) {
    const matches = match
      .map((value,idx) => ({index:idx,match:value}))
      .filter((value) => value.match !== undefined);
    if(matches.length <= 1)
      return undefined;
    const matchIdx = matches[matches.length-1].index;
    const matchStr = match[matchIdx];
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const start = matchStart + match[0].indexOf(matchStr);
    const end = start + matchStr.length;
    const uglyRange = new vscode.Range(line,start,line,end);

    return {range: uglyRange, prettyIndex: matchIdx-1, lastIndex: end};
  }

//   /**
//    * Clears & shifts:
//    *   this.prettyDecorations.scoped[x].ranges -- removes intersecting ranges for each prety x
//    *   this.prettyDecorations.unscoped[x].ranges -- removes intersecting ranges for each pretty x
//    *   this.uglyDecorationRanges -- removes intersecting ranges
//    * @returns the range of affected text after the edit
//  */
//   private adjustByEditPretties(range: vscode.Range, delta: drangeset.RangeDelta) : vscode.Range {
//     // editRange equivalent to range, but adjusted for the edited text
//     const editRange = drangeset.rangeDeltaNewRange(delta);

//     const reparseRanges = this.conditionalRanges.removeOverlapping(range,{includeTouchingStart:true,includeTouchingEnd:true});
//     const reparseRange = reparseRanges.length > 0
//       ? new vscode.Range(reparseRanges[0].start, reparseRanges[reparseRanges.length-1].end)
//       : new vscode.Range(0,0,0,0);
//     const adjustedReparseRange = drangeset.rangeTranslate(reparseRange, delta);

//     const removed  = this.uglyDecorationRanges.removeOverlapping(reparseRange,{includeTouchingStart:true,includeTouchingEnd:true});
//     const affected = this.uglyDecorationRanges.shiftRangeDelta(delta);
//     if(removed.length > 0)
//       this.changedUglies = true;

//     for(const subst of this.prettyDecorations.unscoped) {
//       subst.ranges.removeOverlapping(reparseRange,{includeTouchingStart:true,includeTouchingEnd:true});
//       subst.ranges.shiftRangeDelta(delta);
//     }
//     for(const subst of this.prettyDecorations.scoped) {
//       subst.ranges.removeOverlapping(reparseRange,{includeTouchingStart:true,includeTouchingEnd:true});

//       subst.ranges.shiftRangeDelta(delta);
//     }
//     return affected.union(reparseRange);
//   }

  private refreshTokensOnLine(line: vscode.TextLine) : {tokens: tm.IToken[], invalidated: boolean} {
    const prevState = this.grammarState[line.lineNumber-1] || null;
    const lineTokens = this.grammar.tokenizeLine(line.text, prevState);
    const invalidated = !this.grammarState[line.lineNumber] || !lineTokens.ruleStack.equals(this.grammarState[line.lineNumber])
    this.grammarState[line.lineNumber] = lineTokens.ruleStack;
    return {tokens: lineTokens.tokens, invalidated: invalidated};
  }

  /** Iterates over all the uglies that match within a scoped token
   * @returns an iterator; `next` accepts a new offset within the string to jump to
   */
  private *iterateScopedUglies(line: string, tokens: tm.IToken[]) : IterableIterator<MatchResult> {
    let jumpOffset : number|undefined = undefined;
    nextToken:
    for(let tokenIdx = 0; tokenIdx < tokens.length; ++tokenIdx) {
      const token = tokens[tokenIdx];
      if(token.startIndex < jumpOffset || token.endIndex===token.startIndex)
        continue nextToken; // advance to the next offset we're interested in
      const tokenStr = line.substring(token.startIndex,token.endIndex);
      let matchScopes = this.prettyDecorations.scoped
        .filter(s => tm.matchScope(s.scope, token.scopes));
      let matchIter = iterateMatchArray(tokenStr, matchScopes.map(ms => ms.ugly))
      let match = matchIter.next();
      for(; !match.done; match = matchIter.next(jumpOffset!==undefined ? jumpOffset - token.startIndex : undefined)) {
        const newOffset = yield {
          start: token.startIndex + match.value.start,
          end: token.startIndex + match.value.end,
          matchStart: token.startIndex,
          matchEnd: token.endIndex,
          id: matchScopes[match.value.id].index};
        if(typeof newOffset === 'number') {
          jumpOffset = newOffset;
          if(newOffset < token.startIndex) // start over and search for the correct token
            tokenIdx = -1;
        }
      }
    }
  }

  private *iterateUnscopedUglies(line: string) : IterableIterator<MatchResult> {
    yield *iterateMatches(line, this.uglyUnscoped);
    // yield *mapIterator(iterateMatches(line, this.uglyUnscoped), x => ({start: x.start, end: x.end, unscopedId: x.id}));
  }

  private *iterateLineUglies(line: vscode.TextLine, tokens: tm.IToken[]) : IterableIterator<MatchResult & {type: "scoped"|"unscoped"}> {
    type T = "scoped" | "unscoped";
    let offset = 0;
    const scopedUgliesIter = this.iterateScopedUglies(line.text, tokens);
    const unscopedUgliesIter = this.iterateUnscopedUglies(line.text);
    let matchScoped = scopedUgliesIter.next();
    let matchUnscoped = unscopedUgliesIter.next();
    while(!matchScoped.done && !matchUnscoped.done) {
      const s = matchScoped.value;
      const u = matchUnscoped.value;
      if(s.end <= u.start) {// process scoped; sctrictly first
        yield Object.assign(s, {type: "scoped" as T});
        matchScoped = scopedUgliesIter.next();
      } else if(u.end <= s.start) {// process unscoped; strictly first
        yield Object.assign(u, {type: "unscoped" as T});
        matchUnscoped = unscopedUgliesIter.next();
      } else {// overlap: consume the scoped ugly and discard the unscoped ugly
        yield Object.assign(s, {type: "scoped" as T});
        matchScoped = scopedUgliesIter.next();
        matchUnscoped = unscopedUgliesIter.next(s.end /* discard current match and start looking after the scoped match */);
      }
    }
    if(!matchScoped.done)
      yield *mapIterator(scopedUgliesIter, (x) => Object.assign(x, {type: "scoped" as T}), matchScoped)
    else if(!matchUnscoped.done)
      yield *mapIterator(unscopedUgliesIter, (x) => Object.assign(x, {type: "unscoped" as T}), matchUnscoped)
  }

  /** Reparses the given range; assumes that the range has already been cleared by `clearPretties`
   * Updates:
   *   this.prettyDecorations.scoped[x].ranges -- adds new ranges for each pretty x encountered
   *   this.prettyDecorations.unscoped[x].ranges -- adds new ranges for each pretty x encountered
   *   this.uglyDecorationRanges -- all new uglies [to be hidden] are added 
   * @returns the range that was acutally reparsed
   */
  private reparsePretties(range: vscode.Range) : vscode.Range {  
    range = this.document.validateRange(range);

    const startCharacter = 0;

    const newUglyRanges = new DisjointRangeSet();
    const newStyledRanges = new DisjointRangeSet();
    const newScopedRanges : DisjointRangeSet[] = [];
    const newUnscopedRanges : DisjointRangeSet[] = [];
    const newConditionalRanges = new RangeSet();
    // initialize an empty range set for every id
    this.prettyDecorations.unscoped.forEach(() => newUnscopedRanges.push(new DisjointRangeSet()));
    this.prettyDecorations.scoped.forEach(() => newScopedRanges.push(new DisjointRangeSet()));

    let invalidatedTokenState = false;

    // Collect new pretties
    const lineCount = this.document.lineCount;
    let lineIdx;
    for(lineIdx = range.start.line; lineIdx <= range.end.line || (invalidatedTokenState && lineIdx < lineCount); ++lineIdx) {
      const line = this.document.lineAt(lineIdx);
      const {tokens: tokens, invalidated: invalidated} = this.refreshTokensOnLine(line);
      invalidatedTokenState = invalidated;

      for(let ugly of this.iterateLineUglies(line, tokens)) {
        const uglyRange = new vscode.Range(lineIdx, ugly.start, lineIdx, ugly.end);
        newConditionalRanges.add(new vscode.Range(lineIdx, ugly.matchStart, lineIdx, ugly.matchEnd));
        if(ugly.type === "scoped") {
          if(this.prettyDecorations.scoped[ugly.id].pretty)
            newUglyRanges.insert(uglyRange);
          else
            newStyledRanges.insert(uglyRange);
          newScopedRanges[ugly.id].insert(uglyRange);        
        } else if(ugly.type === "unscoped") {
          if(this.prettyDecorations.unscoped[ugly.id].pretty)
            newUglyRanges.insert(uglyRange);
          else
            newStyledRanges.insert(uglyRange);
          newUnscopedRanges[ugly.id].insert(uglyRange);        
        }
      }
    }
    if(lineIdx-1 > range.end.line) {
      console.log('aditional tokens reparsed: ' + (lineIdx-range.end.line) + ' lines');
      range = range.with({end: range.end.with({line: lineIdx, character: 0})});
    }

    // compute the total reparsed range
    // use this to clear any preexisting substitutions
    const newUglyTotalRange = newUglyRanges.getTotalRange();
    const newStyledTotalRange = newStyledRanges.getTotalRange();
    let hiddenOverlap = range.with({start:range.start.with({character: startCharacter})});
    let styledOverlap = range.with({start:range.start.with({character: startCharacter})});
    if(!newUglyTotalRange.isEmpty)
      hiddenOverlap = hiddenOverlap.union(newUglyRanges.getTotalRange());
    if(!newStyledTotalRange.isEmpty)
      styledOverlap =styledOverlap.union(newStyledRanges.getTotalRange());
    const overlap = hiddenOverlap.union(styledOverlap);

    this.conditionalRanges.removeOverlapping(overlap, {includeTouchingStart: false, includeTouchingEnd: false});
    this.uglyDecorationRanges.removeOverlapping(hiddenOverlap);
    // this.styledDecorationRanges.removeOverlapping(styledOverlap);
    this.prettyDecorations.unscoped.forEach(r => r.ranges.removeOverlapping(overlap));
    this.prettyDecorations.scoped.forEach(r => r.ranges.removeOverlapping(overlap));

    // add the new pretties & ugly ducklings
    newConditionalRanges.getRanges().forEach(r => this.conditionalRanges.add(r));
    this.uglyDecorationRanges.insertRanges(newUglyRanges);
    this.prettyDecorations.unscoped.forEach((pretty,idx) => pretty.ranges.insertRanges(newUnscopedRanges[idx]));
    this.prettyDecorations.scoped.forEach((pretty,idx) => {
      pretty.ranges.insertRanges(newScopedRanges[idx])
    });

    if(!newStyledRanges.isEmpty() || !newUglyRanges.isEmpty())
      this.changedUglies = true;
    return hiddenOverlap.union(styledOverlap);
  }


//   /**
//    * Assumes that all decorations overlapping the range have been removed
//    * However, parsing may continue to the end of the line of range.end,
//    * so more pre-existing ranges may be removed from uglyDecorationRanges
//    * returns the range of reparsed text
//    */
//   private parsePrettyUnscoped(range: vscode.Range) : {newStyledRanges: DisjointRangeSet, newUglyRanges: DisjointRangeSet, newPrettyRanges: DisjointRangeSet[], startCharacter: number} {
//     if(this.prettyDecorations.unscoped.length == 0)
//       return undefined;
//     range = this.document.validateRange(range);

//     const newUglyRanges = new DisjointRangeSet();
//     const newStyledRanges = new DisjointRangeSet();
//     const newPrettyRanges : DisjointRangeSet[] = [];
//     this.prettyDecorations.unscoped.forEach(() => newPrettyRanges.push(new DisjointRangeSet()));

//     // only start looking for ugly strings after the last preexisting ugly string or else at the beginning of the line
//     this.uglyUnscoped.lastIndex = 0;
//     const precedingRange = this.uglyDecorationRanges.findPreceding(range.start);
//     if(precedingRange && precedingRange.end.line==range.start.line)
//       this.uglyUnscoped.lastIndex = precedingRange.end.character;
//     const startCharacter = this.uglyUnscoped.lastIndex;

//     // parse all but the last line
//     for(let idx = range.start.line; idx < range.end.line; ++idx) {
//       const line = this.document.lineAt(idx);

//       let match : RegExpExecArray;
//       while(match = this.uglyUnscoped.exec(line.text)) {
//         const ugly = this.getUglyFromMatch(match, idx);
//         if(!ugly)
//           continue;
//         this.uglyUnscoped.lastIndex = ugly.lastIndex;
//         if(this.prettyDecorations.unscoped[ugly.prettyIndex].pretty)
//           newUglyRanges.insert(ugly.range);
//         else
//           newStyledRanges.insert(ugly.range);
//         newPrettyRanges[ugly.prettyIndex].insert(ugly.range);        
//       }
//       // next search starts at the beginning of the line
//       this.uglyUnscoped.lastIndex = 0;
//     }

//     // handle the last line with special care because it might require
//     // re-parsing between range.end and the end of the line.
//     const line = this.document.lineAt(range.end.line);
//     const preexistingUgliesIter = this.uglyDecorationRanges.getRangesStartingAt(range.end);
//     let preexistingUgly = preexistingUgliesIter.next();
//     let match : RegExpExecArray;    

//     // match up the the last character of the line
//     while(match = this.uglyUnscoped.exec(line.text)) {
//       try {
//         const ugly = this.getUglyFromMatch(match, range.end.line);
//         if(!ugly)
//           continue;
//         this.uglyUnscoped.lastIndex = ugly.lastIndex;
//         // if we have just matched a preexisting ugly, then we are done
//         if(!preexistingUgly.done && preexistingUgly.value.isEqual(ugly.range))
//           break;
//         else if(!preexistingUgly.done && preexistingUgly.value.start.isBefore(ugly.range.end))
//           preexistingUgly = preexistingUgliesIter.next();

//         if(this.prettyDecorations.unscoped[ugly.prettyIndex].pretty)
//           newUglyRanges.insert(ugly.range);
//         newStyledRanges.insert(ugly.range);
//         newPrettyRanges[ugly.prettyIndex].insert(ugly.range);
//       } catch(e) {}

//     }

//     return {newStyledRanges: newStyledRanges, newUglyRanges: newUglyRanges, newPrettyRanges: newPrettyRanges, startCharacter: startCharacter}
//   }

//   /**
//    * Assumes that all decorations overlapping the range have been removed
//    * However, parsing may continue to the end of the line of range.end,
//    * so more pre-existing ranges may be removed from uglyDecorationRanges
//    * returns the range of reparsed text
//    */
//   private parsePrettyScoped(range: vscode.Range) : {newStyledRanges: DisjointRangeSet, newUglyRanges: DisjointRangeSet, newPrettyRanges: DisjointRangeSet[], startCharacter: number} {
//     if(this.prettyDecorations.scoped.length == 0 || !this.grammar)
//       return undefined;
//     range = this.document.validateRange(range);

//     const newUglyRanges = new DisjointRangeSet();
//     const newStyledRanges = new DisjointRangeSet();
//     const newPrettyRanges = [];
//     this.prettyDecorations.scoped.forEach(() => newPrettyRanges.push(new DisjointRangeSet()));

//     // only start looking for ugly strings after the last preexisting ugly string or else at the beginning of the line
//     let startOffset = 0;
//     const precedingRange = this.uglyDecorationRanges.findPreceding(range.start);
//     if(precedingRange && precedingRange.end.line==range.start.line)
//       startOffset = precedingRange.end.character;
//     const startCharacter = startOffset;

//     let dirtyGrammarState = false;
// const s = range.start.line;
// let idx;
//     for(idx = range.start.line; idx <= range.end.line || (idx < this.document.lineCount && dirtyGrammarState); ++idx) {
//       if(idx > range.end.line)
//         console.log('!');
//       const line = this.document.lineAt(idx);

//       const prevState = this.grammarState[line.lineNumber-1] || null;
//       const lineTokens = this.grammar.tokenizeLine(line.text, prevState);
//       dirtyGrammarState = !this.grammarState[line.lineNumber] || !lineTokens.ruleStack.equals(this.grammarState[line.lineNumber]);
//       this.grammarState[line.lineNumber] = lineTokens.ruleStack;
//       if(this.grammarState[line.lineNumber] && !lineTokens.ruleStack.equals(this.grammarState[line.lineNumber]))
//         console.log('#');

//       for(let token of lineTokens.tokens) {
//         if(token.endIndex <= startOffset)
//           continue;

//         let match : RegExpExecArray;
//         this.uglyScoped.lastIndex = Math.max(0,startOffset - token.startIndex);
//         const tokenStr = line.text.substring(token.startIndex,token.endIndex);
//         while(match = this.uglyScoped.exec(tokenStr)) {
//           const ugly = this.getUglyFromMatch(match, idx);
//           if(!ugly)
//             continue;
//           this.uglyScoped.lastIndex = ugly.lastIndex;
//           const uglyScope = this.prettyDecorations.scoped[ugly.prettyIndex].scope;
//           if(!tm.matchScope(uglyScope, token.scopes))
//             continue;

//           ugly.range = new vscode.Range(line.lineNumber,token.startIndex+ugly.range.start.character,line.lineNumber,token.startIndex+ugly.range.end.character);

//           if(this.prettyDecorations.scoped[ugly.prettyIndex].pretty)
//             newUglyRanges.insert(ugly.range);
//           else
//             newStyledRanges.insert(ugly.range);
//           newPrettyRanges[ugly.prettyIndex].insert(ugly.range);
//         }
//       }

//       startOffset = 0;
//     }
//     console.log(`Updated lines ${s} to ${idx}`)

//     return {newStyledRanges: newStyledRanges, newUglyRanges: newUglyRanges, newPrettyRanges: newPrettyRanges, startCharacter: startCharacter}
//   }

//   /**
//    * Assumes that all decorations overlapping the range have been removed
//    * However, parsing may continue to the end of the line of range.end,
//    * so more pre-existing ranges may be removed from uglyDecorationRanges
//    * returns the range of reparsed text
//    */
//   private parsePretty(range: vscode.Range) : vscode.Range {
//     const r1 = this.parsePrettyUnscoped(range);
//     const r2 = this.parsePrettyScoped(range);
//     // return r1.union(r2);

//     if(!r1 && !r2)
//       return range;

//     const newStyledRanges = new DisjointRangeSet();
//     const newUglyRanges = new DisjointRangeSet();
//     if(r1) {
//       newStyledRanges.insertRanges(r1.newStyledRanges);
//       newUglyRanges.insertRanges(r1.newUglyRanges);
//     } if(r2) {
//       newStyledRanges.insertRanges(r2.newStyledRanges);
//       newUglyRanges.insertRanges(r2.newUglyRanges);
//     }

//     // remove any freshly discarded uglies: from range.end to the last new ugly position
//     if(range.end.isBefore(newUglyRanges.getEnd())) {
//       const extraOverlap = new vscode.Range(range.end,newUglyRanges.getEnd());
//       this.uglyDecorationRanges.removeOverlapping(extraOverlap);
//       for(const subst of this.prettyDecorations.unscoped)
//         subst.ranges.removeOverlapping(extraOverlap);
//       for(const subst of this.prettyDecorations.scoped)
//         subst.ranges.removeOverlapping(extraOverlap);
//     }
//     // remove any freshly discarded uglies: from range.end to the last new ugly position
//     if(range.end.isBefore(newStyledRanges.getEnd())) {
//       const extraOverlap = new vscode.Range(range.end,newStyledRanges.getEnd());
//       for(const subst of this.prettyDecorations.unscoped)
//         subst.ranges.removeOverlapping(extraOverlap);
//       for(const subst of this.prettyDecorations.scoped)
//         subst.ranges.removeOverlapping(extraOverlap);
//     }

//     // add the new pretties & ugly ducklings
//     if(r1) {
//       this.uglyDecorationRanges.insertRanges(r1.newUglyRanges);
//       this.prettyDecorations.unscoped.forEach((pretty,idx) => pretty.ranges.insertRanges(r1.newPrettyRanges[idx]));
//     }
//     if(r2) {
//       this.uglyDecorationRanges.insertRanges(r2.newUglyRanges);
//       this.prettyDecorations.scoped.forEach((pretty,idx) => pretty.ranges.insertRanges(r2.newPrettyRanges[idx]));
//     }

//     const startCharacter = Math.min(r1 ? r1.startCharacter : range.start.character, r2 ? r2.startCharacter : range.start.character);

//     if(!newStyledRanges.isEmpty() || !newUglyRanges.isEmpty()) {
//       this.changedUglies = true;
//       const end1 = newUglyRanges.getEnd()
//       const end2 = newStyledRanges.getEnd()
//       return new vscode.Range(range.start.with({character: startCharacter}),drangeset.maxPosition(range.end,drangeset.maxPosition(end1,end2)));
//     } else
//       return new vscode.Range(range.start.with({character: startCharacter}),range.end);
//   }


  private debugDecorations : {dec:vscode.TextEditorDecorationType, ranges: vscode.Range[]}[] = 
    [ {dec: vscode.window.createTextEditorDecorationType({textDecoration: 'line-through'}), ranges: []} // affected uglies
  	, {dec: vscode.window.createTextEditorDecorationType({backgroundColor: 'yellow',}), ranges: []} // reparsed text
    , {dec: vscode.window.createTextEditorDecorationType({outlineColor: 'black', outlineStyle: 'solid', outlineWidth: '1pt'}), ranges: []} // editRange
    ];

  private applyChanges(changes: vscode.TextDocumentContentChangeEvent[]) {
    // this.cachedLines = [];
    if(debugging)
      this.debugDecorations.forEach((val) => val.ranges = []);
    // const startTime = new Date().getTime();
    this.changedUglies = false; // assume no changes need to be made for now
    const sortedChanges =
      changes.sort((change1,change2) => change1.range.start.isAfter(change2.range.start) ? -1 : 1)
    for(const change of sortedChanges) {
      try {
        const delta = textUtil.toRangeDelta(change.range, change.text);
        const editRange = textUtil.rangeDeltaNewRange(delta);

        const reparseRanges = this.conditionalRanges.removeOverlapping(change.range,{includeTouchingStart:true,includeTouchingEnd:true});
        this.conditionalRanges.shiftDelta(delta);
        const reparseRange = reparseRanges.length > 0
          ? new vscode.Range(reparseRanges[0].start, reparseRanges[reparseRanges.length-1].end)
          : change.range;
        // note: take the union to make sure that each edit location is reparsed, even if there were no preeexisting uglies (i.e. allow searching for new uglies)
        const adjustedReparseRange = textUtil.rangeTranslate(reparseRange, delta).union(editRange);

        // const removed  = this.uglyDecorationRanges.removeOverlapping(change.range,{includeTouchingStart:true,includeTouchingEnd:true});
        // const affected = this.uglyDecorationRanges.shiftRangeDelta(delta);
        // if(removed.length > 0)
        //   this.changedUglies = true;

        // for(const subst of this.prettyDecorations.unscoped) {
        //   subst.ranges.removeOverlapping(change.range,{includeTouchingStart:true,includeTouchingEnd:true});
        //   subst.ranges.shiftRangeDelta(delta);
        // }
        // for(const subst of this.prettyDecorations.scoped) {
        //   subst.ranges.removeOverlapping(change.range,{includeTouchingStart:true,includeTouchingEnd:true});
        //   subst.ranges.shiftRangeDelta(delta);
        // }
        // const affected = this.adjustByEditPretties(change.range, delta);

        const removed  = this.uglyDecorationRanges.removeOverlapping(reparseRange,{includeTouchingStart:true,includeTouchingEnd:true});
        const affected = this.uglyDecorationRanges.shiftRangeDelta(delta);
        if(removed.length > 0)
          this.changedUglies = true;

        for(const subst of this.prettyDecorations.unscoped) {
          subst.ranges.removeOverlapping(reparseRange,{includeTouchingStart:true,includeTouchingEnd:true});
          subst.ranges.shiftRangeDelta(delta);
        }
        for(const subst of this.prettyDecorations.scoped) {
          subst.ranges.removeOverlapping(reparseRange,{includeTouchingStart:true,includeTouchingEnd:true});
          subst.ranges.shiftRangeDelta(delta);
        }

        const reparsed = this.reparsePretties(adjustedReparseRange);

        if(debugging) {
          this.debugDecorations[0].ranges.push(affected);
          this.debugDecorations[1].ranges.push(reparsed);
          this.debugDecorations[2].ranges.push(reparseRange);
        }
      } catch(e) {
        console.error(e);
      }
    }

    if(this.changedUglies || true)
      this.applyDecorations(this.getEditors());
    // else if(debugging)
    //   this.debugDecorations.forEach((val) => this.getEditors().forEach((e) => e.setDecorations(val.dec,val.ranges))); 
    
    // this.refresh();
    // const endTime = new Date().getTime();
    // console.log(endTime - startTime + "ms")
  }

  private onChangeDocument(event: vscode.TextDocumentChangeEvent) {
    this.applyChanges(event.contentChanges);
  }

  /** reparses the document and recreates the highlights for all editors */  
  public refresh() {
    this.uglyDecorationRanges = new DisjointRangeSet();
    this.grammarState = [];
    for(const subst of this.prettyDecorations.unscoped)
      subst.ranges = new DisjointRangeSet();
    for(const subst of this.prettyDecorations.scoped)
      subst.ranges = new DisjointRangeSet();
    this.debugDecorations.forEach((val) => val.ranges = [])
    // this.applyDecorations(this.getEditors());

    const docRange = new vscode.Range(0,0,this.document.lineCount,0);
    this.reparsePretties(docRange);

    this.applyDecorations(this.getEditors()); 
  }

  private findSymbolAt(pos: vscode.Position, options: {excludeStart?: boolean, includeEnd?: boolean} = {excludeStart: false, includeEnd: false}) {
    return this.uglyDecorationRanges.find(pos,options);
  }

  private findSymbolsIn(range: vscode.Range) {
    return this.uglyDecorationRanges.getOverlap(range);
  }

  private revealSelections(editor: vscode.TextEditor) {
    const revealUgly = (getRange: (sel:vscode.Selection) => vscode.Range) => {
      const cursorRevealedRanges = new DisjointRangeSet();
      for(const selection of editor.selections) {
        const ugly = getRange(selection);
        if(ugly)
          cursorRevealedRanges.insert(ugly);
      }
      // reveal the uglies and hide the pretties
      editor.setDecorations(this.revealedUglyDecoration, cursorRevealedRanges.getRanges());
    }
    const revealUglies = (getRanges: (sel:vscode.Selection) => DisjointRangeSet) => {
      const cursorRevealedRanges = new DisjointRangeSet();
      for(const selection of editor.selections) {
        const ugly = getRanges(selection);
        if(ugly)
          cursorRevealedRanges.insertRanges(ugly);
      }
      // reveal the uglies and hide the pretties
      editor.setDecorations(this.revealedUglyDecoration, cursorRevealedRanges.getRanges());
    }

    // add the new intersections
    switch(this.revealStrategy) {
      case 'cursor':
        revealUgly((sel) => this.findSymbolAt(sel.active,{includeEnd: true}));
        return;
      case 'cursor-inside':
        revealUgly((sel) => this.findSymbolAt(sel.active,{excludeStart: true}));
        return;
      case 'active-line':
        revealUglies((sel) => this.findSymbolsIn(editor.document.lineAt(sel.active.line).range));
        return;
      case 'selection':
        revealUglies((sel) => this.findSymbolsIn(new vscode.Range(sel.start, sel.end)));
        return;
    }
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
      const adjusted = pos.adjustCursorMovement(before[idx].active,sel.active,this.document,this.uglyDecorationRanges.getRanges());
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

  private renderPrettyCursor(editor: vscode.TextEditor) {
    switch(this.prettyCursor) {
      case 'boxed': {
        const boxPretty = (getRange: (sel:vscode.Selection) => vscode.Range) => {
          try {
            const cursorBoxRanges = new DisjointRangeSet();
            for(const selection of editor.selections) {
              const pretty = getRange(selection);
              if(pretty)
                cursorBoxRanges.insert(pretty);
            }
            // reveal the uglies and hide the pretties
            editor.setDecorations(this.boxedSymbolDecoration, cursorBoxRanges.getRanges());
          } catch(err) {
            console.error(err);
            console.error('\n');
          }
        }
        boxPretty((sel) => this.findSymbolAt(sel.active));
        return;
      }
      default:
        return;
    }
  }

  public selectionChanged(editor: vscode.TextEditor) {
    this.revealSelections(editor);
    this.renderPrettyCursor(editor);
    if(this.adjustCursorMovement)
      this.adjustCursor(editor);
  }

}