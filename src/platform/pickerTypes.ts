/**
 * What a system picker hands back.
 *
 * These types are deliberately self-contained: `src/platform` describes device capabilities and
 * knows nothing about the app's `AppError` vocabulary. The feature layer maps an outcome onto an
 * `AppError` (cancellation is not an error, a denial is one) so the platform stays swappable and
 * fakeable.
 */

export interface PickedFile {
  /** Absolute `file://` URI, or a `content://` URI on Android before it is copied. */
  readonly uri: string;
  /** Name the platform supplied, or an empty string when it withheld one. */
  readonly name: string;
  /** MIME as reported by the platform. Empty when unknown; the caller resolves it from the name. */
  readonly mime: string;
  readonly bytes: number;
}

export type PickOutcome =
  | {
      readonly status: 'picked';
      readonly files: readonly PickedFile[];
      /** True when the photo library granted access to a subset of photos only. */
      readonly limited: boolean;
    }
  /** The user backed out. Not an error and never shown as one. */
  | { readonly status: 'cancelled' }
  | { readonly status: 'denied'; readonly limited: boolean }
  | { readonly status: 'failed'; readonly detail: string };
