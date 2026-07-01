/** プロフィールから氏名（display_name）を取得。メールアドレスにはフォールバックしない */
export function getProfileDisplayName(
  profile: { display_name?: string | null } | null | undefined
): string {
  return profile?.display_name?.trim() ?? "";
}
