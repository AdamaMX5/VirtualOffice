import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { _clearBuffer, _addEntry } from '../logBuffer';
import adminLogsRouter from '../routers/adminLogs';

const SECRET = 'test-secret-123';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(adminLogsRouter);
  return app;
}

beforeAll(() => {
  process.env['ADMIN_SECRET'] = SECRET;
});

beforeEach(() => {
  _clearBuffer();
});

describe('GET /admin/logs – auth guard', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(buildApp()).get('/admin/logs');
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  it('returns 401 when the secret is wrong', async () => {
    const res = await request(buildApp())
      .get('/admin/logs')
      .set('Authorization', 'Bearer wrong-secret');
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/logs – response shape', () => {
  it('returns ok with correct shape for empty buffer', async () => {
    const res = await request(buildApp())
      .get('/admin/logs')
      .set('Authorization', `Bearer ${SECRET}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.total).toBe(0);
    expect(res.body.returned).toBe(0);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.query).toMatchObject({ minutes: 5, limit: 200, offset: 0 });
  });

  it('returns only logs matching the requested level filter', async () => {
    _addEntry('INFO', 'info entry');
    _addEntry('ERROR', 'error entry');

    const res = await request(buildApp())
      .get('/admin/logs?level=ERROR&minutes=1440')
      .set('Authorization', `Bearer ${SECRET}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.logs[0].level).toBe('ERROR');
    expect(res.body.query.level).toBe('ERROR');
  });
});
