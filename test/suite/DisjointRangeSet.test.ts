// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// import * as vscode from './vscode-shunt';
// const drs = proxyquire('../src/DisjointRangeSet', {'vscode': {extname: function(file){return './vscode-shunt'}, '@global': true}});
import * as vscode from 'vscode';
import * as drs from '../../src/DisjointRangeSet';


// Defines a Mocha test suite to group tests of similar kind together
suite("DisjointRangeSet", () => {

	// Defines a Mocha unit test
	test("insert", () => {
		const x1 = new drs.DisjointRangeSet();
		const r1 = new vscode.Range(1,9,1,14);
		const r2 = new vscode.Range(1,14,1,16);
		assert.strictEqual(x1.insert(r1), true);
		assert.strictEqual(x1.insert(r1), false);
		assert.strictEqual(x1.insert(new vscode.Range(1,9,1,10)), false);
		assert.strictEqual(x1.insert(new vscode.Range(1,9,1,20)), false);
		assert.strictEqual(x1.insert(new vscode.Range(0,0,1,20)), false);
		assert.deepStrictEqual(x1.getRanges(), [r1]);
		assert.strictEqual(x1.insert(r2), true);
		assert.deepStrictEqual(x1.getRanges(), [r1,r2]);
	});
});