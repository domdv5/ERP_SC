import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  name: string;
  username: string;
  permissions: string[];
  roles: string[];
  tokenVersion: number;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

export interface ResponseFormat<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

export { matchContract } from './as-json';
export type { AsJson } from './as-json';
