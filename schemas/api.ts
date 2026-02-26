import { z } from 'zod';

export const ClientIdParamSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
});
