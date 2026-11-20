// Journal minimal. Ne jamais passer de secret, mot de passe, code OTP ou jeton en paramètre.
type Level = 'info' | 'warn' | 'error';

export function log(level: Level, event: string, fields: Record<string, string | number | boolean | null> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}
