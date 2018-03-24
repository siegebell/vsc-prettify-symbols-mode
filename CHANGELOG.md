## 0.4.1
* fix #33: vscode has removed vscode-text (see https://github.com/Microsoft/vscode/issues/46281)
* fix #34, #30, #28: symbols are displayed very large.

## 0.4.0
* feature: copy "pretty" text - copy with substitutions (#22)
* fix #21: combining tokens is too eager
* fix #20: swap-line (and other big edits) breaks symbols
* fix #23: commands should be prefixed with "prettifySymbolsMode"; not "extension"

## 0.3.1
* new language entry settings
    * `combineIdenticalScopes` - if `true`, combine adjacent tokens with identical scopes (resolve #18)
* fix #16: Error at extension loading

## 0.3.0
* Better method to hide substituted text, fixing #4 #5
    * new mode (default): "prettifySymbolsMode.hideTextMethod": "hack-letterSpacing"
    * old mode: "prettifySymbolsMode.hideTextMethod": "hack-fontSize"
    * do not hide substituted text: "prettifySymbolsMode.hideTextMethod": "none"
* TextMate Scopes - substitutions can be constrained within tokens that match a scope expression
    * language entry setting: `"textMateGrammar"` - specify a TextMate grammar file for tokenization; if unspecified, then attempt to find one automatically
    * language entry setting: `"textMateInitialScope"` - the initial scope; if unspecified, then attempt to infer automatically
* Styling - `"pretty"` can be omitted if `"style"` is specified: applies a style to the "ugly" matches.
* fix #4: cursor disappears at substitution symbol
* fix #5: clicking a substitution symbol loses editor focus
* New API for other extensions:
    * detect when PSM is enabled/disabled
    * dynamically register more substitutions