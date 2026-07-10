import type { Role } from '@securetracker/shared';

export interface SeededUser {
  username: string;
  password: string;
  role: Role;
}

export const seededUsers: Record<string, SeededUser> = {
  systemAdmin: { username: 'system.admin', password: 'ChangeMe123!', role: 'SYSTEM_ADMIN' },
  nbpAdmin: { username: 'nbp.admin', password: 'ChangeMe123!', role: 'NBP_SECURITY_ADMIN' },
  paysysAdmin: { username: 'paysys.admin', password: 'ChangeMe123!', role: 'PAYSYS_SECURITY_ADMIN' },
  paysysDeveloper: { username: 'paysys.dev', password: 'ChangeMe123!', role: 'PAYSYS_DEVELOPER' },
  vendorAdmin: { username: 'apprise.vendor', password: 'ChangeMe123!', role: 'VENDOR_ADMIN' },
  auditor: { username: 'auditor', password: 'ChangeMe123!', role: 'AUDITOR' }
};
