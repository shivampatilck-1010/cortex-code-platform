/**
 * Cortex Professional Identity System
 *
 * Implements Phase A separation of private authentication identifiers (personal emails)
 * from public professional identities in the virtual platform namespace (@cortex.com).
 *
 * Rules:
 * 1. Deterministic, normalized, collision-safe generation.
 * 2. Virtual namespace: @cortex.com (platform identifier, not external mailbox).
 * 3. Never exposes raw authentication emails or credentials in public profiles.
 * 4. Preserves internal stable user IDs and existing auth mechanisms.
 */

import { User } from './models';

export const CORTEX_VIRTUAL_DOMAIN = 'cortex.com';

export interface ProfessionalIdentityDescriptor {
  userId: string;
  displayName: string;
  authenticationEmail: string;
  professionalEmail: string;
  cortexId: string;
  role: 'student' | 'teacher' | 'admin';
  status: 'active' | 'suspended';
  isVirtualIdentity: boolean;
}

export class ClassroomIdentity {
  /**
   * Normalizes an identity handle or email prefix into a standard alphanumeric handle.
   */
  static normalizeHandle(input: string): string {
    if (!input || typeof input !== 'string') return 'user';
    
    // If an email address is passed, extract the local part before the @
    const rawLocal = input.includes('@') ? input.split('@')[0] : input;
    
    // Normalize: lowercase, replace invalid characters with dots, remove leading/trailing dots
    let normalized = rawLocal
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9.]/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/^[.]+|[.]+$/g, '');

    if (!normalized || normalized.length === 0) {
      normalized = 'user';
    }

    return normalized.slice(0, 30);
  }

  /**
   * Deterministically generates a collision-safe professional Cortex identity.
   * Format: <handle>@cortex.com
   *
   * Collision resolution:
   * If <handle>@cortex.com is already claimed by another user ID, appends a deterministic
   * short suffix derived from the stable internal user ID:
   * <handle>.<user_id_suffix>@cortex.com
   */
  static generateProfessionalIdentity(
    user: { id: string; email: string; name?: string; cortex_id?: string },
    existingClaimedIdentities?: Map<string, string> | Set<string>
  ): string {
    const emailLower = (user.email || '').toLowerCase().trim();

    // Explicit owner mapping guarantee
    if (emailLower === 'shivampatilcka@gmail.com') {
      return `shivampatilcka@${CORTEX_VIRTUAL_DOMAIN}`;
    }

    // Determine primary candidate base handle
    let baseHandle = '';

    // If user already has a valid cortex_id (and it's not a timestamp)
    if (user.cortex_id && typeof user.cortex_id === 'string' && user.cortex_id.trim().length >= 3) {
      const cid = user.cortex_id.toLowerCase().trim();
      // If it's not pure digits (like timestamps 1789283480260)
      if (!/^\d+$/.test(cid)) {
        baseHandle = this.normalizeHandle(cid);
      }
    }

    // Fall back to the local part of their authentication email
    if (!baseHandle || baseHandle === 'user') {
      baseHandle = this.normalizeHandle(emailLower);
    }

    // Fall back to normalized display name
    if ((!baseHandle || baseHandle === 'user') && user.name) {
      baseHandle = this.normalizeHandle(user.name.replace(/\s+/g, '.'));
    }

    // Ensure non-empty
    if (!baseHandle || baseHandle.length < 2) {
      const cleanId = (user.id || 'usr').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-6);
      baseHandle = `user.${cleanId}`;
    }

    const primaryCandidate = `${baseHandle}@${CORTEX_VIRTUAL_DOMAIN}`;

    // If no existing claims map provided, return primary candidate
    if (!existingClaimedIdentities) {
      return primaryCandidate;
    }

    // Check for collision
    // If existingClaimedIdentities is a Map<identity, claimedByUserId>
    if (existingClaimedIdentities instanceof Map) {
      const existingOwner = existingClaimedIdentities.get(primaryCandidate.toLowerCase());
      if (!existingOwner || existingOwner === user.id) {
        existingClaimedIdentities.set(primaryCandidate.toLowerCase(), user.id);
        return primaryCandidate;
      }
    } else if (existingClaimedIdentities instanceof Set) {
      if (!existingClaimedIdentities.has(primaryCandidate.toLowerCase())) {
        existingClaimedIdentities.add(primaryCandidate.toLowerCase());
        return primaryCandidate;
      }
    }

    // Collision detected: Append deterministic suffix from internal stable user ID
    const idSuffix = (user.id || 'usr')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase()
      .slice(-4);

    const collisionCandidate = `${baseHandle}.${idSuffix || '1'}@${CORTEX_VIRTUAL_DOMAIN}`;
    
    if (existingClaimedIdentities instanceof Map) {
      existingClaimedIdentities.set(collisionCandidate.toLowerCase(), user.id);
    } else if (existingClaimedIdentities instanceof Set) {
      existingClaimedIdentities.add(collisionCandidate.toLowerCase());
    }

    return collisionCandidate;
  }

  /**
   * Masks an authentication email for safe display in logs and reports.
   * Example: shivampatilcka@gmail.com -> sh**********ka@gmail.com
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email || 'UNSET';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 4))}${local.slice(-2)}@${domain}`;
  }

  /**
   * Checks whether an email string belongs to the virtual platform namespace.
   */
  static isVirtualCortexIdentity(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    return email.toLowerCase().trim().endsWith(`@${CORTEX_VIRTUAL_DOMAIN}`);
  }

  /**
   * Formats a public user profile, guaranteeing that the private authentication email
   * is replaced with the professional Cortex identity.
   */
  static getPublicProfile(user: User): {
    id: string;
    name: string;
    professionalEmail: string;
    cortexId: string;
    role: string;
    avatar?: string;
    status: string;
  } {
    const profEmail =
      user.professional_email ||
      user.professionalEmail ||
      this.generateProfessionalIdentity(user);

    return {
      id: user.id,
      name: user.name,
      professionalEmail: profEmail,
      cortexId: user.cortex_id || user.cortexId || user.id,
      role: user.role,
      avatar: user.avatar,
      status: user.status,
    };
  }
}
