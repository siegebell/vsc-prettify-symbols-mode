## 0.3.0
* Better method to hide substituted text, fixing #4 #5
    * new mode (default): "prettifySymbolsMode.hideTextMethod": "hack-letterSpacing"
    * old mode: "prettifySymbolsMode.hideTextMethod": "hack-fontSize"
    * do not hide substituted text: "prettifySymbolsMode.hideTextMethod": "none"
* fix #4: cursor disappears at substitution symbol
* fix #5: clicking a substitution symbol loses editor focus
* New API for other extensions:
    * detect when PSM is enabled/disabled
    * dynamically register more substitutions