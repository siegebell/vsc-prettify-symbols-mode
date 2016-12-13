## 0.3.0
* Better method to hide substituted text, fixing #4 #5
    * new mode (default): "prettifySymbolsMode.hideTextMethod": "hack-letterSpacing"
    * old mode: "prettifySymbolsMode.hideTextMethod": "hack-fontSize"
    * do not hide substituted text: "prettifySymbolsMode.hideTextMethod": "none"
* TextMate Scopes - substitutions can be constrained within tokens that match scope expression
    * language entry setting: `"textMateGrammar"` - specify a TextMate grammar file for tokenization; if unspecified, then attempt find one automatically
    * language entry setting: `"textMateInitialScope"` - the initial scope; if unspecified, then attempt infer automatically
* Styling - `"pretty"` can be omitted if `"style"` is specified: applies a style to the "ugly" matches.
* fix #4: cursor disappears at substitution symbol
* fix #5: clicking a substitution symbol loses editor focus
* New API for other extensions:
    * detect when PSM is enabled/disabled
    * dynamically register more substitutions