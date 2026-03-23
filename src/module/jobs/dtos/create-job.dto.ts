import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(1)
  budget_min: number;

  @IsInt()
  @Min(1)
  budget_max: number;

  @IsIn(['any', 'junior', 'mid', 'senior'])
  required_tier: 'any' | 'junior' | 'mid' | 'senior';

  @IsString()
  @IsNotEmpty()
  client_name: string;
}
