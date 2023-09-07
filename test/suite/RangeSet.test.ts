// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// const proxyquire =  require('proxyquire').noCallThru();
// import * as vscode from './vscode-shunt';
// const rs = proxyquire('../src/RangeSet', {'vscode': {extname: function(file){return './vscode-shunt'}, '@global': true}});
import * as vscode from 'vscode';
import * as rs from '../../src/RangeSet';

// Defines a Mocha test suite to group tests of similar kind together
suite("RangeSet", () => {

  test("add", function() {
		const x1 = new rs.RangeSet();
		x1.add(new vscode.Range(1,9,1,14));
		x1.add(new vscode.Range(1,20,1,22));
		x1.add(new vscode.Range(1,11,1,18));
		x1.add(new vscode.Range(0,10,1,1));
		assert.deepStrictEqual(x1.getRanges(), [new vscode.Range(0,10,1,1), new vscode.Range(1,9,1,18), new vscode.Range(1,20,1,22)]);
	})

  test("indexAt", function() {
		const x1 = new rs.RangeSet();
		x1.add(new vscode.Range(1,9,1,14)); // 1
		x1.add(new vscode.Range(1,16,1,18)); // 2
		x1.add(new vscode.Range(0,10,1,1)); // 0
		assert.equal(x1['indexAt'](new vscode.Position(0,0)), 0);
		assert.equal(x1['indexAt'](new vscode.Position(1,8)), 0);
		assert.equal(x1['indexAt'](new vscode.Position(1,5)), 0);
		assert.equal(x1['indexAt'](new vscode.Position(1,9)), 1);
		assert.equal(x1['indexAt'](new vscode.Position(1,14)), 1);
		assert.equal(x1['indexAt'](new vscode.Position(1,15)), 1);
		assert.equal(x1['indexAt'](new vscode.Position(1,16)), 2);
		assert.equal(x1['indexAt'](new vscode.Position(1,18)), 2);
		assert.equal(x1['indexAt'](new vscode.Position(1,19)), 2);
	})

	test("getOverlapping - singleton", () => {
		const x1 = new rs.RangeSet();
		const r1 = new vscode.Range(1,9,1,14);
		x1.add(r1);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,9,1,9), {includeTouchingStart: true, includeTouchingEnd: true}), [r1]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,15), {includeTouchingStart: true, includeTouchingEnd: true}), [r1]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(0,1,1,9), {includeTouchingStart: true, includeTouchingEnd: true}), [r1]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,15), {includeTouchingStart: true, includeTouchingEnd: false}), [r1]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,15), {includeTouchingStart: false, includeTouchingEnd: true}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(0,1,1,9), {includeTouchingStart: false, includeTouchingEnd: true}), [r1]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(0,1,1,9), {includeTouchingStart: true, includeTouchingEnd: false}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,15), {includeTouchingStart: false, includeTouchingEnd: false}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(0,1,1,9), {includeTouchingStart: false, includeTouchingEnd: false}), []);
	});

	test("getOverlapping", () => {
		const x1 = new rs.RangeSet();
		const r1 = new vscode.Range(1,9,1,14);
		const r2 = new vscode.Range(1,17,1,20);
		x1.add(r1);
		x1.add(r2);
		// pre
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,0,1,9), {includeTouchingStart: false, includeTouchingEnd: false}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,0,1,9), {includeTouchingStart: true, includeTouchingEnd: false}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,0,1,9), {includeTouchingStart: false, includeTouchingEnd: true}), [r1]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,0,1,9), {includeTouchingStart: true, includeTouchingEnd: true}), [r1]);
		// middle
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,17), {includeTouchingStart: false, includeTouchingEnd: false}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,17), {includeTouchingStart: true, includeTouchingEnd: false}), [r1]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,17), {includeTouchingStart: false, includeTouchingEnd: true}), [r2]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,14,1,17), {includeTouchingStart: true, includeTouchingEnd: true}), [r1,r2]);
		// end
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,20,1,22), {includeTouchingStart: false, includeTouchingEnd: false}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,20,1,22), {includeTouchingStart: true, includeTouchingEnd: false}), [r2]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,20,1,22), {includeTouchingStart: false, includeTouchingEnd: true}), []);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,20,1,22), {includeTouchingStart: true, includeTouchingEnd: true}), [r2]);
		// both
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,10,1,21), {includeTouchingStart: false, includeTouchingEnd: false}), [r1,r2]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,10,1,21), {includeTouchingStart: true, includeTouchingEnd: false}), [r1,r2]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,10,1,21), {includeTouchingStart: false, includeTouchingEnd: true}), [r1,r2]);
		assert.deepStrictEqual(x1.getOverlapping(new vscode.Range(1,10,1,21), {includeTouchingStart: true, includeTouchingEnd: true}), [r1,r2]);
	});

	test("removeOverlapping", () => {
		const r1 = new vscode.Range(1,9,1,14);
		const r2 = new vscode.Range(1,17,1,20);
		function tryRemove(a,b,c,d, options: {includeTouchingStart: boolean, includeTouchingEnd: boolean}, expected, remaining) {
			const x1 = new rs.RangeSet();
			x1.add(r1);
			x1.add(r2);
			const r = x1.removeOverlapping(new vscode.Range(a,b,c,d),options);
			assert.deepStrictEqual(r, expected);
			assert.deepStrictEqual(x1.getRanges(), remaining);
		}
		// pre
		tryRemove(1,0,1,9, {includeTouchingStart: false, includeTouchingEnd: false}, [], [r1,r2]);
		tryRemove(1,0,1,9, {includeTouchingStart: true, includeTouchingEnd: false}, [], [r1,r2]);
		tryRemove(1,0,1,9, {includeTouchingStart: false, includeTouchingEnd: true}, [r1], [r2]);
		tryRemove(1,0,1,9, {includeTouchingStart: true, includeTouchingEnd: true}, [r1], [r2]);
		// middle
		tryRemove(1,14,1,17, {includeTouchingStart: false, includeTouchingEnd: false}, [], [r1,r2]);
		tryRemove(1,14,1,17, {includeTouchingStart: true, includeTouchingEnd: false}, [r1], [r2]);
		tryRemove(1,14,1,17, {includeTouchingStart: false, includeTouchingEnd: true}, [r2], [r1]);
		tryRemove(1,14,1,17, {includeTouchingStart: true, includeTouchingEnd: true}, [r1,r2], []);
		// end
		tryRemove(1,20,1,22, {includeTouchingStart: false, includeTouchingEnd: false}, [], [r1,r2]);
		tryRemove(1,20,1,22, {includeTouchingStart: true, includeTouchingEnd: false}, [r2], [r1]);
		tryRemove(1,20,1,22, {includeTouchingStart: false, includeTouchingEnd: true}, [], [r1,r2]);
		tryRemove(1,20,1,22, {includeTouchingStart: true, includeTouchingEnd: true}, [r2], [r1]);
		// both
		tryRemove(1,10,1,21, {includeTouchingStart: false, includeTouchingEnd: false}, [r1,r2], []);
		tryRemove(1,10,1,21, {includeTouchingStart: true, includeTouchingEnd: false}, [r1,r2], []);
		tryRemove(1,10,1,21, {includeTouchingStart: false, includeTouchingEnd: true}, [r1,r2], []);
		tryRemove(1,10,1,21, {includeTouchingStart: true, includeTouchingEnd: true}, [r1,r2], []);
	});

});