/// How long an invite link stays usable.
///
/// Short enough that a link pasted into a public group chat stops working
/// before the term is out, long enough to survive a reading week.
export const INVITE_LIFETIME_DAYS = 7;

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_LIFETIME_DAYS * 86_400_000);
}
