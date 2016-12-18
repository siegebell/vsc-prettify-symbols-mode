// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
const proxyquire =  require('proxyquire').noCallThru();

// import * as vscode from './vscode-shunt';
// const pm = proxyquire('../src/PrettyModel', {'vscode': {extname: function(file){return './vscode-shunt'}, '@global': true}});
import * as vscode from 'vscode';
import * as pm from '../src/PrettyModel';

class MockDocumentModel {
  constructor(public lines: string[]) {}
  public getLine(line:number) {
    return this.lines[line];
  }
  public getLineRange(line:number) {
    return new vscode.Range(line,0,line,this.lines[line].length);
  }
  public getLineCount() {
    return this.lines.length
  }
  public validatePosition(p: vscode.Position) {
    const line = Math.max(0,Math.min(this.lines.length-1, p.line));
    const character = Math.max(0,Math.min(this.lines[line].length-1, p.character));
    return new vscode.Position(line,character);
  }
  public validateRange(r: vscode.Range) {
    return new vscode.Range(this.validatePosition(r.start), this.validatePosition(r.end))
  }
}

// Defines a Mocha test suite to group tests of similar kind together
suite("PrettyModel", () => {
  const langFun = {
    language: "plaintext",
    substitutions: [{ugly: "fun", pretty: "λ"}],
    combineIdenticalScopes: false,
  }

  function assertDecs(actual: pm.UpdateDecorationEntry[], expected: vscode.Range[][]) {
    assert.equal(actual.length, expected.length);
    actual.forEach((a,idx) => assert.deepStrictEqual(a.ranges, expected[idx]))
  }

  function range(a,b,c,d) {
    return new vscode.Range(a,b,c,d);
  }

	test("new", () => {
    const doc = new MockDocumentModel(["aa", "_fun"]);
    const m = new pm.PrettyModel(doc, langFun, {hideTextMethod: "hack-fontSize"})
    assertDecs(m.getDecorationsList(), [[range(1,1,1,4)], [range(1,1,1,4)]])
	});

	test("reparsePretties", () => {
    const doc = new MockDocumentModel(["aa\r\n", "_fun\r\n"]);
    const m = new pm.PrettyModel(doc, langFun, {hideTextMethod: "hack-fontSize"})
    assertDecs(m.getDecorationsList(), [[range(1,1,1,4)], [range(1,1,1,4)]])
    doc.lines = ["_fun\r\n", "aa\r\n"];
    m['reparsePretties'](range(0,0,1,4));
    assertDecs(m.getDecorationsList(), [[range(0,1,0,4)], [range(0,1,0,4)]])
	});

	test("applyChanges - in parts", () => {
    const doc = new MockDocumentModel(["aa\r\n", "_fun\r\n"]);
    const m = new pm.PrettyModel(doc, langFun, {hideTextMethod: "hack-fontSize"})
    doc.lines = ["aa\r\n"];
    m.applyChanges([{range: range(0,2,1,4), text: ""}]);
    assertDecs(m.getDecorationsList(), [[], []])
    doc.lines = ["_fun\r\n", "aa\r\n"];
    m.applyChanges([{range: range(0,0,0,0), text: "_fun"}]);
    assertDecs(m.getDecorationsList(), [[range(0,1,0,4)], [range(0,1,0,4)]])
	});

	test("applyChanges - in sum", () => {
    const doc = new MockDocumentModel(["aa\r\n", "_fun\r\n"]);
    const m = new pm.PrettyModel(doc, langFun, {hideTextMethod: "hack-fontSize"})
    doc.lines = ["_fun\r\n", "aa\r\n"];
    m.applyChanges([{range: range(0,2,1,4), text: ""}, {range: range(0,0,0,0), text: "_fun"}]);
    assertDecs(m.getDecorationsList(), [[range(0,1,0,4)], [range(0,1,0,4)]])
	});

});