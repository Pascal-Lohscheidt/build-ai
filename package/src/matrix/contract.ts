import { Schema as S } from 'effect';

export type Contract = S.Schema<unknown>;

export function isObeying(
  contract: Contract,
  contractee: unknown
): contractee is Contract['Type'] {
  return !!S.decodeUnknownSync(contract)(contractee);
}
