import { IsIn, IsOptional } from 'class-validator';

export class GetCorrespondenceByAccountDto {
  @IsOptional()
  @IsIn(['recipient', 'sender'])
  filterBy: 'recipient' | 'sender' = 'recipient';
}
