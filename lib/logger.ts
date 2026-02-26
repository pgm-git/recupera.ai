import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export function createRequestLogger() {
  let counter = 0;
  return (req: any, res: any, next: any) => {
    const requestId = `req-${Date.now()}-${++counter}`;
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const start = Date.now();
    res.on('finish', () => {
      logger.info({
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      }, `${req.method} ${req.originalUrl} ${res.statusCode}`);
    });

    next();
  };
}
