import type { Dictionary } from '../i18n/en';
import type { ShareIssue } from '../letter/link';
import { LIMITS } from '../letter/model';

/** Turns a validation problem into a sentence that says what to do about it. */
export function issueText(t: Dictionary, issue: ShareIssue): string {
  switch (issue) {
    case 'empty':
      return t.studio.issues.empty;
    case 'message-too-long':
      return t.studio.issues['message-too-long'](LIMITS.messageGraphemes);
    case 'message-too-heavy':
      return t.studio.issues['message-too-heavy'];
    case 'to-too-long':
      return t.studio.issues['to-too-long'](LIMITS.nameGraphemes);
    case 'from-too-long':
      return t.studio.issues['from-too-long'](LIMITS.nameGraphemes);
    case 'url-too-long':
      return t.studio.issues['url-too-long'];
  }
}
