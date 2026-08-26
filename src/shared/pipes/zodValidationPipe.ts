import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

const VALIDATABLE_PARAM_TYPES = new Set(['body', 'query', 'param']);

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!VALIDATABLE_PARAM_TYPES.has(metadata.type)) {
      return value;
    }

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
