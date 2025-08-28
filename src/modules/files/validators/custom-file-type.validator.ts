import { FileValidator } from '@nestjs/common';
// import { parse } from 'file-type-mime';

import { fromBuffer } from 'file-type/';
import { lookup as mimeLookup } from 'mime-types';

export class CustomFileTypeValidator extends FileValidator {
  private readonly allowedMimes: string[];

  constructor(config: { validTypes: string[] }) {
    super(config);
    this.allowedMimes = config.validTypes.map((type) =>
      type.includes('/') ? type : mimeLookup(type) || type,
    ) as string[];
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file) return false;

    const detected = await fromBuffer(file.buffer);
    if (!detected) return false;

    return this.allowedMimes.includes(detected.mime);
  }

  buildErrorMessage(file: Express.Multer.File): string {
    return `File "${file.originalname}" is not valid. Allowed extensions: ${this.allowedMimes.join(', ')}`;
  }
}
