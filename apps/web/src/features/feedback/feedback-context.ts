/** Where in the app a report comes from: sent along, so an administrator can find the problem. */
export interface FeedbackContext {
  /** The app's own path, `/books/bk_1?shelf=sh_2`. */
  pageUrl: string;
  /** The release and the build's commit, `1.4 · 2ee4ac0` (`dev` outside Vercel). */
  appVersion: string;
  /** The window's size in CSS pixels, `390×844`. */
  viewport: string;
}

export interface ViewportSize {
  innerWidth: number;
  innerHeight: number;
}

export function describeFeedbackContext(
  pagePath: string,
  appVersion: string,
  { innerWidth, innerHeight }: ViewportSize
): FeedbackContext {
  return { pageUrl: pagePath, appVersion, viewport: `${innerWidth}×${innerHeight}` };
}
