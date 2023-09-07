

export interface MatchResult {
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
export function *iterateMatches(str: string, re: RegExp, start?: number) : IterableIterator<MatchResult> {
  re.lastIndex = start===undefined ? 0 : start;
  let match : RegExpExecArray;
  while((match = re.exec(str))) {
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

export function *iterateMatchArray(str: string, res: RegExp[], start?: number) : IterableIterator<MatchResult> {
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
    matchIdx = matches.findIndex(m => m && m.length > 1);
  }
}

export function *mapIterator<T1,T2>(iter: IterableIterator<T1>, f: (x:T1)=>T2, current?: IteratorResult<T1>) : IterableIterator<T2> {
  if(!current)
    current = iter.next();
  while(!current.done) {
    current = iter.next(yield f(current.value));
  }
}

