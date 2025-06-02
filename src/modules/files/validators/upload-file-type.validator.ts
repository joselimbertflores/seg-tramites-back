import { FileValidator } from '@nestjs/common';
import { parse } from 'file-type-mime';

export class CustomUploadFileTypeValidator extends FileValidator {
  constructor(protected readonly validExtensions: string[]) {
    super(validExtensions);
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    const fileTypeProps = parse(file.buffer);
    if (!fileTypeProps) return false;
    if (file.mimetype !== fileTypeProps.mime) return false;
    return this.validExtensions.includes(fileTypeProps.ext);
  }

  buildErrorMessage(file: Express.Multer.File): string {
    const mimeType = file?.mimetype?.split('/')[1] ?? 'unknown';
    return `${mimeType} extension is not valid or mimetype is not equal to extension`;
  }
}
