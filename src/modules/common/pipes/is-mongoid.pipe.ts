import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isMongoId } from 'class-validator';

@Injectable()
export class IsMongoidPipe implements PipeTransform {
  transform(value: string) {
    if (!isMongoId(value)) throw new BadRequestException(`${value} is not a valid ID`);
    return value;
  }
}
