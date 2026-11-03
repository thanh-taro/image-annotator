// MOD-App — what CMP-Notice shows. The text is produced on render, so a language switch re-renders
// the visible notice in the new language (CMP-Notice "Behavior", F-018).
import type { MessageId } from '../copy';

export type NoticeKind = 'success' | 'error' | 'progress';

export interface Notice {
  readonly kind: NoticeKind;
  /** The COPY ID of the message (without `COPY-`). */
  readonly id: MessageId;
  /** The message in the active language. */
  text(): string;
}
