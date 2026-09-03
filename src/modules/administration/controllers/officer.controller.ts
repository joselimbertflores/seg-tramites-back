import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { PaginationDto } from 'src/modules/common/dtos/pagination.dto';
import { RequirePermission } from 'src/modules/auth/decorators';
import { SystemResource } from 'src/modules/auth/constants';

import { UpdateOfficerDto } from '../dtos';
import { OfficerService } from '../services';

@RequirePermission(SystemResource.OFFICERS)
@Controller('officers')
export class OfficerController {
  constructor(private readonly officerService: OfficerService) {}

  @Get()
  findAll(@Query() params: PaginationDto) {
    return this.officerService.findAll(params);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() officer: UpdateOfficerDto) {
    return this.officerService.update(id, officer);
  }
}
