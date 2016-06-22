import * as vscode from 'vscode';
import {Substitution} from './configuration';

function moveLeft(pos: vscode.Position, doc: vscode.TextDocument) : vscode.Position {
  if(pos.character == 0) {
		if(pos.line == 0)
		  return pos;
		else
			return doc.lineAt(pos.line-1).range.end;
	} else
	  return pos.translate(0,-1);
}

function moveRight(pos: vscode.Position, doc: vscode.TextDocument) : vscode.Position {
  if(pos.character >= doc.lineAt(pos.line).range.end.character)
	  return doc.validatePosition(new vscode.Position(pos.line+1, 0));
	else
    return pos.translate(0,1);
}

function moveUp(pos: vscode.Position, doc: vscode.TextDocument) : vscode.Position {
  if(pos.line == 0)
	  return pos.with({character: 0});
	else
    return doc.validatePosition(pos.translate(-1,0));
}

function moveDown(pos: vscode.Position, doc: vscode.TextDocument) : vscode.Position {
  return doc.validatePosition(pos.translate(1,0));
}

function movePosition(pos: vscode.Position, doc: vscode.TextDocument, direction: string) {
	switch(direction) {
		case 'left':  return moveLeft(pos,doc);
		case 'right': return moveRight(pos,doc);
		case 'up':    return moveUp(pos,doc);
		case 'down':  return moveDown(pos,doc);
		default:      return doc.validatePosition(pos);
	}

}

export function adjustCaretLeft(cursorPos: vscode.Position, uglyDecorationRanges, doc: vscode.TextDocument) {
	let newCursorPos = moveLeft(cursorPos, doc);
  try {
		const match = findInSortedRanges(newCursorPos, uglyDecorationRanges, {excludeStart: true, excludeEnd: true});
		if(match)
  		return {pos: match.range.start, range: match.range };
	} catch(e) {}
	return {pos: newCursorPos, range: undefined };
}

export function adjustCaretRight(cursorPos: vscode.Position, uglyDecorationRanges, doc: vscode.TextDocument) {
	let newCursorPos = moveRight(cursorPos, doc);
  try {
		const match = findInSortedRanges(newCursorPos, uglyDecorationRanges, {excludeStart: true, excludeEnd: false});
		if(match)
  		return {pos: match.range.end, range: match.range };
	} catch(e) {}
	return {pos: newCursorPos, range: undefined };
}


export function adjustCaret(cursorPos: vscode.Position, doc: vscode.TextDocument, uglyDecorationRanges, direction: string) {
	let newCursorPos = movePosition(cursorPos, doc, direction);
  try {
		const match = findInSortedRanges(newCursorPos, uglyDecorationRanges, {excludeStart: true, excludeEnd: true});
		if(match)
  		return {pos: match.range.start, range: match.range };
	} catch(e) {}
	return {pos: newCursorPos, range: undefined };
}


// function findClosestInPrettyDecorations(pos: vscode.Position, prettySubsts: PrettySubstitution[], options: {excludeStart?: boolean, excludeEnd?: boolean} = {excludeStart: false, excludeEnd: false}) {
// 	for(let prettyIdx = 0; prettyIdx < prettySubsts.length; ++prettyIdx) {
// 		const subst = prettySubsts[prettyIdx];
// 		let match = findClosestInSortedRanges(pos,subst.preRanges,options);
// 		if(match)
// 		  return {range:match.range,index:match.index,prettyIndex:prettyIdx,pre: true};
// 		match = findClosestInSortedRanges(pos,subst.postRanges,options);
// 		if(match)
// 		  return {range:match.range,index:match.index,prettyIndex:prettyIdx,pre:false};		
// 	}
// 	return undefined;
// }

function findInSortedRanges(pos: vscode.Position, ranges: vscode.Range[], options: {excludeStart?: boolean, excludeEnd?: boolean} = {excludeStart: false, excludeEnd: false}) : {range:vscode.Range,index:number} {
	const exclStart = options.excludeStart || false;
	const exclEnd = options.excludeEnd || false;
	let begin = 0;
	let end = ranges.length;
	while(begin < end) {
		const idx = Math.floor((begin + end)/2);
		const range = ranges[idx];
		if(range.contains(pos) && !(exclStart && range.start.isEqual(pos)) && !(exclEnd && range.end.isEqual(pos)))
		  return {range: range, index: idx};
		else if(pos.isBefore(range.start))
			end = idx;
		else
		  begin = idx+1;
	}
	return undefined;
}

function findClosestInSortedRanges(pos: vscode.Position, ranges: vscode.Range[], options: {excludeStart?: boolean, excludeEnd?: boolean} = {excludeStart: false, excludeEnd: false}) : {range:vscode.Range,index:number} {
	const exclStart = options.excludeStart || false;
	const exclEnd = options.excludeEnd || false;
	let begin = 0;
	let end = ranges.length;
	while(begin < end) {
		const idx = Math.floor((begin + end)/2);
		const range = ranges[idx];
		if(range.contains(pos) && !(exclStart && range.start.isEqual(pos)) && !(exclEnd && range.end.isEqual(pos)))
		  return {range: range, index: idx};
		else if(pos.isBefore(range.start))
			end = idx;
		else
		  begin = idx+1;
	}

  for(let idx = begin; idx < ranges.length; ++idx) {
		const range = ranges[idx];
		if(range.start.isAfterOrEqual(pos) && !(exclStart && range.start.isEqual(pos)))
		  return {range: range, index: idx};
	}
  return undefined;
}