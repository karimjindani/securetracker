import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { UserSyncService } from './user-sync.service.js';

describe('UserSyncService', () => {
  it('reconciles a local user by email when Keycloak subject changes', async () => {
    const organization = { id: 'org-1', name: 'NBP', organizationType: 'NBP' };
    const reconciledUser = {
      id: 'user-1',
      keycloakUserId: 'new-kc-id',
      email: 'system.admin@example.local',
      fullName: 'System Admin',
      role: 'SYSTEM_ADMIN'
    };
    const emailConflict = new Prisma.PrismaClientKnownRequestError('Unique email conflict', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] }
    });
    const prisma = {
      organization: {
        upsert: vi.fn().mockResolvedValue(organization)
      },
      user: {
        upsert: vi.fn().mockRejectedValue(emailConflict),
        update: vi.fn().mockResolvedValue(reconciledUser)
      }
    };

    const result = await new UserSyncService(prisma as never).syncUser({
      keycloakUserId: 'new-kc-id',
      email: 'system.admin@example.local',
      fullName: 'System Admin',
      role: 'SYSTEM_ADMIN',
      organizationName: 'NBP',
      organizationType: 'NBP'
    });

    expect(result.keycloakUserId).toBe('new-kc-id');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'system.admin@example.local' },
        data: expect.objectContaining({ keycloakUserId: 'new-kc-id' })
      })
    );
  });
});
