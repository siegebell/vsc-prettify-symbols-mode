import * as vscode from 'vscode';
import {Substitution, assignStyleProperties, } from './configuration';

export function makePrettyDecoration_fontSize_hack(prettySubst: Substitution) {
  const showAttachmentStyling = '';

  const styling : vscode.DecorationRenderOptions = {
    after: {},
    dark: {after: {}},
    light: {after: {}},
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  };
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

export function makePrettyDecoration_letterSpacing_hack(prettySubst: Substitution) {
  // const showAttachmentStyling = '; font-size: 10em; letter-spacing: normal; visibility: visible';
  const showAttachmentStyling = '; letter-spacing: normal; visibility: visible';

  const styling : vscode.DecorationRenderOptions = {
    after: {},
    dark: {after: {}},
    light: {after: {}},
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
 };
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
  //const showAttachmentStyling = '';

  const styling : vscode.DecorationRenderOptions = {
    dark: {},
    light: {},
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  };
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

  const styling : vscode.DecorationRenderOptions = {
    after: {},
    dark: {after: {}},
    light: {after: {}},
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  };
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
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    }),
    revealedUglyDecoration: vscode.window.createTextEditorDecorationType({
      textDecoration: 'none; font-size: inherit !important',
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        textDecoration: 'none; font-size: 0pt',
      }
    }),
    boxedSymbolDecoration: {
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    },
  }
}

export function makeDecorations_letterSpacing_hack() {
  return {
    uglyDecoration: vscode.window.createTextEditorDecorationType({
      letterSpacing: "-0.55em; font-size: 0.1em; visibility: hidden",
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    }),
    revealedUglyDecoration: vscode.window.createTextEditorDecorationType({
      letterSpacing: "normal !important; font-size: inherit !important; visibility: visible !important",
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        // letterSpacing: '-0.55em; font-size: 0.1pt; visibility: hidden',
        textDecoration: 'none !important; font-size: 0.1pt !important; visibility: hidden',
      }
    }),
    boxedSymbolDecoration: {
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    },
  }
}

export function makeDecorations_none() {
  return {
    uglyDecoration: vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,      
    }),
    revealedUglyDecoration: vscode.window.createTextEditorDecorationType({
      textDecoration: 'none; font-size: inherit !important',
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        textDecoration: 'none; font-size: 0pt',
      }
    }),
    boxedSymbolDecoration: {
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        border: '0.1em solid',
        margin: '-0em -0.05em -0em -0.1em',
      }
    },
  }

}