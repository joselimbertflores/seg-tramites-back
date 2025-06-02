import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ResourceFile, ResourceFileSchema } from './schemas/resource.schema';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { FilesModule } from '../files/files.module';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService],
  imports: [MongooseModule.forFeature([{ name: ResourceFile.name, schema: ResourceFileSchema }]), FilesModule],
})
export class ResourcesModule {}
