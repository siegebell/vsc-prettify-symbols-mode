/**
 * Copyright 2016 by Christian J. Bell
 * 
 * PrettyModel.ts
 * 
 * Models the substitutions within a text document
 */
import * as vscode from 'vscode';
import {Substitution, LanguageEntry, HideTextMethod} from './configuration';
import {RangeSet} from './RangeSet';
import {DisjointRangeSet} from './DisjointRangeSet';
//import * as drangeset from './DisjointRangeSet';
import * as textUtil from './text-util';
import * as tm from './text-mate';
import {MatchResult, iterateMatches, iterateMatchArray, mapIterator} from './regexp-iteration';
import * as decorations from './decorations';

const debugging = false;
/* const activeEditorDecorationTimeout = 20;
const inactiveEditorDecorationTimeout = 200; */

interface PrettySubstitution {
	ugly: RegExp,
	pretty: string,
	decorationType: vscode.TextEditorDecorationType,
	ranges: DisjointRangeSet,
  index: number,
  scope?: string,
}

export interface DocumentModel {
  getText: (r: vscode.Range) => string;
  getLine: (line: number) => string;
  getLineRange: (line: number) => vscode.Range;
  getLineCount: () => number;
  validateRange: (r: vscode.Range) => vscode.Range;
}

export interface UpdateDecorationEntry {
  decoration: vscode.TextEditorDecorationType,
  ranges: vscode.Range[],
}

export interface UpdateDecorationInstanceEntry {
  decoration: vscode.DecorationInstanceRenderOptions,
  ranges: DisjointRangeSet,
}

export class PrettyModel implements vscode.Disposable {
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
  private boxedSymbolDecoration: vscode.DecorationInstanceRenderOptions = null;

  // Stores the state for each line
  private grammarState : tm.StackElement[] = [];
  private grammar : null|tm.IGrammar = null;

  public constructor(doc: DocumentModel, settings: LanguageEntry, options: {hideTextMethod: HideTextMethod, textMateGrammar?: tm.IGrammar|null},
    private document = doc,
    private revealStrategy = settings.revealOn,
    private prettyCursor = settings.prettyCursor,
    private hideTextMethod = options.hideTextMethod,
    private combineIdenticalScopes = settings.combineIdenticalScopes,
  ) {
    this.grammar = options.textMateGrammar || null;
    this.loadDecorations(settings.substitutions);

    // Parse whole document
    const docRange = new vscode.Range(0,0,this.document.getLineCount(),0);
    this.reparsePretties(docRange);
  }

  public dispose() {
    this.unloadDecorations();
    this.debugDecorations.forEach((val) => val.dec.dispose());
    this.subscriptions.forEach((s) => s.dispose());
  }

  public getDecorationsList() : UpdateDecorationEntry[] {
    const decs : UpdateDecorationEntry[] = [];
    if(this.uglyDecoration)
      decs.push({decoration: this.uglyDecoration, ranges: this.uglyDecorationRanges.getRanges()});
    for(const subst of this.prettyDecorations.unscoped)
      decs.push({decoration: subst.decorationType, ranges: subst.ranges.getRanges()});
    for(const subst of this.prettyDecorations.scoped)
      decs.push({decoration: subst.decorationType, ranges: subst.ranges.getRanges()});
    if(debugging)
      this.debugDecorations.forEach((val) => decs.push({decoration: val.dec, ranges: val.ranges}));

    return decs;
  }

  private unloadDecorations() {
    if(this.uglyDecoration)
      this.uglyDecoration.dispose();
    if(this.revealedUglyDecoration)
      this.revealedUglyDecoration.dispose();

    this.conditionalRanges = new RangeSet();
    this.uglyDecorationRanges = new DisjointRangeSet();
    // this.styledDecorationRanges = new DisjointRangeSet();
    for(const subst of this.prettyDecorations.unscoped)
      subst.ranges = new DisjointRangeSet();
    for(const subst of this.prettyDecorations.scoped)
      subst.ranges = new DisjointRangeSet();
    this.debugDecorations.forEach((val) => val.ranges = []);

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

    let dec : {uglyDecoration: vscode.TextEditorDecorationType, revealedUglyDecoration: vscode.TextEditorDecorationType, boxedSymbolDecoration: vscode.DecorationInstanceRenderOptions}
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
    //const matchEnd = matchStart + match[0].length;
    const start = matchStart + match[0].indexOf(matchStr);
    const end = start + matchStr.length;
    const uglyRange = new vscode.Range(line,start,line,end);

    return {range: uglyRange, prettyIndex: matchIdx-1, lastIndex: end};
  }

  private refreshTokensOnLine(line: string, lineNumber: number) : {tokens: tm.IToken[], invalidated: boolean} {    
    if(!this.grammar)
      return {tokens: [], invalidated: false};
    try {
      const prevState = this.grammarState[lineNumber-1] || null;
      const lineTokens = this.grammar.tokenizeLine(line, prevState);
      const invalidated = !this.grammarState[lineNumber] || !lineTokens.ruleStack.equals(this.grammarState[lineNumber])
      this.grammarState[lineNumber] = lineTokens.ruleStack;
      return {tokens: lineTokens.tokens, invalidated: invalidated};
    } catch (error) {
      return {tokens: [], invalidated: false};
    }
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
      const matchScopes = this.prettyDecorations.scoped
        .filter(s => tm.matchScope(s.scope, token.scopes));
      const matchIter = iterateMatchArray(tokenStr, matchScopes.map(ms => ms.ugly))
      let match = matchIter.next();
      for(; !match.done; match = matchIter.next()) {
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
  }



  private *iterateLineUglies(line: string, tokens: tm.IToken[]) : IterableIterator<MatchResult & {type: "scoped"|"unscoped"}> {
    type T = "scoped" | "unscoped";
    //let offset = 0;
    //const tokensOld = tokens;
    if(this.combineIdenticalScopes)
      tokens = tm.combineIdenticalTokenScopes(tokens);
    const scopedUgliesIter = this.iterateScopedUglies(line, tokens);
    const unscopedUgliesIter = this.iterateUnscopedUglies(line);
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
    const lineCount = this.document.getLineCount();
    let lineIdx;
    for(lineIdx = range.start.line; lineIdx <= range.end.line || (invalidatedTokenState && lineIdx < lineCount); ++lineIdx) {
      const line = this.document.getLine(lineIdx);
      const {tokens: tokens, invalidated: invalidated} = this.refreshTokensOnLine(line, lineIdx);
      invalidatedTokenState = invalidated;

      for(const ugly of this.iterateLineUglies(line, tokens)) {
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

 /**
 * @returns true if the decorations were invalidated/updated
 */
  public applyChanges(changes: {range: vscode.Range, text: string}[]) : boolean {
    // this.cachedLines = [];
    if(debugging)
      this.debugDecorations.forEach((val) => val.ranges = []);
    // const startTime = new Date().getTime();
    this.changedUglies = false; // assume no changes need to be made for now
    const sortedChanges =
      changes.sort((change1,change2) => change1.range.start.isAfter(change2.range.start) ? -1 : 1)
    const adjustedReparseRanges = new RangeSet();
    for(const change of sortedChanges) {
      try {
        const delta = textUtil.toRangeDelta(change.range, change.text);
        const editRange = textUtil.rangeDeltaNewRange(delta);

        adjustedReparseRanges.shiftDelta(delta);

        const reparseRanges = this.conditionalRanges.removeOverlapping(change.range,{includeTouchingStart:true,includeTouchingEnd:true});
        this.conditionalRanges.shiftDelta(delta);
        const reparseRange = reparseRanges.length > 0
          ? new vscode.Range(reparseRanges[0].start, reparseRanges[reparseRanges.length-1].end)
          : change.range;
        // note: take the union to make sure that each edit location is reparsed, even if there were no preeexisting uglies (i.e. allow searching for new uglies)
        adjustedReparseRanges.add(textUtil.rangeTranslate(reparseRange, delta).union(editRange));

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

        if(debugging) {
          this.debugDecorations[0].ranges.push(affected);
          this.debugDecorations[2].ranges.push(reparseRange);
        }
      } catch(e) {
        console.error(e);
      }
    }

    for(const range of adjustedReparseRanges.getRanges()) {
      const reparsed = this.reparsePretties(range);
      this.debugDecorations[1].ranges.push(reparsed);
    }
    

    // else if(debugging)
    //   this.debugDecorations.forEach((val) => this.getEditors().forEach((e) => e.setDecorations(val.dec,val.ranges))); 
    
    // this.refresh();
    // const endTime = new Date().getTime();
    // console.log(endTime - startTime + "ms")

    return this.changedUglies;
  }

  /** reparses the document and recreates the highlights for all editors */  
  public recomputeDecorations() {
    this.uglyDecorationRanges = new DisjointRangeSet();
    this.grammarState = [];
    for(const subst of this.prettyDecorations.unscoped)
      subst.ranges = new DisjointRangeSet();
    for(const subst of this.prettyDecorations.scoped)
      subst.ranges = new DisjointRangeSet();
    this.debugDecorations.forEach((val) => val.ranges = [])

    const docRange = new vscode.Range(0,0,this.document.getLineCount(),0);
    this.reparsePretties(docRange);
  }

  private findSymbolAt(pos: vscode.Position, options: {excludeStart?: boolean, includeEnd?: boolean} = {excludeStart: false, includeEnd: false}) {
    return this.uglyDecorationRanges.find(pos,options);
  }

  private findSymbolsIn(range: vscode.Range) {
    return this.uglyDecorationRanges.getOverlap(range);
  }

  public getPrettySubstitutionsRanges() : vscode.Range[] {
    return this.uglyDecorationRanges.getRanges();
  }

  /**
   * Returns what the contents of the document would appear to be after decorations (i.e. with substitutions applied to the text)
   */
  public getDecoratedText(range : vscode.Range) : string {
    range = this.document.validateRange(range);

    const text = this.document.getText(range);
    const substitutions : {start: number, end: number, subst: string}[] = []

    for(const subst of this.prettyDecorations.unscoped) {
      if(!subst.pretty)
        continue;
      const substRanges = subst.ranges.getOverlapRanges(range);
      for(const sr of substRanges) {
        const start = textUtil.relativeOffsetAtAbsolutePosition(text, range.start, sr.start);
        const end = textUtil.relativeOffsetAtAbsolutePosition(text, range.start, sr.end);
        substitutions.push({start: start, end: end, subst: subst.pretty})
      }
    }
    for(const subst of this.prettyDecorations.scoped) {
      if(!subst.pretty)
        continue;
      const substRanges = subst.ranges.getOverlapRanges(range);
      for(const sr of substRanges) {
        const start = textUtil.relativeOffsetAtAbsolutePosition(text, range.start, sr.start);
        const end = textUtil.relativeOffsetAtAbsolutePosition(text, range.start, sr.end);
        substitutions.push({start: start, end: end, subst: subst.pretty})
      }
    }

    // reverse order: later substs first
    const sortedSubst = substitutions.sort((a,b) => a.start < b.start ? 1 : a.start === b.start ? 0 : -1);

    let result = text;
    for(const subst of sortedSubst) {
      result = result.slice(0,subst.start) + subst.subst + result.slice(subst.end);
    }

    return result
  }

  public revealSelections(selections: vscode.Selection[]) : UpdateDecorationEntry {
    const revealUgly = (getRange: (sel:vscode.Selection) => vscode.Range) : UpdateDecorationEntry => {
      const cursorRevealedRanges = new DisjointRangeSet();
      for(const selection of selections) {
        const ugly = getRange(selection);
        if(ugly)
          cursorRevealedRanges.insert(ugly);
      }
      // reveal the uglies and hide the pretties
      return {decoration: this.revealedUglyDecoration, ranges: cursorRevealedRanges.getRanges()};
    }
    const revealUglies = (getRanges: (sel:vscode.Selection) => DisjointRangeSet) : UpdateDecorationEntry => {
      const cursorRevealedRanges = new DisjointRangeSet();
      for(const selection of selections) {
        const ugly = getRanges(selection);
        if(ugly)
          cursorRevealedRanges.insertRanges(ugly);
      }
      // reveal the uglies and hide the pretties
      return {decoration: this.revealedUglyDecoration, ranges: cursorRevealedRanges.getRanges()};
    }

    // add the new intersections
    switch(this.revealStrategy) {
      case 'cursor':
        return revealUgly((sel) => this.findSymbolAt(sel.active,{includeEnd: true}));
      case 'cursor-inside':
        return revealUgly((sel) => this.findSymbolAt(sel.active,{excludeStart: true}));
      case 'active-line':
        return revealUglies((sel) => this.findSymbolsIn(this.document.getLineRange(sel.active.line)));
      case 'selection':
        return revealUglies((sel) => this.findSymbolsIn(new vscode.Range(sel.start, sel.end)));
      default:
        return {decoration: this.revealedUglyDecoration, ranges: []};
    }
 }

  public renderPrettyCursor(selections: vscode.Selection[]) : UpdateDecorationInstanceEntry|null {
    switch(this.prettyCursor) {
      case 'boxed': {
        const boxPretty = (getRange: (sel:vscode.Selection) => vscode.Range) : UpdateDecorationInstanceEntry|null => {
          try {
            const cursorBoxRanges = new DisjointRangeSet();
            for(const selection of selections) {
              const pretty = getRange(selection);
              if(pretty)
                cursorBoxRanges.insert(pretty);
            }
            // reveal the uglies and hide the pretties
            return {decoration: this.boxedSymbolDecoration, ranges: cursorBoxRanges};
          } catch(err) {
            console.error(err);
            console.error('\n');
            return null;
          }
        }
        return boxPretty((sel) => this.findSymbolAt(sel.active));
      }
      default:
        return null;
    }
  }

}