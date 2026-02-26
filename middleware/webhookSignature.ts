import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function verifyHotmartSignature(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;

    // Hotmart sends a hottok field that must match the configured secret
    if (payload.hottok && payload.hottok !== secret) {
      return res.status(401).json({ error: 'Invalid hottok signature' });
    }

    // Hotmart may also send an X-Hotmart-Hottok header with HMAC
    const headerSignature = req.headers['x-hotmart-hottok'] as string | undefined;
    if (headerSignature) {
      const rawBody = JSON.stringify(req.body);
      const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (computed !== headerSignature) {
        return res.status(401).json({ error: 'Invalid HMAC signature' });
      }
    }

    next();
  };
}
