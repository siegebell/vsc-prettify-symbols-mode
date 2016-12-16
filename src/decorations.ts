import * as vscode from 'vscode';
import {Substitution, UglyRevelation, LanguageEntry, PrettyCursor, PrettyStyleProperties, PrettyStyle, assignStyleProperties, HideTextMethod} from './configuration';

export function makePrettyDecoration_fontSize_hack(prettySubst: Substitution) {
  const showAttachmentStyling = '; font-size: 1000em';

  let styling : vscode.DecorationRenderOptions = { before: {}, dark: {before: {}}, light: {before: {}} };
  if(prettySubst.style) {
    assignStyleProperties(styling.before, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark.before, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light.before, prettySubst.style.light);
  }
  styling.before.contentText = prettySubst.pretty;

  // Use a dirty hack to change the font size (code injection)
  styling.before.textDecoration = (styling.before.textDecoration || 'none') + showAttachmentStyling;
  // and make sure the user's textDecoration does not break our hack
  if(styling.light.before.textDecoration)
    styling.light.before.textDecoration = styling.light.before.textDecoration + showAttachmentStyling;
  if(styling.dark.before.textDecoration)
    styling.dark.before.textDecoration = styling.dark.before.textDecoration + showAttachmentStyling;

  return vscode.window.createTextEditorDecorationType(styling);
}

export function makePrettyDecoration_letterSpacing_hack(prettySubst: Substitution) {
  const showAttachmentStyling = '; font-size: 10em; letter-spacing: normal; visibility: visible';

  let styling : vscode.DecorationRenderOptions = { after: {}, dark: {after: {}}, light: {after: {}} };
  if(prettySubst.style) {
    assignStyleProperties(styling.after, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark.after, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light.after, prettySubst.style.light);
  }
  styling.after.contentText = prettySubst.pretty;

  // Use a dirty hack to change the font size (code injection)
  styling.after.textDecoration = (styling.after.textDecoration || 'none') + showAttachmentStyling;
  // and make sure the user's textDecoration does not break our hack
  if(styling.light.after.textDecoration)
    styling.light.after.textDecoration = styling.light.after.textDecoration + showAttachmentStyling;
  if(styling.dark.after.textDecoration)
    styling.dark.after.textDecoration = styling.dark.after.textDecoration + showAttachmentStyling;

  return vscode.window.createTextEditorDecorationType(styling);
}

export function makePrettyDecoration_noPretty(prettySubst: Substitution) {
  const showAttachmentStyling = '';

  let styling : vscode.DecorationRenderOptions = { dark: {}, light: {} };
  if(prettySubst.style) {
    assignStyleProperties(styling, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light, prettySubst.style.light);
  }

  return vscode.window.createTextEditorDecorationType(styling);
}

export function makePrettyDecoration_noHide(prettySubst: Substitution) {
  const showAttachmentStyling = '';

  let styling : vscode.DecorationRenderOptions = { after: {}, dark: {after: {}}, light: {after: {}} };
  if(prettySubst.style) {
    assignStyleProperties(styling.after, prettySubst.style);
    if(prettySubst.style.dark)
      assignStyleProperties(styling.dark.after, prettySubst.style.dark);
    if(prettySubst.style.light)
      assignStyleProperties(styling.light.after, prettySubst.style.light);
  }
  styling.after.contentText = prettySubst.pretty;

  // Use a dirty hack to change the font size (code injection)
  styling.after.textDecoration = (styling.after.textDecoration || 'none') + showAttachmentStyling;
  // and make sure the user's textDecoration does not break our hack
  if(styling.light.after.textDecoration)
    styling.light.after.textDecoration = styling.light.after.textDecoration + showAttachmentStyling;
  if(styling.dark.after.textDecoration)
    styling.dark.after.textDecoration = styling.dark.after.textDecoration + showAttachmentStyling;

  return vscode.window.createTextEditorDecorationType(styling);
}


export function makeDecorations_fontSize_hack() {
  return {
    uglyDecoration: vscode.window.createTextEditorDecorationType({
      textDecoration: 'none; font-size: 0.001em',
    }),
    revealedUglyDecoration: vscode.window.createTextEditorDecorationType({
      textDecoration: 'none; font-size: inherit !important',
      before: {
        textDecoration: 'none; font-size: 0pt',
      }
    }),
    boxedSymbolDecoration: vscode.window.createTextEditorDecorationType({
      before: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    }),
  }
}

export function makeDecorations_letterSpacing_hack() {
  return {
    uglyDecoration: vscode.window.createTextEditorDecorationType({
      letterSpacing: "-0.55em; font-size: 0.1em; visibility: hidden",
    }),
    revealedUglyDecoration: vscode.window.createTextEditorDecorationType({
      letterSpacing: "normal !important; font-size: inherit !important; visibility: visible !important",
      after: {
        textDecoration: 'none; font-size: 0pt; display: none',
      }
    }),
    boxedSymbolDecoration: vscode.window.createTextEditorDecorationType({
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    }),
  }
}

export function makeDecorations_none() {
  return {
    uglyDecoration: vscode.window.createTextEditorDecorationType({}),
    revealedUglyDecoration: vscode.window.createTextEditorDecorationType({
      textDecoration: 'none; font-size: inherit !important',
      after: {
        textDecoration: 'none; font-size: 0pt',
      }
    }),
    boxedSymbolDecoration: vscode.window.createTextEditorDecorationType({
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    }),
  }

}