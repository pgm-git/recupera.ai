import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function errorResponse(res: Response, status: number, message: string, details?: unknown) {
  return res.status(status).json({ error: message, details });
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return errorResponse(res, 400, 'Validation failed', result.error.flatten().fieldErrors);
    }
    next();
  };
}
