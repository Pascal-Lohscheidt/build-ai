import { render } from 'solid-js/web';
import AiCursorComponent, { Props as AiCursorProps } from './AiCursorComponent';
import { createComponent } from 'solid-js';
/**
 * The AI Cursor is a SolidJS component.
 * Why solid js?
 * solid js is tiny on memory and bundle size. Fast to render.
 *
 * And it is more commonly known than most Web Component libraries.
 * Downside?
 * We have to be way more careful when we scope designs.
 *
 * Longterm Goal? replace this with a Web Component. Preferably with Lit.
 */

export const mountAiCursor = (aiCursorProps: AiCursorProps): void => {
  const root = document.body;

  return;
  if (root) {
    render(() => createComponent(AiCursorComponent, aiCursorProps), root);
  }
};
