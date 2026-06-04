import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return response.status(HttpStatus.CONFLICT).json({
            statusCode: 409,
            message: 'Ya existe un registro con ese valor',
            field: exception.meta?.target,
          });
        case 'P2025':
          return response.status(HttpStatus.NOT_FOUND).json({
            statusCode: 404,
            message: 'Registro no encontrado',
          });
        case 'P2003':
          return response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: 400,
            message: 'Referencia a un registro que no existe',
            field: exception.meta?.field_name,
          });
        case 'P2007':
          return response.status(HttpStatus.BAD_REQUEST).json({
            statusCode: 400,
            message: 'Formato de datos inválido',
          });
        default:
          return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: 500,
            message: 'Error de base de datos',
            code: exception.code,
          });
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      console.log(exception);
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Datos inválidos',
      });
    }
  }
}
