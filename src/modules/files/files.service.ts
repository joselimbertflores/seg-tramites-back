import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { EnvVars } from 'src/config';
import { v4 as uuid } from 'uuid';

@Injectable()
export class FilesService {
  private readonly folders: Record<string, string[]> = {
    images: ['jpg', 'png', 'jpeg'],
    documents: ['pdf'],
  };
  constructor(private configService: ConfigService<EnvVars>) {}

  async savePostFile(file: Express.Multer.File): Promise<{ filename: string; title: string }> {
    const fileExtension = file.mimetype.split('/')[1];
    const savedFileName = `${uuid()}.${fileExtension}`;
    const folder = this._getUploadFileFolder(fileExtension);
    const path = join(__dirname, '..', '..', '..', 'static', 'uploads', 'posts', folder, savedFileName);
    try {
      await writeFile(path, file.buffer);
      return { filename: savedFileName, title: file.originalname };
    } catch (error) {
      throw new InternalServerErrorException('Error saving file');
    }
  }

  getStaticFile(filename: string) {
    const extension = filename.split('.')[1];
    if (!extension) throw new BadRequestException('File extension not found');
    const folder = this._getUploadFileFolder(extension);
    const path = join(__dirname, '..', '..', '..', 'static', 'uploads', 'posts', folder, filename);
    if (!existsSync(path)) {
      throw new BadRequestException(`No file found with ${filename}`);
    }
    return path;
  }

  public buildFileUrl(filename: string, group: string): string {
    const host = this.configService.get('HOST');
    return `${host}/files/${group}/${filename}`;
  }

  private _getUploadFileFolder(extension: string): string {
    const folder = Object.entries(this.folders).find((folder) => folder[1].includes(extension));
    if (!folder) throw new InternalServerErrorException('Error upload file');
    return folder[0];
  }
}
