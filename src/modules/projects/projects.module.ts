import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { Project, ProjectSchema } from './schemas';
import { AdministrationModule } from '../administration/administration.module';
import { ProceduresModule } from '../procedures/procedures.module';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  imports: [
    AdministrationModule,
    ProceduresModule,
    MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }]),
  ],
})
export class ProjectsModule {}
