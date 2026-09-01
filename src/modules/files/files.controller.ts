import { Controller, Get, Param, ParseFilePipeBuilder, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { CustomFileTypeValidator } from './validators/custom-file-type.validator';
import { ALLOWED_FILE_TYPES } from './constants';
import { GetFileDto } from './dtos/get-file.dto';
import { FilesService } from './files.service';
import { FileGroup } from './file-group.enum';
import { RequirePermission } from '../auth/decorators';
import { SystemResource } from '../auth/constants';
import { OnlyAssignedAccount } from '../administration/decorators';

@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('post')
  @OnlyAssignedAccount()
  @RequirePermission(SystemResource.PUBLICATIONS)
  @UseInterceptors(FileInterceptor('file'))
  uploadPostFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(new CustomFileTypeValidator({ validTypes: ALLOWED_FILE_TYPES.POST }))
        .addMaxSizeValidator({ maxSize: 15 * 1024 * 1024 })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return this.filesService.saveFile(file, FileGroup.POSTS);
  }

  @Post('resource')
  @RequirePermission(SystemResource.RESOURCES)
  @UseInterceptors(FileInterceptor('file'))
  uploadResourceFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addValidator(new CustomFileTypeValidator({ validTypes: ALLOWED_FILE_TYPES.RESOURCE }))
        .addMaxSizeValidator({ maxSize: 15 * 1024 * 1024 })
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
        .addValidator(new CustomFileTypeValidator({ validTypes: ALLOWED_FILE_TYPES.CHAT }))
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
