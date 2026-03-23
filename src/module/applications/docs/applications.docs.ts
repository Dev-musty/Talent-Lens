import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

export const APPLICATIONS_SWAGGER_TAG = {
  name: 'Applications',
  description:
    'Freelancer application submission and ranked shortlist endpoints for each job.',
};

export const ApiApplicationsControllerDocs = () =>
  ApiTags(APPLICATIONS_SWAGGER_TAG.name);

export const ApiApplyDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Submit application for a job',
      description:
        'Submits a freelancer profile, runs scoring, applies tier gating, and returns either admission details or rejection reason.',
    }),
    ApiParam({
      name: 'link',
      required: true,
      description: 'Short shareable job link.',
      example: 'a3f7b91c',
    }),
    ApiBody({
      required: true,
      description: 'Freelancer profile payload.',
      schema: {
        type: 'object',
        required: [
          'freelancer_name',
          'skills',
          'years_experience',
          'proposed_rate',
        ],
        properties: {
          freelancer_name: { type: 'string', example: 'John Doe' },
          skills: {
            type: 'array',
            items: { type: 'string' },
            example: ['React', 'TypeScript', 'Node.js'],
          },
          years_experience: {
            type: 'integer',
            minimum: 0,
            maximum: 50,
            example: 3,
          },
          portfolio_urls: {
            type: 'array',
            items: { type: 'string' },
            example: ['https://github.com/johndoe'],
          },
          bio: {
            type: 'string',
            example: 'Frontend developer specialising in fintech experiences.',
          },
          testimonies: {
            type: 'string',
            example:
              'John delivered ahead of schedule and communicated clearly.',
          },
          proposed_rate: { type: 'integer', minimum: 1, example: 1200 },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Application processed. Response can be granted or denied.',
      schema: {
        oneOf: [
          {
            type: 'object',
            properties: {
              access_granted: { type: 'boolean', example: true },
              inferred_tier: { type: 'string', example: 'mid' },
              fit_score: { type: 'integer', example: 82 },
              overall_rank_score: { type: 'integer', example: 78 },
              rank_position: { type: 'integer', example: 2 },
              total_applicants: { type: 'integer', example: 5 },
              ai_reasoning: {
                type: 'string',
                example:
                  'Profile assessed using skills, experience, and role alignment signals.',
              },
            },
          },
          {
            type: 'object',
            properties: {
              access_granted: { type: 'boolean', example: false },
              inferred_tier: { type: 'string', example: 'junior' },
              rejection_reason: {
                type: 'string',
                example:
                  'This role requires mid. Your profile was assessed as junior.',
              },
            },
          },
        ],
      },
    }),
    ApiNotFoundResponse({
      description: 'Job link does not exist.',
    }),
  );

export const ApiListApplicationsDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Get ranked admitted applications for a job',
      description:
        'Returns only admitted applications for the job. Supports optional tier filtering and sorting.',
    }),
    ApiParam({
      name: 'link',
      required: true,
      description: 'Short shareable job link.',
      example: 'a3f7b91c',
    }),
    ApiQuery({
      name: 'tier',
      required: false,
      enum: ['junior', 'mid', 'senior'],
      description: 'Optional inferred tier filter.',
    }),
    ApiQuery({
      name: 'sort',
      required: false,
      enum: ['rank', 'price', 'testimony'],
      description: 'Sort strategy. Defaults to rank when omitted.',
    }),
    ApiOkResponse({
      description: 'Ranked shortlist of admitted applications.',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            job_id: { type: 'string', format: 'uuid' },
            freelancer_name: { type: 'string', example: 'John Doe' },
            skills: { type: 'array', items: { type: 'string' } },
            years_experience: { type: 'integer', example: 3 },
            portfolio_urls: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            bio: { type: 'string', nullable: true },
            testimonies: { type: 'string', nullable: true },
            proposed_rate: { type: 'integer', example: 1200 },
            inferred_tier: { type: 'string', example: 'mid' },
            fit_score: { type: 'integer', example: 82 },
            testimony_score: { type: 'integer', example: 70 },
            price_score: { type: 'integer', example: 100 },
            overall_rank_score: { type: 'integer', example: 82 },
            ai_reasoning: { type: 'string' },
            tier_reasoning: { type: 'string' },
            access_granted: { type: 'boolean', example: true },
            rejection_reason: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    }),
    ApiNotFoundResponse({
      description: 'Job link does not exist.',
    }),
  );
