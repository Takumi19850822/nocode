/** アプリ全体で使うパスワード最小文字数（Supabase Auth の設定と合わせる） */
export const MIN_PASSWORD_LENGTH = 6;

export function validatePasswordLength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`;
  }
  return null;
}
