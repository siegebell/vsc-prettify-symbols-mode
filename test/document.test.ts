// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as pdoc from '../src/document';


// Defines a Mocha test suite to group tests of similar kind together
suite("PrettyDocumentController", () => {
	let doc : pdoc.PrettyDocumentController;
	// beforeEach(function() {
	// 	const textDoc = vscode.TextDocument();

	// 	doc = new pdoc.PrettyDocumentController(textDoc, langSettings, opts);
	// })

	// Defines a Mocha unit test
});