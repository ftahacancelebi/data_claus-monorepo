import { SetMetadata } from '@nestjs/common';

export enum Role {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  USER = 'user',
  BUYER = 'buyer',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
