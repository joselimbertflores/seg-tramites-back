import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('1234567890abcdef', 5);

function sanitize(str: string): string {
  return str
    .normalize('NFD') // quitar tildes
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '') // eliminar caracteres no alfanuméricos
    .toLowerCase();
}

export const generateLogin = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean).map(sanitize);

  if (parts.length === 0) {
    throw new Error('FullName is empty');
  }

  const firstName = parts[0];
  const lastName = parts[1] ?? ''; // puede no existir
  const loginBase = `${firstName[0] ?? ''}${lastName}`; // ejemplo: "jlopez" o "j" si solo hay nombre
  const suffix = nanoid(); // ejemplo: "c81f"

  return `${loginBase}_${suffix}`;
};
