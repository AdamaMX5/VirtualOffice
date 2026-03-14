import type { Request, Response } from 'express';

export interface ApolloContext {
  req: Request;
  res: Response;
}

export function buildContext({ req, res }: { req: Request; res: Response }): ApolloContext {
  return { req, res };
}
