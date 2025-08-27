import { Controller, Get, Param, ParseFilePipeBuilder, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { CustomUploadFileTypeValidator } from './validators/upload-file-type.validator';
import { GetFileDto } from './dtos/get-file.dto';
import { FilesService } from './files.service';
import { FileGroup } from './file-group.enum';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('post')
  @UseInterceptors(FileInterceptor('file'))
  uploadPostFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(new CustomUploadFileTypeValidator(['png', 'jpg', 'jpeg', 'pdf']))
        .addMaxSizeValidator({ maxSize: 5 * 1000000 })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.filesService.saveFile(file, FileGroup.POSTS);
  }

  @Post('resource')
  @UseInterceptors(FileInterceptor('file'))
  uploadResourceFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(
          new CustomUploadFileTypeValidator([
            'png',
            'jpeg',
            'jpg',
            'mp4',
            'ppt',
            'pptx',
            'odp',
            'xls',
            'xlsx',
            'ods',
            'doc',
            'docx',
            'odt',
            'pdf',
          ]),
        )
        .addMaxSizeValidator({ maxSize: 5 * 1000000 })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.filesService.saveFile(file, FileGroup.RESOURCES);
  }

  @Post('chat')
  @UseInterceptors(FileInterceptor('file'))
  uploadChatFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(
          new CustomUploadFileTypeValidator([
            'png',
            'jpeg',
            'jpg',
            'mp4',
            'mp3',
            'odp',
            'xls',
            'xlsx',
            'ods',
            'doc',
            'docx',
            'odt',
            'pdf',
          ]),
        )
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.filesService.saveFile(file, FileGroup.CHATS);
  }

  @Get(':group/:fileName')
  getFile(@Res() res: Response, @Param() requestParams: GetFileDto) {
    const path = this.filesService.getStaticFilePath(requestParams);
    res.sendFile(path);
  }
}
