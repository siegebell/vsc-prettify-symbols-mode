import * as vscode from 'vscode';
import * as textUtil from './text-util';


/// Tracks a set of disjoint (nonoverlapping) ranges
/// Internallay sorts the ranges and provides fast lookup/intersection
/// Inserting a range fails if it overlaps another range
export class DisjointRangeSet {
  // ranges, sorted by starting position; nonoverlapping
  private ranges : vscode.Range[];

  constructor() {
    this.ranges = [];
  }

  private static makeFromSortedRanges(ranges:vscode.Range[]) : DisjointRangeSet {
    const result = new DisjointRangeSet();
    result.ranges = ranges;
    return result;
  }

  public getStart() : vscode.Position {
    if(this.ranges.length > 0)
      return this.ranges[0].start;
    else
      return new vscode.Position(0,0);
  }

  public getEnd() : vscode.Position {
    if(this.ranges.length > 0)
      return this.ranges[this.ranges.length-1].end;
    else
      return new vscode.Position(0,0);
  }

  public getTotalRange() {
    if(this.ranges.length > 0)
      return new vscode.Range(this.ranges[0].start,this.ranges[this.ranges.length-1].end);
    else
      return new vscode.Range(0,0,0,0);
  }

  public isEmpty() : boolean {
    return this.ranges.length == 0;
  }

  public isEmptyRange() : boolean {
    return this.ranges.length == 0 || this.ranges[0].start.isEqual(this.ranges[this.ranges.length-1].end);
  }

  /// assumes that the ranges in newRanges are not interspersed with this
  /// this assumption can be made if the overlapping range had been previously removed
  public insertRanges(newRanges: DisjointRangeSet) : boolean {
    const totalRange = newRanges.getTotalRange()
    const insertionIdx = this.findIndex(totalRange.start);
    const next = this.ranges[insertionIdx];
    if(next && totalRange.end.isAfter(next.start))
      return false;
    // not overlapping!
    this.ranges.splice(insertionIdx, 0, ...newRanges.ranges);
  }

 /**
 * @returns `true` on success: if there was no overlap
 */
  public insert(range: vscode.Range) : boolean {
    const insertionIdx = this.findIndex(range.start);
    const next = this.ranges[insertionIdx];
    if(next && range.end.isAfter(next.start))
      return false;
    // not overlapping!
    this.ranges.splice(insertionIdx, 0, range);
    return true;
  }

  public isOverlapping(range: vscode.Range) : boolean {
    const insertionIdx = this.findIndex(range.start);
    const next = this.ranges[insertionIdx];
    if(next && range.end.isAfter(next.start))
      return true;
    return false;
  }

  // remove all ranges that overlap the given range
  public removeOverlapping(range: vscode.Range, options: {includeTouchingStart?:boolean,includeTouchingEnd?:boolean} = {includeTouchingStart:false,includeTouchingEnd:false}) : vscode.Range[] {
    const inclStart = options.includeTouchingStart || false;
    const inclEnd = options.includeTouchingEnd || false;
    let begin = this.findIndex(range.start);
    if(inclStart && begin > 0 && this.ranges[begin-1].end.isEqual(range.start))
      --begin;
    let end = begin;
    while(end < this.ranges.length && this.ranges[end].start.isBefore(range.end))
      ++end;
    if(inclEnd && end < this.ranges.length && this.ranges[end].start.isEqual(range.end))
      ++end;
    // else if(inclEnd && end < this.ranges.length-1 && this.ranges[end+1].start.isEqual(range.end))
    //   ++end;
    return this.ranges.splice(begin, end-begin);
  }

  // remove the given ranges (only considers equal ranges; not simply overlapping)
  public subtractRanges(ranges: DisjointRangeSet) : DisjointRangeSet {
    let idx1 = 0;
    const newRanges = this.ranges.filter((r) => {
      const idx = ranges.ranges.indexOf(r, idx1);
      if(idx != -1) {
        idx1 = idx; // take advantage of the fact the ranges are sorted
        return false; // discard
      }
      else
        return true; // keep
    });
    return DisjointRangeSet.makeFromSortedRanges(newRanges);
  }

  private validateFoundIndex(idx: number, pos: vscode.Position, exclStart: boolean, inclEnd: boolean) {
    if(idx > this.ranges.length || idx < 0)
      throw "idx is out of range: idx > this.ranges.length || idx < 0";
    else if(this.ranges.length == 0)
      return;
    else if(idx < this.ranges.length && !textUtil.rangeContains(this.ranges[idx],pos,exclStart,inclEnd) && this.ranges[idx].start.isBefore(pos))
      throw "idx is too big; range comes before pos";
    else if(idx > 0 && this.ranges[idx-1].end.isAfter(pos))
      throw "idx is too big; previous element comes after pos";
    else if(idx < this.ranges.length-1 && this.ranges[idx+1].start.isBefore(pos) && (!inclEnd || !this.ranges[idx].end.isEqual(pos)))
      throw "idx is too small; next element comes before pos";
  }


  /** returns the index of the range that starts at or after the given position
   * if pos is after all range-starts, then this returns this.ranges.length
   */
  private findIndex(pos: vscode.Position, options: {excludeStart?: boolean, includeEnd?: boolean} = {excludeStart: false, includeEnd: false}) {
    const exclStart = options.excludeStart || false;
    const inclEnd = options.includeEnd || false;

    let begin = 0;
    let end = this.ranges.length;
    if(this.ranges.length == 0)
      return 0;
    if(this.ranges[this.ranges.length-1].end.isBeforeOrEqual(pos) && (!inclEnd || !this.ranges[this.ranges.length-1].end.isEqual(pos)))
      return this.ranges.length;

    // binary search
    let idx = Math.floor((begin + end)/2);
    while(begin < end) {
      const range = this.ranges[idx];
      if(textUtil.rangeContains(range,pos,exclStart,inclEnd))
        break; // we've found a match
      else if(pos.isBefore(range.start) || (exclStart && pos.isEqual(range.start)))
        end = idx;
      else // pos.isAfterOrEqual(range.end)
        begin = idx+1;
      idx = Math.floor((begin + end)/2);
    }

    this.validateFoundIndex(idx,pos,exclStart,inclEnd);
    return idx;

    // if(begin < end) {
    //   // we found a match
    //   // rewind until we find the first matching index
    //   // while(idx > 0 && this.ranges[idx-1].start.isEqual(pos))
    //   //   --idx;
    //   return idx;
    // } else {
    //   // we did not directly find the item; advance to the nearest matching index (after pos) 
    //   for(let idx = begin; idx < this.ranges.length; ++idx) {
    //     const range = this.ranges[idx];
    //     if(range.start.isAfter(pos))
    //       return idx;
    //   }
    //   // the position is after all values in the array
    //   return this.ranges.length;
    // }
  }


  // private indexAt(pos: vscode.Position, options: {excludeStart?: boolean, excludeEnd?: boolean} = {excludeStart: false, excludeEnd: false}) : number {
  // 	const exclStart = options.excludeStart || false;
  //   const exclEnd = options.excludeEnd || false;
  //   let begin = 0;
  //   let end = this.ranges.length;

  //   // binary search
  //   while(begin < end) {
  //     const idx = Math.floor((begin + end)/2);
  //     const range = this.ranges[idx];
  //     if(range.contains(pos) && !(exclStart && range.start.isEqual(pos)) && !(exclEnd && range.end.isEqual(pos)))
  //       return idx;
  //     else if(pos.isBefore(range.start))
  //       end = idx;
  //     else
  //       begin = idx+1;
  //   }

  //   // we did not directly find the item 
  //   for(let idx = begin; idx < this.ranges.length; ++idx) {
  //     const range = this.ranges[idx];
  //     if(range.start.isAfterOrEqual(pos) && !(exclStart && range.start.isEqual(pos)))
  //       return idx;
  //   }
  //   return -1;
  // }

  /** returns the range that contains pos, or else undefined */
  public find(pos: vscode.Position, options: {excludeStart?: boolean, includeEnd?: boolean} = {excludeStart: false, includeEnd: false}) : vscode.Range {
    const idx = this.findIndex(pos, options);
    const match = this.ranges[idx];
    if(match && textUtil.rangeContains(match,pos,options.excludeStart,options.includeEnd))
      return match;
    else
      return undefined;
  }

  public findPreceding(pos: vscode.Position) : vscode.Range {
    const idx = this.findIndex(pos);
    const match = this.ranges[idx-1];
    return match;
  }

  public *getRangesStartingAt(pos: vscode.Position) : IterableIterator<vscode.Range> {
    for(let idx = this.findIndex(pos); idx < this.ranges.length; ++idx)
      yield this.ranges[idx];
  }

  public getRanges() {
    return this.ranges;
  }

  // /** removes any overlapping ranges and shifts the positions of subsequent ranges
  //  * returns the removed ranges
  // */
  // public shiftDeleteRange(del: vscode.Range) : vscode.Range[] {
  //   if(this.ranges.length == 0 || del.isEmpty)
  //     return [];
  //   const removed = this.removeOverlapping(del);

  //   const deltaLines = del.end.line - del.start.line;
  //   // -delta for everything on the same line as del.end
  //   const startCharacterDelta = (del.start.line==del.end.line)
  //     ? del.end.character-del.start.character
  //     : del.end.character;

  //   let idx = this.findIndex(del.end);
  //   // shift everything on the same line
  //   for( ; idx < this.ranges.length && del.end.line == this.ranges[idx].start.line; ++idx) {
  //     const range = this.ranges[idx];
  //     if(range.end.line==range.start.line)
  //       this.ranges[idx] = new vscode.Range(range.start.translate(0,-startCharacterDelta), range.end.translate(0,-startCharacterDelta));
  //     else // should effectively break after this case
  //       this.ranges[idx] = new vscode.Range(range.start.translate(0,-startCharacterDelta), range.end.translate(-deltaLines,0));
  //   }

  //   // shift the remaining lines
  //   for( ; idx < this.ranges.length; ++idx) {
  //     const range = this.ranges[idx];
  //     this.ranges[idx] = new vscode.Range(range.start.translate(-deltaLines,0), range.end.translate(-deltaLines,0));
  //   }

  //   return removed;
  // }

  // /** inserts a range; assumes nothing overlaps with pos
  //  * returns true if successful; false if not (there was an overlap)
  // */
  // public shiftInsertRange(pos: vscode.Position, insert: vscode.Range) : boolean {
  //   if(this.ranges.length == 0 || insert.isEmpty)
  //     return;
  //   if(this.find(pos))
  //     return false; // overlap!

  //   const deltaLines = insert.end.line - insert.start.line;
  //   // delta for everything on the same line as insert.end
  //   const startCharacterDelta = (insert.start.line==insert.end.line)
  //     ? insert.end.character-insert.start.character
  //     : insert.end.character;

  //   let idx = this.findIndex(pos);
  //   // shift everything on the same line
  //   for( ; idx < this.ranges.length && pos.line == this.ranges[idx].start.line; ++idx) {
  //     const range = this.ranges[idx];
  //     if(range.end.line==range.start.line)
  //       this.ranges[idx] = new vscode.Range(range.start.translate(0,startCharacterDelta), range.end.translate(0,startCharacterDelta));
  //     else // should effectively break after this case
  //       this.ranges[idx] = new vscode.Range(range.start.translate(0,startCharacterDelta), range.end.translate(deltaLines,0));
  //   }

  //   // shift the remaining lines
  //   for( ; idx < this.ranges.length; ++idx) {
  //     const range = this.ranges[idx];
  //     this.ranges[idx] = new vscode.Range(range.start.translate(deltaLines,0), range.end.translate(deltaLines,0));
  //   }
  // }

  public shiftRangeDelta(delta: textUtil.RangeDelta) : vscode.Range {
    if(this.ranges.length == 0 || (delta.linesDelta == 0 && delta.endCharactersDelta == 0))
      return new vscode.Range(delta.start, delta.end);

    const firstIdx = this.findIndex(delta.start);
    let idx = firstIdx;    

    if(delta.linesDelta != 0) {
      // shift all remaining lines
      for( ; idx < this.ranges.length; ++idx)
        this.ranges[idx] = textUtil.rangeTranslate(this.ranges[idx], delta);
    } else {
      // shift everything overlapping on the same end line
      for( ; idx < this.ranges.length && this.ranges[idx].start.line <= delta.end.line; ++idx) {
        this.ranges[idx] = textUtil.rangeTranslate(this.ranges[idx], delta);
      }
    }

    // not firstIdx <= idx <= this.ranges.length
    if(firstIdx == idx)
      return new vscode.Range(0,0,0,0);
    else if(idx == this.ranges.length)
      return new vscode.Range(this.ranges[firstIdx].start, this.ranges[idx-1].end);
    else
      return new vscode.Range(this.ranges[firstIdx].start, this.ranges[idx-1].end);
  }

  public shiftTextChange(target: vscode.Range, text: string) : vscode.Range {
    return this.shiftRangeDelta(textUtil.toRangeDelta(target, text));
  }

  public getOverlapRanges(range: vscode.Range) : vscode.Range[] {
    const begin = this.findIndex(range.start);
    const end = this.findIndex(range.end);
    return this.ranges.slice(begin,end);
  }

  public getOverlap(range: vscode.Range, options: {excludeStart?: boolean, includeEnd?: boolean} = {excludeStart: false, includeEnd: false}) : DisjointRangeSet {
    const begin = this.findIndex(range.start, {excludeStart: options.excludeStart,includeEnd: range.isEmpty});
    let end = this.findIndex(range.end, {excludeStart: true, includeEnd: options.includeEnd});
    if(end < this.ranges.length && textUtil.rangeContains(this.ranges[end],range.end,!range.isEmpty,options.includeEnd))
      ++end;
    return DisjointRangeSet.makeFromSortedRanges(this.ranges.slice(begin,end));
  }

  /// shifts the line positions of ranges
  /// returns false if this operation failed because there is an overlapping
  /// range or if removing lines introduces an overlap
//   public shiftLines(pos: vscode.Position, deltaLines: number) : boolean {
//     if(this.ranges.length == 0 || deltaLines==0)
//       return true;

//     const idx = this.findIndex(pos);

//     if(idx >= this.ranges.length)
//       return true;
//     if(this.ranges[idx].contains(pos))
//       return false; // overlapping conflict!

//     const prev = this.ranges[idx-1]; // may be undefined
//     const next = this.ranges[idx]; // exists

//     if(next.start.line+deltaLines < 0)
//       return false;
//     if(prev && prev.end.isAfter(next.start.translate(deltaLines,0)))
//       return false;

//     // shift the ranges after pos
//     while (idx < this.ranges.length) {
//       const range = this.ranges[idx];
//       this.ranges[idx] = new vscode.Range(range.start.translate(deltaLines,0),range.end.translate(deltaLines,0))
//     }
//     return true;
//   }
}