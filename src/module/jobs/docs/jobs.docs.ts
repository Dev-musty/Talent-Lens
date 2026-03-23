import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

export const JOBS_SWAGGER_TAG = {
  name: 'Jobs',
  description:
    'Job posting endpoints for creating roles and retrieving public job details by shareable link.',
};

export const ApiJobsControllerDocs = () => ApiTags(JOBS_SWAGGER_TAG.name);

export const ApiCreateJobDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a job posting',
      description:
        'Creates a new job and returns a short unique link used by freelancers to apply and clients to view the dashboard.',
    }),
    ApiBody({
      description: 'Job data provided by the client.',
      required: true,
      schema: {
        type: 'object',
        required: [
          'title',
          'description',
          'budget_min',
          'budget_max',
          'required_tier',
          'client_name',
        ],
        properties: {
          title: { type: 'string', example: 'React Developer for fintech app' },
          description: {
            type: 'string',
            example: 'Build and ship a responsive dashboard with TypeScript.',
          },
          budget_min: { type: 'integer', example: 500, minimum: 1 },
          budget_max: { type: 'integer', example: 1500, minimum: 1 },
          required_tier: {
            type: 'string',
            enum: ['any', 'junior', 'mid', 'senior'],
            example: 'mid',
          },
          client_name: { type: 'string', example: 'Acme Inc' },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Job created successfully.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'f0911310-3c52-4639-a36e-f4b5f96dc190' },
          unique_link: { type: 'string', example: 'a3f7b91c' },
          apply_url: { type: 'string', example: '/apply/a3f7b91c' },
          dashboard_url: { type: 'string', example: '/dashboard/a3f7b91c' },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid input. Example: budget_min > budget_max.',
    }),
    ApiConflictResponse({
      description: 'Could not generate a unique public link after retries.',
    }),
  );

export const ApiGetJobByLinkDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get job details by public link',
      description:
        'Returns the job details used by the freelancer apply page when loading a shared job URL.',
    }),
    ApiParam({
      name: 'link',
      required: true,
      description: 'Short shareable job link generated at creation time.',
      example: 'a3f7b91c',
    }),
    ApiOkResponse({
      description: 'Job found.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'f0911310-3c52-4639-a36e-f4b5f96dc190' },
          created_at: { type: 'string', format: 'date-time', example: '2026-03-23T14:10:00.000Z' },
          title: { type: 'string', example: 'React Developer for fintech app' },
          description: {
            type: 'string',
            example: 'Build and ship a responsive dashboard with TypeScript.',
          },
          budget_min: { type: 'integer', example: 500 },
          budget_max: { type: 'integer', example: 1500 },
          required_tier: { type: 'string', example: 'mid' },
          client_name: { type: 'string', example: 'Acme Inc' },
          unique_link: { type: 'string', example: 'a3f7b91c' },
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'No job exists for the provided link.',
    }),
  );