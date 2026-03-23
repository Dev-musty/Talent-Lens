import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateApplicationDto } from './dtos/create-application.dto';
import { ListApplicationsDto } from './dtos/list-applications.dto';
import {
  ApiApplicationsControllerDocs,
  ApiApplyDocs,
  ApiListApplicationsDocs,
} from './docs/applications.docs';
import { ApplicationsService } from './applications.service';

@ApiApplicationsControllerDocs()
@Controller('jobs/:link')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('apply')
  @ApiApplyDocs()
  apply(
    @Param('link') link: string,
    @Body() createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.apply(link, createApplicationDto);
  }

  @Get('applications')
  @ApiListApplicationsDocs()
  listApplications(
    @Param('link') link: string,
    @Query() query: ListApplicationsDto,
  ) {
    return this.applicationsService.listApplications(link, query);
  }
}
