import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InstitutionService } from '../services/institution.service';
import { CreateInstitutionDto, UpdateInstitutionDto } from '../dtos';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { ResourceProtected } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';

@Controller('institutions')
@ResourceProtected(SystemResource.INSTITUTIONS)
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Get()
  get(@Query() params: PaginationDto) {
    return this.institutionService.findAll(params);
  }


  @Post()
  add(@Body() institution: CreateInstitutionDto) {
    return this.institutionService.create(institution);
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body() institution: UpdateInstitutionDto) {
    return this.institutionService.update(id, institution);
  }

}
