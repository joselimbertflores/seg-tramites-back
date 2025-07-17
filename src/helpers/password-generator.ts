import * as generator from 'generate-password';

export const generatePassword = () => {
  return generator.generate({
    length: 10,
    numbers: true,
  });
};
