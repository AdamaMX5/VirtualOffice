import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { requestIdStorage } from '../logBuffer';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = randomUUID();
  requestIdStorage.run(reqId, () => {
    res.setHeader('X-Request-ID', reqId);
    next();
  });
}
