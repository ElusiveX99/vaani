const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ParticipantIdentity = {
  identity: string;
  attributes?: Record<string, string>;
};

/** Resolve the stable account UUID from a per-device LiveKit identity. */
export function getLiveKitUserId(participant: ParticipantIdentity): string | null {
  const attributeId = participant.attributes?.user_id;
  if (attributeId && UUID_PATTERN.test(attributeId)) return attributeId;
  const identityId = participant.identity.split(":", 1)[0];
  return UUID_PATTERN.test(identityId) ? identityId : null;
}
