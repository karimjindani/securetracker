import type { OrganizationType, Role } from '@securetracker/shared';

export interface CurrentUser {
  id: string;
  keycloakUserId: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
}

export interface TokenUser {
  keycloakUserId: string;
  email: string;
  fullName: string;
  role: Role;
  organizationName: string;
  organizationType: OrganizationType;
}
