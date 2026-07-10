import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './roles.guard.js';

const makeContext = (role: string, requiredRoles: string[]) =>
  ({
    getHandler: () => ({ requiredRoles }),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } })
    })
  }) as never;

describe('RolesGuard', () => {
  it('allows users with required role', () => {
    const reflector = { getAllAndOverride: () => ['SYSTEM_ADMIN'] } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(makeContext('SYSTEM_ADMIN', ['SYSTEM_ADMIN']))).toBe(true);
  });

  it('rejects users without required role', () => {
    const reflector = { getAllAndOverride: () => ['SYSTEM_ADMIN'] } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(makeContext('AUDITOR', ['SYSTEM_ADMIN']))).toThrow(
      ForbiddenException
    );
  });
});
