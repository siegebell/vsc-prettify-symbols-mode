import * as vscode from 'vscode';
import {Substitution, UglyRevelation, LanguageEntry, PrettyCursor, PrettyStyleProperties, PrettyStyle, assignStyleProperties, HideTextMethod} from './configuration';
import * as pos from './position';
import {RangeSet} from './RangeSet';
import {DisjointRangeSet} from './disjointrangeset';
import * as drangeset from './disjointrangeset';
import * as textUtil from './text-util';
import * as tm from './text-mate';
import {MatchResult, iterateMatches, iterateMatchArray, mapIterator} from './regexp-iteration';
import * as decorations from './decorations';

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
    private hideTextMethod = options.hideTextMethod,
    private combineIdenticalScopes = settings.combineIdenticalScopes,
  ) {
    this.grammar = options.textMateGrammar || null;
    this.loadDecorations(settings.substitutions);

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
        return editor.document.uri === this.document.uri;
      });
  }

  public gotFocus(editor: vscode.TextEditor) {
    this.applyDecorations(this.getEditors());
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


    let dec : {uglyDecoration: vscode.TextEditorDecorationType, revealedUglyDecoration: vscode.TextEditorDecorationType, boxedSymbolDecoration: vscode.TextEditorDecorationType}
    if(this.hideTextMethod === "hack-fontSize")
      dec = decorations.makeDecorations_fontSize_hack();
    else if(this.hideTextMethod === "hack-letterSpacing")
      dec = decorations.makeDecorations_letterSpacing_hack();
    else
      dec = decorations.makeDecorations_none();
    this.uglyDecoration = dec.uglyDecoration;
    this.revealedUglyDecoration = dec.revealedUglyDecoration;
    this.boxedSymbolDecoration = dec.boxedSymbolDecoration;

    this.prettyDecorations.scoped = [];
    this.prettyDecorations.unscoped = [];
    const uglyAllUnscopedStrings = [];
    for(const prettySubst of prettySubstitutions) {
      const pre = (prettySubst.scope && prettySubst.pre===undefined) ? "^" : this.regexpOptionalGroup(prettySubst.pre);
      const post = (prettySubst.scope && prettySubst.post===undefined) ? "$" : this.regexpOptionalGroup(prettySubst.post);
      const uglyStr = pre + "(" + prettySubst.ugly + ")" + post;
      try {
        const re = new RegExp(uglyStr, "g");
        if(re.test("")) {
          console.warn(`Substitution ignored because it matches the empty string: "${uglyStr}" --> "${prettySubst.pretty}"`);
          continue;
        }

        let decoration = undefined;
        if(!prettySubst.pretty)
          decoration = decorations.makePrettyDecoration_noPretty(prettySubst);
        else if(this.hideTextMethod === "hack-fontSize")
          decoration = decorations.makePrettyDecoration_fontSize_hack(prettySubst);
        else if(this.hideTextMethod === "hack-letterSpacing")
          decoration = decorations.makePrettyDecoration_letterSpacing_hack(prettySubst);
        else
          decoration = decorations.makePrettyDecoration_noHide(prettySubst);

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
              continue; // handle ONLY the active editr here
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
        }
      }, activeEditorDecorationTimeout);
    }
    if(!this.applyDecorationsTimeout) {
      this.applyDecorationsTimeout = setTimeout(() => {
        try {
          for(const editor of editors) {
            if(editor === vscode.window.activeTextEditor)
              continue; // handle this in another timer
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

  private refreshTokensOnLine(line: vscode.TextLine) : {tokens: tm.IToken[], invalidated: boolean} {
    if(!this.grammar)
      return {tokens: [], invalidated: false};
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
    const tokensOld = tokens;
    if(this.combineIdenticalScopes)
      tokens = tm.combineIdenticalTokenScopes(tokens);
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
      // console.info('Aditional tokens reparsed: ' + (lineIdx-range.end.line) + ' lines');
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