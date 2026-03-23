import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  freelancer_name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  skills: string[];

  @IsInt()
  @Min(0)
  @Max(50)
  years_experience: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  portfolio_urls?: string[];

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  testimonies?: string;

  @IsInt()
  @Min(1)
  proposed_rate: number;
}
