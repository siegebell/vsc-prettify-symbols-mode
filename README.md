# Prettify Symbols Mode

Prettify symbols mode makes *visual* substitutions to your source code, e.g. displaying `fun` as `λ`, while never touching your code itself.

This feature is inspired by [prettify-symbols-mode for Emacs](https://www.emacswiki.org/emacs/PrettySymbol).


## Configuration

Once you have installed this extension, modify  `settings.json` to add language-specific substitutions. For example, the following settings will target F# files, rendering `fun` as `λ` and `->` as `⟶`.
```json
"prettifySymbolsMode.substitutions": [{
    "language": "fsharp",
    "substitutions": [
      { "ugly": "fun", "pretty": "λ", "pre": "\\b", "post": "\\b" },
      { "ugly": "->", "pretty": "⟶" }
    ]
}]
```

Substitutions work by matching any string that satisfies the `"ugly"` pattern and visually replacing it with `"pretty"`; you can optionally specify the context by providing `"pre"` or `"post"` regular expressions that must be matched for the substitution to occur. You can also target multiple languages or glob patterns at once via `"languages": ["fsharp", {"pattern":  "**/*.txt"}]`.

### Revealing symbols

By default, "ugly" text will be revealed while contacted by a cursor. You may override this behavior by specifying `"prettifySymbolsMode.revealOn"`, or per-language by specifying `"revealOn"` within a language entry. Options are:
* `"cursor"`: reveal while a cursor contacts the symbol (default);
* `"cursor-inside"`: reveal while a cursor is *inside* the symbol;
* `"active-line"`: reveal all symbols while on the same line as a cursor;
* `"selection"`: reveal all symbols while being selected or in contact with a cursor; and
* `"none"`: do not reveal symbols.

### Adjust cursor movement

By default, cursor movement will traverse the characters of the "ugly" text -- this will cause it to become invisible while inside the text if it is not revealed (see `"revealOn"`). Setting `"prettifySymbolsMode.adjustCursorMovement"` to `true` will tweak cursor movement so that "pretty" symbols behave as a single character. This can be overriden per-language be specifying `"adjustCursorMovement"` in a language entry. In particular, left or right movement will cause the cursor to jump over the symbol instead of going inside. However, this setting does not currently account for all kinds of cursor movement, e.g. up/down.

### Regular expressions

This extension uses [Javascript's regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp) syntax for `"ugly"`, `"pre"`, and `"post"` (but double-escaped because it is parsed by both JSON and regexp). You must avoid using capturing-groups or mis-parenthesized expressions as it will cause substitutions to behave unpredictably (validation is not performed so you will not receive an error message). 

## Variable-width symbols driving you crazy?

Check out [*Monospacifier*](https://github.com/cpitclaudel/monospacifier) to fix your fonts!

![example fix for variable-width fonts](https://github.com/cpitclaudel/monospacifier/blob/master/demo/symbola-loop.gif?raw=true)

**Quick start example:** if your editor font is Consolas, download and install the [XITS Math fallback font for Consolas](https://github.com/cpitclaudel/monospacifier/blob/master/fonts/XITSMath_monospacified_for_Consolas.ttf?raw=true), then add the following to `settings.json`:
```json
  "editor.fontFamily": "Consolas, 'XITS Math monospacified for Consolas', 'Courier New', monospace"
```

## Known issues:

* The cursor disappears when adjacent-to or inside of a "pretty" symbol. If this is distracting, try setting `"revealOn"` to e.g. `"cursor"`.
* You can write bad regular expressions that break substitutions and you will not get an error message.
* Substitutions are only performed on *open* documents, so you may have to begin editing to activate substitutions.

## Examples

```json
"prettifySymbolsMode.revealOn": "cursor",
"prettifySymbolsMode.adjustCursorMovement": false,
"prettifySymbolsMode.substitutions": [{
  "language": "haskell",
  "revealOn": "active-line",
  "substitutions": [
    { "ugly": "\\\\",     "pretty": "λ", "post": "\\s*(?:\\w|_).*?\\s*->" },
    { "ugly": "<-",       "pretty": "←" },
    { "ugly": "->",       "pretty": "→" },
    { "ugly": "==",       "pretty": "≡" },
    { "ugly": "/=",       "pretty": "≢" },
    { "ugly": "\\(\\)",   "pretty": "∅" },
    { "ugly": "sqrt\\s?", "pretty": "√", "pre": "\\b", "post": "\\b" },
    { "ugly": "&&",       "pretty": "∧" },
    { "ugly": "\\|\\|",   "pretty": "∨" },
    { "ugly": "not\\s?",  "pretty": "¬", "pre": "\\b", "post": "\\b" },
    { "ugly": ">",        "pretty": ">", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<",        "pretty": "<", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": ">=",       "pretty": "≥", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<=",       "pretty": "≤", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "alpha",    "pretty": "α", "pre": "\\b", "post": "\\b" },
    { "ugly": "beta",     "pretty": "β", "pre": "\\b", "post": "\\b" },
    { "ugly": "gamma",    "pretty": "γ", "pre": "\\b", "post": "\\b" },
    { "ugly": "delta",    "pretty": "δ", "pre": "\\b", "post": "\\b" },
    { "ugly": "''",       "pretty": "″" },
    { "ugly": "'",        "pretty": "′" },
    { "ugly": "!!",       "pretty": "‼" },
    { "ugly": "\\.\\.",   "pretty": "…" }
  ]},{
  "language": "ocaml",
  "revealOn": "none",
  "adjustCursorMovement": true,
  "substitutions": [
    { "ugly": "fun",            "pretty": "λ", "pre": "\\b", "post": "\\b" },
    { "ugly": "<-",             "pretty": "←" },
    { "ugly": "->",             "pretty": "→" },
    { "ugly": "=",              "pretty": "=", "pre": "[^<>=!]|^", "post": "[^<>=]|$" },
    { "ugly": "==",             "pretty": "≡" },
    { "ugly": "!=",             "pretty": "≢" },
    { "ugly": "<>",             "pretty": "≠" },
    { "ugly": "\\(\\)",         "pretty": "∅" },
    { "ugly": "sqrt\\s?",       "pretty": "√", "pre": "\\b", "post": "\\b" },
    { "ugly": "&&",             "pretty": "∧" },
    { "ugly": "\\|\\|",         "pretty": "∨" },
    { "ugly": "not\\s?",        "pretty": "¬", "pre": "\\b", "post": "\\b" },
    { "ugly": ">",              "pretty": ">", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<",              "pretty": "<", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": ">=",             "pretty": "≥", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<=",             "pretty": "≤", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "alpha",          "pretty": "α", "pre": "\\b", "post": "\\b" },
    { "ugly": "beta",           "pretty": "β", "pre": "\\b", "post": "\\b" },
    { "ugly": "gamma",          "pretty": "γ", "pre": "\\b", "post": "\\b" },
    { "ugly": "delta",          "pretty": "δ", "pre": "\\b", "post": "\\b" },
    { "ugly": "''",             "pretty": "″" },
    { "ugly": "'",              "pretty": "′" },
    { "ugly": "List[.]for_all", "pretty": "∀", "pre": "\\b", "post": "\\b" },
    { "ugly": "List[.]exists",  "pretty": "∃", "pre": "\\b", "post": "\\b" },
    { "ugly": "List[.]mem",     "pretty": "∈", "pre": "\\b", "post": "\\b" },
    { "ugly": "\\|",            "pretty": "║", "pre": "^\\s+" }
  ]},{
  "language": "fsharp",
  "substitutions": [
    { "ugly": "fun",           "pretty": "λ", "pre": "\\b", "post": "\\b" },
    { "ugly": "<-",            "pretty": "←" },
    { "ugly": "->",            "pretty": "→" },
    { "ugly": "=",             "pretty": "=", "pre": "[^<>=!]|^", "post": "[^<>=]|$" },
    { "ugly": "==",            "pretty": "≡" },
    { "ugly": "!=",            "pretty": "≢" },
    { "ugly": "<>",            "pretty": "≠" },
    { "ugly": "sqrt\\s?",      "pretty": "√", "pre": "\\b", "post": "\\b" },
    { "ugly": "&&",            "pretty": "∧" },
    { "ugly": "\\|\\|",        "pretty": "∨" },
    { "ugly": "not\\s?",       "pretty": "¬", "pre": "\\b", "post": "\\b" },
    { "ugly": ">",             "pretty": ">", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<",             "pretty": "<", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": ">=",            "pretty": "≥", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<=",            "pretty": "≤", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "alpha",         "pretty": "α", "pre": "\\b", "post": "\\b" },
    { "ugly": "beta",          "pretty": "β", "pre": "\\b", "post": "\\b" },
    { "ugly": "gamma",         "pretty": "γ", "pre": "\\b", "post": "\\b" },
    { "ugly": "delta",         "pretty": "δ", "pre": "\\b", "post": "\\b" },
    { "ugly": "''",            "pretty": "″" },
    { "ugly": "'",             "pretty": "′" },
    { "ugly": "List[.]forall", "pretty": "∀", "pre": "\\b", "post": "\\b" },
    { "ugly": "List[.]exists", "pretty": "∃", "pre": "\\b", "post": "\\b" },
    { "ugly": ">>",            "pretty": "≫", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "<<",            "pretty": "≪", "pre": "[^=<>]|^", "post": "[^=<>]|$" },
    { "ugly": "\\|",           "pretty": "║", "pre": "^\\s+" }
  ]}]
```