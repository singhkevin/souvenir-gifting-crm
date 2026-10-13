/** Active owner, otherwise the org default owner. */
export function pickAlertOwnerId(input: {
  ownerId: string | null
  ownerActive: boolean | null
  fallbackOwnerId: string | null
}): string | null {
  if (input.ownerId && input.ownerActive) return input.ownerId
  return input.fallbackOwnerId
}
