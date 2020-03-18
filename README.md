# Conceal for VSCode

Conceal makes *visual* substitutions to your source code, e.g. displaying `fun` as `λ`, while never touching your code.

This feature is inspired by [prettify-symbols-mode for Emacs](https://www.emacswiki.org/emacs/PrettySymbol) and is the unofficial successor of [vsc-prettify-symbols-mode](https://github.com/siegebell/vsc-prettify-symbols-mode).


## Configuration

Once you have installed this extension, modify  `settings.json` to add language-specific substitutions. For example, the following settings will target F# files, rendering `fun` as `λ`,  `->` as `⟶`, and place a border around parameters.
```json
"conceal.substitutions": [{
    "language": "fsharp",
    "substitutions": [
      { "ugly": "fun", "pretty": "λ", "scope": "keyword.other.function-definition.fsharp" },
      { "ugly": "->", "pre": "[^->]", "post": "[^->]", "pretty": "⟶" },
      { "ugly": ".+", "scope": "variable.parameter.fsharp", "pre": "^", "post": "$", "style": { "border": "1pt solid green" } }
    ]
}]
```

A substitution matches any string that satisfies the `"ugly"` pattern, visually replacing it with `"pretty"` and/or applying style via `"style"`. You can optionally specify the context by providing `"pre"` or `"post"` regular expressions that must be matched for the substitution to occur. Or you can specify a syntactic scope in which to perform the substitution. You can also target multiple languages or glob patterns at once via `"languages": ["fsharp", {"pattern":  "**/*.txt"}]`.

### Scopes

*Note: scope support is experimental and only available on versions of vscode older than 1.21.1*.

By default, regular expressions match against a whole line of text. If `"scope"` is specified, then regular expression matches will only be performed on the parsed [TextMate] tokens that match the given scope. A small subset of TextMate scope expressions are supported. For example, a substitution with scope `"source.js comment"` will match a token with scope `"text.html.basic source.js comment.block.html"`. A scoped `"ugly"` regular expression must match the entire token by default -- i.e. `"pre"` and `"post"` are respectively set to `"^"` and `"$"` by default when a scope is specified. However, `"pre"` and `"post"` can be overriden to allow multiple substitutions within a single token (e.g. a comment).

*Tip: use [scope-info](https://marketplace.visualstudio.com/items?itemName=siegebell.scope-info) to see the scope assigned to each token in your source.*

### Revealing symbols

By default, "ugly" text will be revealed while contacted by a cursor. You may override this behavior by specifying `"conceal.revealOn"`, or per-language by specifying `"revealOn"` within a language entry. Options are:
* `"cursor"`: reveal while a cursor contacts the symbol (default);
* `"cursor-inside"`: reveal while a cursor is *inside* the symbol;
* `"active-line"`: reveal all symbols while on the same line as a cursor;
* `"selection"`: reveal all symbols while being selected or in contact with a cursor; or
* `"none"`: do not reveal symbols.

### Pretty cursor

By default, any "pretty" symbol that comes into contact with the cursor will be rendered with a box outline around it. This effect is only visible if the "ugly" text is not revealed (e.g. `"revealOn": "none"`). You can control this setting by specifying `"conceal.prettyCursor"`, or per-language by specifying `"prettyCursor"` within a language entry. Options are:
* `"boxed"`: display a box around a symbol (only visible if the "ugly" text is not revealed); or
* `"none"`: do not change the appearance of the symbol.

### Adjust cursor movement

By default, cursor movement will traverse the characters of the "ugly" text -- this will cause it to become invisible while inside the text if it is not revealed (see `"revealOn"`). Setting `"conceal.adjustCursorMovement"` to `true` will tweak cursor movement so that "pretty" symbols behave as a single character. This can be overriden per-language by specifying `"adjustCursorMovement"` in a language entry. In particular, left or right movement will cause the cursor to jump over the symbol instead of going inside. However, this setting does not currently account for all kinds of cursor movement, e.g. up/down.

### Styling

A tiny subset of CSS can be used to apply styling to the substitution text by setting `"style"`; styles can be specialized for light and dark themes. If `"pretty"` is not specified, then`"style"` must be specified: the result being that all "ugly" matches will have the style applied to them instead of being substituted.

* Supported styles: `"border", "backgroundColor", "color", "textDecoration"` (this list is limited by vscode).
* Themed: e.g. `"dark": {"color": "white"}, "light": {"color": "black"}`
* Unsupported styles: e.g. `"hackCSS": "font-style: italic, font-size: 2em"` (this can easily break rendering)

### Regular expressions

This extension uses [Javascript's regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) syntax for `"ugly"`, `"pre"`, and `"post"` (but double-escaped because it is parsed by both JSON and regexp). You must avoid using capturing-groups or mis-parenthesized expressions as it will cause substitutions to behave unpredictably (validation is not performed so you will not receive an error message). 

### Commands

The following commands are available for keybinding:
* `conceal.copyWithSubstitutions`: copy selected text with "pretty" substitutions applied
* `conceal.enablePrettySymbols`: globally *enable* prettify symbols mode
* `conceal.disablePrettySymbols`: globally *disable* prettify symbols mode
* `conceal.togglePrettySymbols`: globally *toggle* prettify symbols mode


### Common settings for `settings.json`

* **Default:** symbols are unfolded as they are traversed by the cursor. 
```json
"conceal.renderOn": "cursor",
"conceal.adjustCursorMovement": false,
```
* Suggested alternative: symbols are never unfolded and generally act like a single character w.r.t. cursor movement. 
```json
"conceal.renderOn": "none",
"conceal.adjustCursorMovement": true,
```

## Variable-width symbols driving you crazy?

Check out [*Monospacifier*](https://github.com/cpitclaudel/monospacifier) to fix your fonts!

![example fix for variable-width fonts](https://github.com/cpitclaudel/monospacifier/blob/master/demo/symbola-loop.gif?raw=true)

**Quick start example:** if your editor font is Consolas, download and install the [XITS Math fallback font for Consolas](https://github.com/cpitclaudel/monospacifier/blob/master/fonts/XITSMath_monospacified_for_Consolas.ttf?raw=true), then add the following to `settings.json`:
```json
  "editor.fontFamily": "Consolas, 'XITS Math monospacified for Consolas', 'Courier New', monospace"
```

## Known issues:

*Tip: [submit new issues on github](https://github.com/BRBoer/vsc-conceal/issues)*
* You can write bad regular expressions that break substitutions and you will not get an error message.
* The substitutions sometimes get into an inconsistent state when editing. To resolve, reenable prettify-symbols-mode -- this will cause the whole document to be reparsed.
* The Live Snippets feature from the LaTeX Utilities extension will not function when `"conceal.adjustCursorMovement"` is set to `true`

## Examples
[See the wiki for more examples &hyphen; and contribute your own!](https://github.com/siegebell/vsc-prettify-symbols-mode/wiki)

The following shows a brief subset of useful substitutions for Haskell, OCaml, and F#:
```json
"conceal.revealOn": "cursor",
"conceal.adjustCursorMovement": false,
"conceal.substitutions": [{
  "language": "haskell",
  "revealOn": "active-line",
  "substitutions": [
    { "ugly": "\\\\",     "pretty": "λ", "post": "\\s*(?:\\w|_).*?\\s*->" },
    { "ugly": "->",       "pretty": "→" },
    { "ugly": "==",       "pretty": "≡" },
    { "ugly": "not\\s?",  "pretty": "¬", "pre": "\\b", "post": "\\b" },
    { "ugly": ">",        "pretty": ">", "pre": "[^=\\-<>]|^", "post": "[^=\\-<>]|$" },
    { "ugly": "<",        "pretty": "<", "pre": "[^=\\-<>]|^", "post": "[^=\\-<>]|$" },
    { "ugly": ">=",       "pretty": "≥", "pre": "[^=\\-<>]|^", "post": "[^=\\-<>]|$" },
    { "ugly": "<=",       "pretty": "≤", "pre": "[^=\\-<>]|^", "post": "[^=\\-<>]|$" }
  ]},{
  "language": ["ocaml", {"pattern": "**/*.{ml}"}],
  "revealOn": "none",
  "adjustCursorMovement": true,
  "substitutions": [
    { "ugly": "fun",            "pretty": "λ", "pre": "\\b", "post": "\\b" },
    { "ugly": "->",             "pretty": "→", "pre": "[^->]", "post": "[^->]" },
    { "ugly": "List[.]for_all", "pretty": "∀", "pre": "\\b", "post": "\\b" },
    { "ugly": "List[.]exists",  "pretty": "∃", "pre": "\\b", "post": "\\b" },
    { "ugly": "List[.]mem",     "pretty": "∈", "pre": "\\b", "post": "\\b" },
    { "ugly": "\\|",            "pretty": "║", "pre": "^\\s+" }
  ]},{
  "language": "fsharp",
  "substitutions": [
    { "ugly": "fun",           "pretty": "λ", "pre": "\\b", "post": "\\b" },
    { "ugly": "->",            "pretty": "→", "pre": "[^->]", "post": "[^->]" },
    { "ugly": "List[.]forall", "pretty": "∀", "pre": "\\b", "post": "\\b" },
    { "ugly": "List[.]exists", "pretty": "∃", "pre": "\\b", "post": "\\b" },
    { "ugly": ">>",            "pretty": "≫", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<<",            "pretty": "≪", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "\\|",           "pretty": "║", "pre": "^\\s+" }
  ]}]
```
