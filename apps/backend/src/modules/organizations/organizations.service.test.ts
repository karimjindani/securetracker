import { describe, expect, it, vi } from 'vitest';
import { OrganizationsService } from './organizations.service.js';
import type { CurrentUser } from '../auth/current-user.types.js';

const actor: CurrentUser = {
  id: 'user-1',
  keycloakUserId: 'kc-1',
  email: 'admin@example.local',
  fullName: 'System Admin',
  role: 'SYSTEM_ADMIN',
  organizationId: 'org-1',
  organizationName: 'Platform',
  organizationType: 'AUDITOR'
};

describe('OrganizationsService', () => {
  it('creates an audit entry when creating an organization', async () => {
    const organization = { id: 'org-2', name: 'NBP', organizationType: 'NBP', status: 'ACTIVE' };
    const prisma = {
      organization: {
        create: vi.fn().mockResolvedValue(organization)
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    const result = await new OrganizationsService(prisma as never).create(
      { name: 'NBP', organizationType: 'NBP' },
      actor
    );

    expect(result).toBe(organization);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ORGANIZATION_CREATED',
          entityType: 'ORGANIZATION',
          entityId: 'org-2'
        })
      })
    );
  });
});
