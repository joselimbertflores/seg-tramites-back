import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';

import { ResourcesService } from './resources.service';
import { CreateResourceFileDto } from './dtos/resource-file.dto';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  create(@Body() resourceDto: CreateResourceFileDto) {
    return this.resourcesService.create(resourceDto);
  }

  @Get("grouped")
  findAll() {
    return this.resourcesService.findAllGroupedByCategory();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }

  @Get('categories')
  getCategories() {
    return this.resourcesService.getCategories();
  }
}
