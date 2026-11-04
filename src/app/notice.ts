// MOD-App — what CMP-Notice shows. The text is produced on render, so a language switch re-renders
// the visible notice in the new language (CMP-Notice "Behavior", F-018).
import type { MessageId, MessageParams } from '../copy';

/** A COPY ID whose text has no placeholders (a notice action's label). */
export type LabelId = { [K in MessageId]: MessageParams[K] extends undefined ? K : never }[MessageId];

export type NoticeKind = 'success' | 'error' | 'progress';

export interface Notice {
  readonly kind: NoticeKind;
  /** The COPY ID of the message (without `COPY-`). */
  readonly id: MessageId;
  /** The message in the active language. */
  text(): string;
  /** CMP-Notice "Anatomy": an optional action (e.g. COPY-action.download after COPY-error.clipboard). */
  readonly action?: { readonly label: LabelId; run(): void };
}
