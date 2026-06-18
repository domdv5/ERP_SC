import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  name: string;
  username: string;
  permissions: string[];
  roles: string[];
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

export interface ResponseFormat<T = any> {
  success: boolean;
  data: T;
  message?: string;
}
