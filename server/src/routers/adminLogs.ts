import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { queryLogs } from '../logBuffer';

const VALID_LEVELS = new Set(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']);

function adminGuard(_req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(500).json({ status: 'error', detail: 'ADMIN_SECRET not configured' });
    return;
  }
  const auth = _req.headers.authorization;
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ status: 'error', detail: 'Unauthorized' });
    return;
  }
  next();
}

const router = Router();

router.get('/admin/logs', adminGuard, (req: Request, res: Response) => {
  const minutesRaw = parseFloat(String(req.query['minutes'] ?? '5.0'));
  const minutes = isNaN(minutesRaw) ? 5.0 : Math.max(0.1, Math.min(1440, minutesRaw));

  const levelRaw = String(req.query['level'] ?? '').toUpperCase();
  const level = VALID_LEVELS.has(levelRaw) ? levelRaw : null;

  const limitRaw = parseInt(String(req.query['limit'] ?? '200'), 10);
  const limit = isNaN(limitRaw) ? 200 : Math.max(1, Math.min(1000, limitRaw));

  const offsetRaw = parseInt(String(req.query['offset'] ?? '0'), 10);
  const offset = isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw);

  const { logs, total } = queryLogs(minutes, level, limit, offset);

  res.json({
    status: 'ok',
    total,
    returned: logs.length,
    query: { minutes, level, limit, offset },
    logs,
  });
});

export default router;
