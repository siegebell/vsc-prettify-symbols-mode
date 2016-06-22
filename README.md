# Prettify Symbols Mode

[Prettify Symbols Mode](https://www.emacswiki.org/emacs/PrettySymbol) for [Visual Studio Code](https://www.google.com/url?sa=t&rct=j&q=&esrc=s&source=web&cd=4&cad=rja&uact=8&ved=0ahUKEwiW5sbU_LfNAhUDVz4KHXUGBpYQFggtMAM&url=https%3A%2F%2Fcode.visualstudio.com%2F&usg=AFQjCNFJKyN71_pTGlo3tbjTpAWVghKtHg).

Prettify symbols mode makes *visual* substitutions to your source code, e.g. displaying `fun` as `λ`, while never touching your code itself.

## Configuration

Once you have installed this extension, modify your `settings.json` file to add language-specific substitutions. For example, the following settings will target F# files, and will make the following substitutions: `fun` -> `λ`, `=>` -> `⇒`, and `->` -> `⟶`.
```json
"prettifySymbolsMode.substitutions": [
  {
    "language": "fsharp",
    "substitutions": [
      { "ugly": "fun", "pretty": "λ", "pre": "\\b", "post": "\\b" },
      { "ugly": "[=][>]", "pretty": "⇒" },
      { "ugly": "[-][>]", "pretty": "⟶"  }  ] 
  } ]
```

Substitutions work by matching any string that satisfies the `"ugly"` pattern and visually replacing it with `"pretty"`; you can optionally specify the context by providing `"pre"` and `"post"` regular expressions that must be matched for the substitution to occur. You can also target multiple languages or glob patterns at once via `"languages": ["fsharp", {"pattern":  "**/*.txt"}]`.

## Known issues: *beta!*

* The substitutions do not preserve syntax coloring.
* Cursor movement may be unpredictable around the substitutions.
* This extension is only available for ~version 1.2.x of vscode.
