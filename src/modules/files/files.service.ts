import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';

import { EnvVars } from 'src/config';
import { FileGroup } from './file-group.enum';
import { GetFileDto } from './dtos/get-file.dto';

export interface savedFile {
  fileName: string;
  originalName: string;
}

@Injectable()
export class FilesService {
  private readonly BASE_UPLOAD_PATH = join(__dirname, '..', '..', '..', 'static', 'uploads');

  private readonly FOLDERS: Record<string, string[]> = {
    images: ['jpg', 'png', 'jpeg'],
    documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ods', 'ppt'],
  };

  constructor(private configService: ConfigService<EnvVars>) {}

  public buildFileUrl(filename: string, group: FileGroup): string {
    const host = this.configService.get('HOST');
    return `${host}/files/${group}/${filename}`;
  }

  async saveFile(file: Express.Multer.File, group: FileGroup): Promise<savedFile> {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    const subfolder = this.getFolderByExtension(fileExtension);

    const folderPath = join(this.BASE_UPLOAD_PATH, group, subfolder);

    await this.ensureFolderExists(folderPath);

    const savedFileName = `${uuid()}.${fileExtension}`;

    const filePath = join(folderPath, savedFileName);

    try {
      await writeFile(filePath, file.buffer);

      const decodedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      return {
        fileName: savedFileName,
        originalName: decodedOriginalName,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error saving file');
    }
  }

  async remove(fileName: string, group: FileGroup) {
    try {
      const subfolder = this.getFolderByExtension(fileName.split('.').pop());
      const filePath = join(this.BASE_UPLOAD_PATH, group, subfolder, fileName);
      await unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async removeMany(fileNames: string[], group: FileGroup) {
    await Promise.all(fileNames.map((fileName) => this.remove(fileName, group)));
  }

  getStaticFilePath({ fileName, group }: GetFileDto): string {
    const extension = extname(fileName).replace('.', '');
    const subfolder = this.getFolderByExtension(extension);
    const filePath = join(this.BASE_UPLOAD_PATH, group, subfolder, fileName);

    if (!existsSync(filePath)) {
      throw new BadRequestException(`No file found with name ${fileName}`);
    }
    console.log(fileName);
    return filePath;
  }

  private getFolderByExtension(ext: string): string {
    ext = ext.toLowerCase();
    for (const [folder, extensions] of Object.entries(this.FOLDERS)) {
      if (extensions.includes(ext)) {
        return folder;
      }
    }
    return 'others';
  }

  private async ensureFolderExists(path: string): Promise<void> {
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true });
    }
  }
}
