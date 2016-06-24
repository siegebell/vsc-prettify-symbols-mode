# Prettify Symbols Mode

[Prettify Symbols Mode](https://www.emacswiki.org/emacs/PrettySymbol) for [Visual Studio Code (^1.2.x)](https://code.visualstudio.com).

Prettify symbols mode makes *visual* substitutions to your source code, e.g. displaying `fun` as `λ`, while never touching your code itself.

## Configuration

Once you have installed this extension, modify  `settings.json` to add language-specific substitutions. For example, the following settings will target F# files, and will make the following substitutions: `fun` -> `λ` and `=>` -> `⇒`.
```json
"prettifySymbolsMode.substitutions": [{
    "language": "fsharp",
    "substitutions": [
      { "ugly": "fun", "pretty": "λ", "pre": "\\b", "post": "\\b" },
      { "ugly": "=>", "pretty": "⇒" }
    ]
}]
```

Substitutions work by matching any string that satisfies the `"ugly"` pattern and visually replacing it with `"pretty"`; you can optionally specify the context by providing `"pre"` and `"post"` regular expressions that must be matched for the substitution to occur. You can also target multiple languages or glob patterns at once via `"languages": ["fsharp", {"pattern":  "**/*.txt"}]`.

## Known issues: *beta!*

* The substitutions do not preserve syntax coloring.
* Cursor movement goes *underneath* the substitution and the cursor will disappear.
  - you can fix cursor movement by respectively binding the left (+shift) and right (+shift) arrow keys to "extension.prettyCursorLeft", "extension.prettyCursorSelectLeft", "extension.prettyCursorRight", and "extension.prettyCursorSelectRight". However, you may notice more lag in cursor movement because of an ongoing issue with vscode.
* This extension is only available for ~version 1.2.x of vscode (currently an "insider" build).
