// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// const proxyquire =  require('proxyquire').noCallThru();
// const textMateModule = path.join(require.main.filename, '../../node_modules/vscode-textmate/release/main.js');
// let mockModules = {};
// mockModules['vscode'] = {extname: function(file){return './vscode-shunt'}, '@global': true};
// mockModules[textMateModule] = {extname: function(file){return './vscode-shunt'}, '@global': true};
// const tm = proxyquire('../src/text-mate', mockModules);
import * as tm from '../../src/text-mate';

// Defines a Mocha test suite to group tests of similar kind together
suite("text-mate", () => {
  function mt(x,y,s) {
    return {startIndex: x, endIndex: y, scopes: s.split(' ')}
  }
	test("combineIdenticalTokenScopes", () => {
    function test(x,y) {
      assert.deepStrictEqual(tm.combineIdenticalTokenScopes(x), y);
    }
    test([], []);
    test([mt(0,2,"a b")], [mt(0,2,"a b")]);
    test([mt(0,2,"a b"), mt(2,4,"a b")], [mt(0,4,"a b")]);
    test([mt(0,2,"a b"), mt(3,4,"a b")], [mt(0,2,"a b"),mt(3,4,"a b")]);
    test([mt(0,2,"c b"), mt(2,4,"a b")], [mt(0,2,"c b"), mt(2,4,"a b")]);
    test([mt(0,2,"a b"), mt(2,4,"a b"), mt(4,6,"a b")], [mt(0,6,"a b")]);
    test([mt(0,2,"a b"), mt(2,4,"a b"), mt(4,6,"c a b")], [mt(0,4,"a b"),mt(4,6,"c a b")]);
    test([mt(0,2,"a b"), mt(2,4,"c a b"), mt(4,6,"c a b")], [mt(0,2,"a b"),mt(2,6,"c a b")]);
    test([mt(0, 4, "source.fsharp"),mt(4, 5, "source.fsharp constant.numeric.integer.nativeint.fsharp"),mt(5, 6, "source.fsharp"),mt(6, 45, "source.fsharp comment.line.double-slash.fsharp")],
      [mt(0, 4, "source.fsharp"),mt(4, 5, "source.fsharp constant.numeric.integer.nativeint.fsharp"),mt(5, 6, "source.fsharp"),mt(6, 45, "source.fsharp comment.line.double-slash.fsharp")]);
	});
});