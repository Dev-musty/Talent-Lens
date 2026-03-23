import { IsIn, IsOptional } from 'class-validator';

export class ListApplicationsDto {
  @IsOptional()
  @IsIn(['junior', 'mid', 'senior'])
  tier?: 'junior' | 'mid' | 'senior';

  @IsOptional()
  @IsIn(['rank', 'price', 'testimony'])
  sort?: 'rank' | 'price' | 'testimony';
}
