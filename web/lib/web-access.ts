import type { Role } from './types';

/** Roles allowed to use the web portal. Residents use the mobile app. */
export const WEB_ROLES: Role[] = ['admin', 'department_head'];

export function isWebRole(role: unknown): role is Role {
  return WEB_ROLES.includes(role as Role);
}