import { Controller, Get, Post, Body, Query, Patch, Param, Delete } from '@nestjs/common';

import { GroupwareGateway } from 'src/modules/groupware/gateways/groupware.gateway';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';

import { CreatePublicationDto, UpdatePublicationDto } from './dtos';
import { PublicationPriority } from './schemas/publication.schema';
import { GetUserRequest } from 'src/modules/auth/decorators';
import { PublicationsService } from './publications.service';
import { User } from '../users/schemas';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PublicationsService, private groupwareGateway: GroupwareGateway) {}

  @Post()
  async create(@Body() publicationDto: CreatePublicationDto, @GetUserRequest() user: User) {
    const publication = await this.postsService.create(publicationDto, user);
    if (publication.priority === PublicationPriority.HIGH) {
      this.groupwareGateway.notifyNew(publication);
    }
    return publication;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() publicationDto: UpdatePublicationDto) {
    return this.postsService.update(id, publicationDto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.postsService.delete(id);
  }

  @Get()
  findAll(@Query() params: PaginationDto) {
    return this.postsService.findAll(params);
  }

  @Get('user')
  findByUser(@GetUserRequest() user: User, @Query() pagination: PaginationDto) {
    return this.postsService.findByUser(user._id, pagination);
  }

  @Get('news')
  getNews(@Query() pagination: PaginationDto) {
    return this.postsService.getNews(pagination);
  }
}
