// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as path from 'path';

const proxyquire =  require('proxyquire').noCallThru();

const textMateModule = path.join(require.main.filename, '../../node_modules/vscode-textmate/release/main.js');
let mockModules = {};
mockModules['vscode'] = {extname: function(file){return './vscode-shunt'}, '@global': true};
mockModules[textMateModule] = {extname: function(file){return './vscode-shunt'}, '@global': true};

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
const tm = proxyquire('../src/text-mate', mockModules);

// Defines a Mocha test suite to group tests of similar kind together
describe("text-mate", () => {
  function mt(x,y,s) {
    return {startIndex: x, endIndex: y, scopes: s.split(' ')}
  }
	it("combineIdenticalTokenScopes", () => {
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([]), []);
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([mt(0,2,"a b")]), [mt(0,2,"a b")]);
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([mt(0,2,"a b"), mt(2,4,"a b")]), [mt(0,4,"a b")]);
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([mt(0,2,"a b"), mt(3,4,"a b")]), [mt(0,2,"a b"),mt(3,4,"a b")]);
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([mt(0,2,"c b"), mt(2,4,"a b")]), [mt(0,2,"c b"), mt(2,4,"a b")]);
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([mt(0,2,"a b"), mt(2,4,"a b"), mt(4,6,"a b")]), [mt(0,6,"a b")]);
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([mt(0,2,"a b"), mt(2,4,"a b"), mt(4,6,"c a b")]), [mt(0,4,"a b"),mt(4,6,"c a b")]);
    assert.deepStrictEqual(tm.combineIdenticalTokenScopes([mt(0,2,"a b"), mt(2,4,"c a b"), mt(4,6,"c a b")]), [mt(0,2,"a b"),mt(2,6,"c a b")]);
	});
});