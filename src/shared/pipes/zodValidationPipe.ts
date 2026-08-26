
import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) { }

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.flatten(),
        });
      }
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      });
    }
  }
}
