
export class Position {
  public line: number;
  public character: number;
  public constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  public compareTo(x: Position) : number {
    if(this.isBefore(x))
      return -1;
    else if(this.isEqual(x))
      return 0;
    else
      return 1;
  }

  public translate(lineDelta?: number, characterDelta?: number): Position;
  public translate(change: { lineDelta?: number; characterDelta?: number; }): Position;
  public translate(arg1?, arg2?) : Position {
  if(typeof arg1 === 'object') {
      const change = arg1 as { lineDelta?: number; characterDelta?: number; };
      return new Position(this.line+(change.lineDelta||0), this.character+(change.characterDelta||0));
    }
    else {
      const lineDelta = arg1 as number;
      const characterDelta = arg2 as number;
      return new Position(this.line+lineDelta, this.character+characterDelta);
    }
  }

  public isEqual(x: Position) : boolean {
    return this.line === x.line && this.character === x.character;
  }

  public isBefore(x: Position) : boolean {
    return this.line < x.line || (this.line === x.line && this.character < x.character);
  }

  public isAfter(x: Position) : boolean {
    return this.line > x.line || (this.line === x.line && this.character > x.character);
  }

  public isBeforeOrEqual(x: Position) : boolean {
    return this.isBefore(x) || this.isEqual(x);
  }

  public isAfterOrEqual(x: Position) : boolean {
    return this.isAfter(x) || this.isEqual(x);
  }

  public with(line?: number, character?: number): Position;
  public with(change: { line?: number; character?: number; }): Position;
  public with(arg1?, arg2?) {
    if(typeof arg1 === 'object') {
      const change = arg1 as { line?: number; character?: number; };
      return new Position(change.line===undefined ? this.line : change.line as number, change.character===undefined ? this.character : change.character as number)
    } else {
      return new Position(arg1===undefined ? this.line : arg1 as number, arg2===undefined ? this.character : arg2 as number)
    }
  }
  
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;
  public readonly isEmpty : boolean;
  public readonly isSingleLine : boolean;
  public constructor(start: Position, end: Position);
  public constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  public constructor(arg1: number|Position, arg2: number|Position, arg3?: number, arg4?: number) {
    if(typeof arg1 === 'number') {
      this.start = new Position(arg1, arg2 as number);
      this.end = new Position(arg3 as number, arg4 as number);
    } else {
      this.start = arg1;
      this.end = arg2 as Position;
    }
    this.isEmpty = this.start.isEqual(this.end);
    this.isSingleLine = this.start.line === this.end.line;
  }

	public contains(positionOrRange: Position | Range): boolean {
    if(Object.hasOwnProperty.call(positionOrRange, 'line'))
      return this.start.isBeforeOrEqual(positionOrRange as Position) && this.end.isAfter(positionOrRange as Position);
    else
      return this.start.isBeforeOrEqual((positionOrRange as Range).start) && this.end.isAfterOrEqual((positionOrRange as Range).end);
  }

  public isEqual(other: Range): boolean {
    return this.start.isEqual(other.start) && this.end.isEqual(other.end);
  }

	public intersection(range: Range): Range {
    if(this.start.isBeforeOrEqual(range.start)) {
      if(this.end.isAfterOrEqual(range.end))
        return new Range(range.start,range.end);
      else if(this.end.isAfterOrEqual(range.start))
        return new Range(range.start,this.end);
      else 
        return undefined;
    } else
      return range.intersection(this)
  }

	public union(other: Range): Range {
    return new Range(this.start.isBefore(other.start) ? this.start : other.start, this.end.isAfter(other.end) ? this.end : other.end);
  }

		/**
		 * Derived a new range from this range.
		 *
		 * @param start A position that should be used as start. The default value is the [current start](#Range.start).
		 * @param end A position that should be used as end. The default value is the [current end](#Range.end).
		 * @return A range derived from this range with the given start and end position.
		 * If start and end are not different `this` range will be returned.
		 */
	public with(start?: Position, end?: Position): Range;
	public with(change: { start?: Position, end?: Position }): Range;  
  public with(arg1?, arg2?) : Range {
    if(arg1===undefined || arg1.hasOwnPropert('line'))
      return new Range(arg1===undefined ? this.start : arg1 as Position, arg2===undefined ? this.end : arg2 as Position)
    else {
      const change = arg1 as { start?: Position, end?: Position };
      return new Range(change.start || this.start, change.end || this.end);
    }
  }
}