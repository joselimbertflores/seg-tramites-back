import * as generator from 'generate-password';

export const generatePassword = () => {
  return generator.generate({
    length: 8,
    numbers: true,
    uppercase: true,
  });
};
