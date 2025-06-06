import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsStartDateBeforeExpirationConstraint implements ValidatorConstraintInterface {
  validate(startDate: Date, args: ValidationArguments) {
    const expirationDate = (args.object as any).expirationDate;
    return startDate <= expirationDate;
  }

  defaultMessage(args: ValidationArguments) {
    return `Date ${args.property} can not before now.`;
  }
}

export function IsStartDateBeforeExpiration(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStartDateBeforeExpirationConstraint,
    });
  };
}
