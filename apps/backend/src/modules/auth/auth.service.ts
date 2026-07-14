import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { isRole, type OrganizationType, type Role } from '@securetracker/shared';
import type { TokenUser } from './current-user.types.js';

interface KeycloakPayload extends JWTPayload {
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  organization_name?: string;
  organization_type?: OrganizationType;
  azp?: string;
}

@Injectable()
export class AuthService {
  private readonly issuerUrl: string;
  private readonly clientId: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.issuerUrl = this.config.get<string>('KEYCLOAK_ISSUER_URL') ?? 'http://localhost:8080/realms/securetracker';
    this.clientId = this.config.get<string>('KEYCLOAK_CLIENT_ID') ?? 'securetracker-web';
    const jwksUrl = this.config.get<string>('KEYCLOAK_JWKS_URL') ?? `${this.issuerUrl}/protocol/openid-connect/certs`;
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async validateAuthorizationHeader(authorization?: string): Promise<TokenUser> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, this.jwks, {
        issuer: this.issuerUrl
      });
      payload = verified.payload;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }

    if ((payload as KeycloakPayload).azp !== this.clientId) {
      throw new UnauthorizedException('Token was not issued for SecureTracker');
    }

    return this.toTokenUser(payload as KeycloakPayload);
  }

  toTokenUser(payload: KeycloakPayload): TokenUser {
    const role = this.extractRole(payload.realm_access?.roles ?? []);
    const email = payload.email ?? payload.preferred_username;
    if (!payload.sub || !email) {
      throw new UnauthorizedException('Token is missing required user claims');
    }

    const organizationType = payload.organization_type ?? this.defaultOrganizationType(role);
    return {
      keycloakUserId: payload.sub,
      email,
      fullName: payload.name ?? payload.preferred_username ?? email,
      role,
      organizationName: payload.organization_name ?? this.defaultOrganizationName(role, organizationType),
      organizationType
    };
  }

  private extractRole(tokenRoles: string[]): Role {
    const role = tokenRoles.find(isRole);
    if (!role) {
      throw new UnauthorizedException('Token does not include a SecureTracker role');
    }
    return role;
  }

  private defaultOrganizationType(role: Role): OrganizationType {
    if (role === 'SYSTEM_ADMIN') return 'PAYSYS';
    if (role === 'AUDITOR') return 'NBP';
    if (role.startsWith('NBP')) return 'NBP';
    if (role.startsWith('PAYSYS')) return 'PAYSYS';
    if (role === 'VENDOR_ADMIN') return 'VENDOR';
    return 'PAYSYS';
  }

  private defaultOrganizationName(role: Role, type: OrganizationType): string {
    if (role === 'SYSTEM_ADMIN') return 'Paysys Labs';
    if (role === 'AUDITOR') return 'NBP';
    if (type === 'PAYSYS') return 'Paysys Labs';
    if (type === 'VENDOR') return 'Apprise';
    return type;
  }
}
