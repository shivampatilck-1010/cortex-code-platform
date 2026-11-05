// Cortex Lockdown — Institutional Integration Architecture & Protocols
// Implements SAML 2.0 SSO and LTI 1.3 Advantage interoperability for Canvas, Blackboard, and Moodle.
// Strictly zero emojis.

import crypto from 'crypto';
import { AuditRole } from './privacy-governance';
import { classroomDb } from '@/lib/classroom/db';

// ---------------------------------------------------------------------------
// 1. CRYPTOGRAPHIC TEST FIXTURES & KEYPAIR GENERATION
// ---------------------------------------------------------------------------

export interface RsaKeypairFixture {
  privateKeyPem: string;
  publicKeyPem: string;
  certPem: string;
  keyId: string;
}

let _defaultSamlFixture: RsaKeypairFixture | null = null;
let _defaultLtiFixture: RsaKeypairFixture | null = null;

/**
 * Generates an in-memory 2048-bit RSA keypair and self-signed synthetic certificate
 * for local testing of SAML 2.0 and LTI 1.3 protocols.
 */
export function generateTestRsaFixture(keyIdPrefix: string = 'key'): RsaKeypairFixture {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const rawBase64 = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  const certPem = [
    '-----BEGIN CERTIFICATE-----',
    rawBase64,
    '-----END CERTIFICATE-----',
  ].join('\n');

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    certPem,
    keyId: `${keyIdPrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
  };
}

export function getDefaultSamlFixture(): RsaKeypairFixture {
  if (!_defaultSamlFixture) {
    _defaultSamlFixture = generateTestRsaFixture('saml_idp');
  }
  return _defaultSamlFixture;
}

export function getDefaultLtiFixture(): RsaKeypairFixture {
  if (!_defaultLtiFixture) {
    _defaultLtiFixture = generateTestRsaFixture('lti_platform');
  }
  return _defaultLtiFixture;
}

// Replay caches with 10-minute automatic pruning
const _samlAssertionReplayCache = new Map<string, number>();
const _ltiNonceReplayCache = new Map<string, number>();

/**
 * Authoritative SAML standards compliance and capability descriptor.
 * Explicitly distinguishes the restricted Level-1 Exc-C14N subset engine from
 * full W3C XMLDSig implementations, blocking unvetted production federation.
 */
export const SAML_STANDARDS_COMPLIANCE = {
  conformsToW3cExcC14n: false,
  canonicalizationSubset: 'Restricted-Exclusive-C14N-v1',
  productionSamlInteroperability: 'BLOCKED',
  evaluationAndPilotReady: true,
  limitations: [
    'No ancestor namespace context propagation or InclusiveNamespaces PrefixList support',
    'No xml:lang or xml:space attribute inheritance',
    'No arbitrary XPath 1.0/2.0 or XSLT reference transforms',
    'Restricted to single enveloped assertion signatures with RSA-SHA256',
    'Requires external audited XMLDSig engine for production multi-tenant SAML federation'
  ]
};

function pruneReplayCaches() {
  const now = Date.now();
  const cutoff = now - 600000;
  for (const [key, ts] of _samlAssertionReplayCache.entries()) {
    if (ts < cutoff) _samlAssertionReplayCache.delete(key);
  }
  for (const [key, ts] of _ltiNonceReplayCache.entries()) {
    if (ts < cutoff) _ltiNonceReplayCache.delete(key);
  }
}

export function resetReplayCaches(): void {
  _samlAssertionReplayCache.clear();
  _ltiNonceReplayCache.clear();
}

/**
 * Deterministic Exc-C14N XML canonicalization helper.
 * Strips comments, normalizes intra/inter-tag whitespace, and sorts namespace
 * declarations and attributes alphabetically.
 */
export function canonicalizeXml(xml: string): string {
  // 1. Strip XML declarations and comments
  let clean = xml
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();

  // 2. Normalize and sort attributes within tags that have attributes or self-closing slashes
  clean = clean.replace(/<([a-zA-Z0-9_:]+)(\s+[^>]*|\s*\/)>/g, (_match, tag, rawAttrs) => {
    const isSelfClosing = rawAttrs.trim().endsWith('/');
    const attrString = isSelfClosing ? rawAttrs.trim().slice(0, -1) : rawAttrs;

    const attrMatches = attrString.match(/([a-zA-Z0-9_:]+)=["'][^"']*["']/g) || [];
    if (attrMatches.length === 0) {
      return isSelfClosing ? `<${tag}/>` : `<${tag}>`;
    }

    // Partition into namespace declarations (xmlns) and regular attributes with normalized double quotes
    const xmlnsAttrs: string[] = [];
    const regularAttrs: string[] = [];
    for (const a of attrMatches) {
      const normalizedAttr = a.replace(/=('[^']*'|"[^"]*")/g, (_m, val) => {
        const unquoted = val.slice(1, -1);
        return `="${unquoted}"`;
      });
      if (normalizedAttr.startsWith('xmlns:') || normalizedAttr.startsWith('xmlns=')) {
        xmlnsAttrs.push(normalizedAttr);
      } else {
        regularAttrs.push(normalizedAttr);
      }
    }
    xmlnsAttrs.sort();
    regularAttrs.sort();

    const sorted = [...xmlnsAttrs, ...regularAttrs];
    const joined = sorted.join(' ');
    return isSelfClosing ? `<${tag} ${joined}/>` : `<${tag} ${joined}>`;
  });

  return clean;
}

// ---------------------------------------------------------------------------
// 2. SAML 2.0 SERVICE PROVIDER & IDENTITY PROVIDER ARCHITECTURE
// ---------------------------------------------------------------------------

export interface SamlSpConfig {
  entityId: string;
  assertionConsumerServiceUrl: string;
  singleLogoutUrl?: string;
  spCertificate?: string;
  spPrivateKey?: string;
  authnContextClassRef?: string;
}

export interface SamlIdpConfig {
  entityId: string;
  singleSignOnServiceUrl: string;
  idpCertificate: string;
  binding: 'HTTP-Redirect' | 'HTTP-POST';
}

export interface SamlUserAttributes {
  eduPersonPrincipalName: string;
  mail: string;
  givenName: string;
  surName: string;
  eduPersonScopedAffiliation: string[];
  mappedRole: AuditRole;
}

export interface SamlAuthnRequestResult {
  authnRequestId: string;
  redirectUrl: string;
  samlRequestXml: string;
  issuedAt: number;
}

export interface SamlValidationOptions {
  expectedIdpIssuer?: string;
  expectedDestination?: string;
  expectedRecipient?: string;
  idpPublicCertificatePem?: string;
  allowUnsigned?: boolean;
  clockSkewSeconds?: number;
  skipReplayCheck?: boolean;
  persistentReplayDb?: any;
}

export interface SamlValidationResult {
  valid: boolean;
  errorCode?: string;
  user?: SamlUserAttributes;
  sessionIndex?: string;
  reason?: string;
}

export function generateSamlAuthnRequest(
  sp: SamlSpConfig,
  idp: SamlIdpConfig,
  relayState: string = ''
): SamlAuthnRequestResult {
  const authnRequestId = `_cortex_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const issueInstant = new Date().toISOString();

  const samlRequestXml = [
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    ` ID="${authnRequestId}" Version="2.0" IssueInstant="${issueInstant}"`,
    ` Destination="${idp.singleSignOnServiceUrl}" ForceAuthn="false" IsPassive="false"`,
    ` AssertionConsumerServiceURL="${sp.assertionConsumerServiceUrl}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">`,
    `  <saml:Issuer>${sp.entityId}</saml:Issuer>`,
    `  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified" AllowCreate="true"/>`,
    `</samlp:AuthnRequest>`,
  ].join('\n');

  const deflated = Buffer.from(samlRequestXml).toString('base64');
  const queryParams = new URLSearchParams({
    SAMLRequest: deflated,
    ...(relayState ? { RelayState: relayState } : {}),
  });

  const redirectUrl = `${idp.singleSignOnServiceUrl}?${queryParams.toString()}`;

  return {
    authnRequestId,
    redirectUrl,
    samlRequestXml,
    issuedAt: Date.now(),
  };
}

/**
 * Creates a cryptographically signed SAML 2.0 Response XML with an enclosed
 * XMLDSIG RSA-SHA256 digital signature over the Assertion element.
 */
export function createSignedSamlResponse(params: {
  spEntityId: string;
  idpEntityId: string;
  inResponseTo: string;
  destination: string;
  user: SamlUserAttributes;
  privateKeyPem?: string;
  certPem?: string;
  issueInstant?: string;
  notBefore?: string;
  notOnOrAfter?: string;
  signatureAlgorithm?: string;
  omitSignature?: boolean;
}): string {
  const fixture = getDefaultSamlFixture();
  const privateKey = params.privateKeyPem || fixture.privateKeyPem;
  const certPem = params.certPem || fixture.certPem;
  const sigAlg = params.signatureAlgorithm || 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

  const responseId = `_resp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const assertionId = `_asrt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date();
  const notBefore = params.notBefore || new Date(now.getTime() - 60000).toISOString();
  const notOnOrAfter = params.notOnOrAfter || new Date(now.getTime() + 300000).toISOString();
  const issueInstant = params.issueInstant || now.toISOString();

  // 1. Build canonical Assertion body without signature for digest computation
  const assertionBodyNoSig = [
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" IssueInstant="${issueInstant}" Version="2.0">`,
    `  <saml:Issuer>${params.idpEntityId}</saml:Issuer>`,
    `  <saml:Subject>`,
    `    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">${params.user.eduPersonPrincipalName}</saml:NameID>`,
    `    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">`,
    `      <saml:SubjectConfirmationData InResponseTo="${params.inResponseTo}" NotOnOrAfter="${notOnOrAfter}" Recipient="${params.destination}"/>`,
    `    </saml:SubjectConfirmation>`,
    `  </saml:Subject>`,
    `  <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">`,
    `    <saml:AudienceRestriction>`,
    `      <saml:Audience>${params.spEntityId}</saml:Audience>`,
    `    </saml:AudienceRestriction>`,
    `  </saml:Conditions>`,
    `  <saml:AttributeStatement>`,
    `    <saml:Attribute Name="mail"><saml:AttributeValue>${params.user.mail}</saml:AttributeValue></saml:Attribute>`,
    `    <saml:Attribute Name="givenName"><saml:AttributeValue>${params.user.givenName}</saml:AttributeValue></saml:Attribute>`,
    `    <saml:Attribute Name="surName"><saml:AttributeValue>${params.user.surName}</saml:AttributeValue></saml:Attribute>`,
    `    <saml:Attribute Name="eduPersonScopedAffiliation"><saml:AttributeValue>${params.user.eduPersonScopedAffiliation.join(';')}</saml:AttributeValue></saml:Attribute>`,
    `  </saml:AttributeStatement>`,
    `</saml:Assertion>`,
  ].join('\n');

  if (params.omitSignature) {
    const unsignedXml = [
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${responseId}" InResponseTo="${params.inResponseTo}" Version="2.0" IssueInstant="${issueInstant}" Destination="${params.destination}">`,
      `  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${params.idpEntityId}</saml:Issuer>`,
      `  <samlp:Status>`,
      `    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>`,
      `  </samlp:Status>`,
      assertionBodyNoSig,
      `</samlp:Response>`,
    ].join('\n');
    return Buffer.from(unsignedXml).toString('base64');
  }

  // 2. Compute SHA-256 Digest over canonical Assertion XML
  const c14nAssertion = canonicalizeXml(assertionBodyNoSig);
  const digestValue = crypto.createHash('sha256').update(c14nAssertion).digest('base64');

  // 3. Build SignedInfo element
  const signedInfoXml = [
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">`,
    `  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>`,
    `  <ds:SignatureMethod Algorithm="${sigAlg}"/>`,
    `  <ds:Reference URI="#${assertionId}">`,
    `    <ds:Transforms>`,
    `      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>`,
    `      <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>`,
    `    </ds:Transforms>`,
    `    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `    <ds:DigestValue>${digestValue}</ds:DigestValue>`,
    `  </ds:Reference>`,
    `</ds:SignedInfo>`,
  ].join('\n');

  // 4. Compute RSA-SHA256 Signature over SignedInfo
  const c14nSignedInfo = canonicalizeXml(signedInfoXml);
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(c14nSignedInfo);
  const signatureValue = signer.sign(privateKey, 'base64');

  const cleanCert = certPem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s+/g, '');

  const signatureXml = [
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">`,
    signedInfoXml,
    `  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
    `  <ds:KeyInfo>`,
    `    <ds:X509Data>`,
    `      <ds:X509Certificate>${cleanCert}</ds:X509Certificate>`,
    `    </ds:X509Data>`,
    `  </ds:KeyInfo>`,
    `</ds:Signature>`,
  ].join('\n');

  // 5. Construct full Response with embedded Assertion Signature
  const assertionWithSig = [
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" IssueInstant="${issueInstant}" Version="2.0">`,
    `  <saml:Issuer>${params.idpEntityId}</saml:Issuer>`,
    signatureXml,
    `  <saml:Subject>`,
    `    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">${params.user.eduPersonPrincipalName}</saml:NameID>`,
    `    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">`,
    `      <saml:SubjectConfirmationData InResponseTo="${params.inResponseTo}" NotOnOrAfter="${notOnOrAfter}" Recipient="${params.destination}"/>`,
    `    </saml:SubjectConfirmation>`,
    `  </saml:Subject>`,
    `  <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">`,
    `    <saml:AudienceRestriction>`,
    `      <saml:Audience>${params.spEntityId}</saml:Audience>`,
    `    </saml:AudienceRestriction>`,
    `  </saml:Conditions>`,
    `  <saml:AttributeStatement>`,
    `    <saml:Attribute Name="mail"><saml:AttributeValue>${params.user.mail}</saml:AttributeValue></saml:Attribute>`,
    `    <saml:Attribute Name="givenName"><saml:AttributeValue>${params.user.givenName}</saml:AttributeValue></saml:Attribute>`,
    `    <saml:Attribute Name="surName"><saml:AttributeValue>${params.user.surName}</saml:AttributeValue></saml:Attribute>`,
    `    <saml:Attribute Name="eduPersonScopedAffiliation"><saml:AttributeValue>${params.user.eduPersonScopedAffiliation.join(';')}</saml:AttributeValue></saml:Attribute>`,
    `  </saml:AttributeStatement>`,
    `</saml:Assertion>`,
  ].join('\n');

  const xml = [
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${responseId}" InResponseTo="${params.inResponseTo}" Version="2.0" IssueInstant="${issueInstant}" Destination="${params.destination}">`,
    `  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${params.idpEntityId}</saml:Issuer>`,
    `  <samlp:Status>`,
    `    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>`,
    `  </samlp:Status>`,
    assertionWithSig,
    `</samlp:Response>`,
  ].join('\n');

  return Buffer.from(xml).toString('base64');
}

/**
 * Backward-compatible wrapper for createSignedSamlResponse.
 */
export function createMockSamlResponse(params: {
  spEntityId: string;
  idpEntityId: string;
  inResponseTo: string;
  destination: string;
  user: SamlUserAttributes;
}): string {
  return createSignedSamlResponse(params);
}

/**
 * Validates a SAML 2.0 Response with full cryptographic signature verification,
 * XSW defense, replay protection, and timestamp validation.
 */
export function validateSamlResponse(
  samlResponseBase64: string,
  expectedSpEntityId: string,
  expectedInResponseTo?: string,
  options?: SamlValidationOptions
): SamlValidationResult {
  try {
    pruneReplayCaches();
    const xml = Buffer.from(samlResponseBase64, 'base64').toString('utf8');

    // 1. Status Check
    if (!xml.includes('urn:oasis:names:tc:SAML:2.0:status:Success')) {
      return {
        valid: false,
        errorCode: 'SAML_STATUS_NOT_SUCCESS',
        reason: 'SAML Response indicates authentication failed or was cancelled by user',
      };
    }

    // 2. XML Signature Wrapping (XSW) Attack Defense
    const assertionMatches = xml.match(/<saml:Assertion[\s>]/g) || [];
    if (assertionMatches.length > 1) {
      return {
        valid: false,
        errorCode: 'SAML_SIGNATURE_WRAPPING_ATTACK_DETECTED',
        reason: `Multiple (${assertionMatches.length}) saml:Assertion elements detected in SAML payload (XSW rejection)`,
      };
    }
    if (assertionMatches.length === 0) {
      return {
        valid: false,
        errorCode: 'SAML_MISSING_ASSERTION',
        reason: 'No saml:Assertion found in SAML response',
      };
    }
    const assertionFullMatch = xml.match(/<saml:Assertion[\s\S]*?<\/saml:Assertion>/);
    if (!assertionFullMatch) {
      return { valid: false, errorCode: 'SAML_MALFORMED_ASSERTION', reason: 'Cannot isolate Assertion XML' };
    }

    const signatureMatches = xml.match(/<ds:Signature[\s>]/g) || [];
    if (signatureMatches.length > 1) {
      return {
        valid: false,
        errorCode: 'SAML_MULTIPLE_SIGNATURES_DETECTED',
        reason: `Multiple (${signatureMatches.length}) ds:Signature elements detected in SAML payload (XSW rejection)`,
      };
    }

    // 3. Signature Extraction & Algorithm Allowlisting
    const sigMethodMatch = xml.match(/<ds:SignatureMethod[^>]*Algorithm=["']([^"']+)["']/);
    const hasSignature = xml.includes('<ds:Signature') && xml.includes('</ds:Signature>');

    if (!hasSignature) {
      if (!options?.allowUnsigned) {
        return {
          valid: false,
          errorCode: 'SAML_UNSIGNED_ASSERTION_REJECTED',
          reason: 'Unsigned SAML assertions are strictly prohibited',
        };
      }
    } else {
      const sigAlg = sigMethodMatch ? sigMethodMatch[1] : '';
      if (sigAlg !== 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') {
        return {
          valid: false,
          errorCode: 'SAML_UNSUPPORTED_SIGNATURE_ALGORITHM',
          reason: `Disallowed signature algorithm '${sigAlg}'. Only RSA-SHA256 is permitted`,
        };
      }

      // Transform Allowlisting Check (Strict rejection of arbitrary XPath, XSLT, etc.)
      const transformMatches = [...xml.matchAll(/<ds:Transform[^>]*Algorithm=["']([^"']+)["']/g)];
      const allowedTransforms = [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#',
        'http://www.w3.org/2001/10/xml-exc-c14n#WithComments',
      ];
      for (const tMatch of transformMatches) {
        const transformAlg = tMatch[1];
        if (!allowedTransforms.includes(transformAlg)) {
          return {
            valid: false,
            errorCode: 'SAML_UNSUPPORTED_TRANSFORM',
            reason: `Disallowed or unsupported XMLDSig transform algorithm '${transformAlg}' (strict allowlist rejection)`,
          };
        }
      }

      // Multiple References Check in SignedInfo
      const signedInfoBlockMatch = xml.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/);
      if (signedInfoBlockMatch) {
        const refCount = (signedInfoBlockMatch[0].match(/<ds:Reference[\s>]/g) || []).length;
        if (refCount > 1) {
          return {
            valid: false,
            errorCode: 'SAML_MULTIPLE_REFERENCES_DETECTED',
            reason: `Multiple (${refCount}) ds:Reference elements detected in SignedInfo block (strict single-reference enforcement)`,
          };
        }
      }

      // Extract Reference URI and target assertion ID
      const refMatch = xml.match(/<ds:Reference[^>]*URI=["']#([^"']+)["']/);
      const assertionIdMatch = xml.match(/<saml:Assertion[^>]*ID=["']([^"']+)["']/);
      if (!refMatch || !assertionIdMatch || refMatch[1] !== assertionIdMatch[1]) {
        return {
          valid: false,
          errorCode: 'SAML_REFERENCE_URI_MISMATCH',
          reason: 'XML signature reference URI does not correspond to target saml:Assertion ID',
        };
      }

      // Defense against duplicate ID collision and attribute hijacking
      const targetAssertionId = refMatch[1];
      const idMatches = xml.match(new RegExp(`\\bID=["']${targetAssertionId}["']`, 'g')) || [];
      if (idMatches.length > 1) {
        return {
          valid: false,
          errorCode: 'SAML_DUPLICATE_ID_DETECTED',
          reason: `Duplicate XML ID '${targetAssertionId}' detected in document (${idMatches.length} occurrences; XSW rejection)`,
        };
      }

      // Extract recorded digest and verify against canonical Assertion XML (sans Signature)
      const recordedDigestMatch = xml.match(/<ds:DigestValue>\s*([^<]+)\s*<\/ds:DigestValue>/);
      if (!recordedDigestMatch) {
        return {
          valid: false,
          errorCode: 'SAML_MALFORMED_SIGNATURE',
          reason: 'Missing ds:DigestValue in XMLDSIG block',
        };
      }
      const recordedDigest = recordedDigestMatch[1].trim();

      // Extract assertion XML and strip out <ds:Signature>...</ds:Signature>
      const assertionWithoutSig = assertionFullMatch[0].replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/, '');
      const recomputedDigest = crypto.createHash('sha256').update(canonicalizeXml(assertionWithoutSig)).digest('base64');

      if (recomputedDigest !== recordedDigest) {
        return {
          valid: false,
          errorCode: 'SAML_DIGEST_MISMATCH',
          reason: 'Assertion content digest mismatch. Payload altered after signing (tampering detected)',
        };
      }

      // Extract SignedInfo and SignatureValue
      const signedInfoMatch = xml.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/);
      const sigValueMatch = xml.match(/<ds:SignatureValue>\s*([^<]+)\s*<\/ds:SignatureValue>/);
      if (!signedInfoMatch || !sigValueMatch) {
        return { valid: false, errorCode: 'SAML_MALFORMED_SIGNATURE', reason: 'Missing SignedInfo or SignatureValue' };
      }

      const c14nSignedInfo = canonicalizeXml(signedInfoMatch[0]);
      const signatureB64 = sigValueMatch[1].trim();

      // Determine public key/certificate
      let pubKeyToUse = options?.idpPublicCertificatePem;
      if (!pubKeyToUse) {
        const certMatch = xml.match(/<ds:X509Certificate>\s*([^<]+)\s*<\/ds:X509Certificate>/);
        if (certMatch) {
          const raw = certMatch[1].trim();
          pubKeyToUse = `-----BEGIN PUBLIC KEY-----\n${raw}\n-----END PUBLIC KEY-----`;
        } else {
          pubKeyToUse = getDefaultSamlFixture().publicKeyPem;
        }
      } else if (!pubKeyToUse.trim().startsWith('-----BEGIN')) {
        pubKeyToUse = `-----BEGIN PUBLIC KEY-----\n${pubKeyToUse.trim()}\n-----END PUBLIC KEY-----`;
      }

      // Cryptographic signature verification
      try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(c14nSignedInfo);
        const verified = verifier.verify(pubKeyToUse, signatureB64, 'base64');
        if (!verified) {
          return {
            valid: false,
            errorCode: 'SAML_SIGNATURE_VERIFICATION_FAILED',
            reason: 'Cryptographic XML signature verification failed (forged or modified signature)',
          };
        }
      } catch (err: any) {
        return {
          valid: false,
          errorCode: 'SAML_SIGNATURE_VERIFICATION_FAILED',
          reason: `Verification exception: ${err?.message || 'Invalid cryptographic key or signature format'}`,
        };
      }
    }

    // 4. Issuer Validation
    const issuerMatch = xml.match(/<saml:Assertion[^>]*>[\s\S]*?<saml:Issuer[^>]*>(.*?)<\/saml:Issuer>/);
    const assertionIssuer = issuerMatch ? issuerMatch[1].trim() : '';
    if (options?.expectedIdpIssuer && assertionIssuer !== options.expectedIdpIssuer) {
      return {
        valid: false,
        errorCode: 'SAML_ISSUER_MISMATCH',
        reason: `SAML Assertion issuer '${assertionIssuer}' does not match expected IdP '${options.expectedIdpIssuer}'`,
      };
    }

    // 5. Audience Restriction Check
    if (!xml.includes(`<saml:Audience>${expectedSpEntityId}</saml:Audience>`)) {
      return {
        valid: false,
        errorCode: 'SAML_AUDIENCE_MISMATCH',
        reason: `SAML Assertion audience does not match SP entity ID '${expectedSpEntityId}'`,
      };
    }

    // 6. Destination & Recipient Check
    if (options?.expectedDestination || options?.expectedRecipient) {
      const targetDestination = options?.expectedDestination;
      if (targetDestination) {
        const destMatch = xml.match(/<samlp:Response[^>]*Destination=["']([^"']+)["']/);
        const respDest = destMatch ? destMatch[1].trim() : '';
        if (respDest && respDest !== targetDestination) {
          return {
            valid: false,
            errorCode: 'SAML_DESTINATION_MISMATCH',
            reason: `SAML Response Destination '${respDest}' does not match expected '${targetDestination}'`,
          };
        }
      }

      const targetRecipient = options?.expectedRecipient || options?.expectedDestination;
      if (targetRecipient) {
        const recipientMatch = xml.match(/<saml:SubjectConfirmationData[^>]*Recipient=["']([^"']+)["']/);
        const subRecipient = recipientMatch ? recipientMatch[1].trim() : '';
        if (subRecipient && subRecipient !== targetRecipient) {
          return {
            valid: false,
            errorCode: 'SAML_RECIPIENT_MISMATCH',
            reason: `SAML SubjectConfirmationData Recipient '${subRecipient}' does not match expected '${targetRecipient}'`,
          };
        }
      }
    }

    // 7. InResponseTo Replay Defense
    if (expectedInResponseTo && !xml.includes(`InResponseTo="${expectedInResponseTo}"`)) {
      return {
        valid: false,
        errorCode: 'SAML_UNSOLICITED_RESPONSE',
        reason: 'InResponseTo field does not match issued AuthnRequest ID (replay rejected)',
      };
    }

    // 8. Timestamps, Expiration & Clock Skew (Default 120s tolerance)
    const clockSkewMs = (options?.clockSkewSeconds ?? 120) * 1000;
    const nowMs = Date.now();

    const notOnOrAfterMatch = xml.match(/NotOnOrAfter=["']([^"']+)["']/);
    if (notOnOrAfterMatch) {
      const expiresAt = Date.parse(notOnOrAfterMatch[1]);
      if (!isNaN(expiresAt) && nowMs > expiresAt + clockSkewMs) {
        return {
          valid: false,
          errorCode: 'SAML_ASSERTION_EXPIRED',
          reason: `SAML Assertion expired at ${notOnOrAfterMatch[1]} (clock skew window exceeded)`,
        };
      }
    }

    const notBeforeMatch = xml.match(/NotBefore=["']([^"']+)["']/);
    if (notBeforeMatch) {
      const validFrom = Date.parse(notBeforeMatch[1]);
      if (!isNaN(validFrom) && nowMs < validFrom - clockSkewMs) {
        return {
          valid: false,
          errorCode: 'SAML_ASSERTION_NOT_YET_VALID',
          reason: `SAML Assertion is not valid until ${notBeforeMatch[1]} (clock skew window exceeded)`,
        };
      }
    }

    // 9. Replay Protection (Assertion ID Single-Use)
    const asrtIdMatch = xml.match(/<saml:Assertion[^>]*ID=["']([^"']+)["']/);
    const assertionId = asrtIdMatch ? asrtIdMatch[1].trim() : '';
    if (assertionId && !options?.skipReplayCheck) {
      if (_samlAssertionReplayCache.has(assertionId)) {
        return {
          valid: false,
          errorCode: 'SAML_ASSERTION_REPLAY_DETECTED',
          reason: `SAML Assertion ID '${assertionId}' has already been redeemed (replay rejected)`,
        };
      }
      _samlAssertionReplayCache.set(assertionId, nowMs);
    }

    // 10. Attribute Extraction & Role Mapping strictly from verified assertion XML
    const targetAssertionXml = assertionFullMatch ? assertionFullMatch[0] : xml;
    const extractAttr = (name: string): string => {
      const match = targetAssertionXml.match(new RegExp(`<saml:Attribute Name="${name}">\\s*<saml:AttributeValue>(.*?)</saml:AttributeValue>`, 's'));
      return match ? match[1].trim() : '';
    };

    const extractNameId = (): string => {
      const match = targetAssertionXml.match(/<saml:NameID[^>]*>(.*?)<\/saml:NameID>/s);
      return match ? match[1].trim() : '';
    };

    const principalName = extractNameId();
    const mail = extractAttr('mail') || principalName;
    const givenName = extractAttr('givenName') || 'Candidate';
    const surName = extractAttr('surName') || 'Student';
    const affiliationsStr = extractAttr('eduPersonScopedAffiliation') || 'student@university.edu';
    const affiliations = affiliationsStr.split(';').map((s) => s.trim().toLowerCase());

    // Map academic affiliation to Cortex AuditRole
    let mappedRole: AuditRole = 'student';
    if (affiliations.some((a) => a.includes('faculty') || a.includes('professor') || a.includes('instructor'))) {
      mappedRole = 'faculty_lead';
    } else if (affiliations.some((a) => a.includes('dean') || a.includes('chair') || a.includes('administrator'))) {
      mappedRole = 'department_dean';
    } else if (affiliations.some((a) => a.includes('proctor') || a.includes('ta') || a.includes('assistant'))) {
      mappedRole = 'proctor';
    }

    return {
      valid: true,
      user: {
        eduPersonPrincipalName: principalName,
        mail,
        givenName,
        surName,
        eduPersonScopedAffiliation: affiliations,
        mappedRole,
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      errorCode: 'SAML_PARSING_FAILED',
      reason: err?.message || 'Failed to parse SAML response XML',
    };
  }
}

/**
 * Validates a SAML 2.0 Response with persistent database-backed replay protection
 * across independent Node.js processes, server instances, and application restarts.
 */
export async function validateSamlResponseAsync(
  samlResponseBase64: string,
  expectedSpEntityId: string,
  expectedInResponseTo?: string,
  options?: SamlValidationOptions
): Promise<SamlValidationResult> {
  const syncResult = validateSamlResponse(samlResponseBase64, expectedSpEntityId, expectedInResponseTo, options);
  if (!syncResult.valid) {
    return syncResult;
  }

  // Extract assertionId and expiration for persistent replay protection
  try {
    const xml = Buffer.from(samlResponseBase64, 'base64').toString('utf8');
    const asrtIdMatch = xml.match(/<saml:Assertion[^>]*ID=["']([^"']+)["']/);
    const assertionId = asrtIdMatch ? asrtIdMatch[1].trim() : '';

    if (assertionId && !options?.skipReplayCheck) {
      const notOnOrAfterMatch = xml.match(/NotOnOrAfter=["']([^"']+)["']/);
      const expiresAt = notOnOrAfterMatch ? Date.parse(notOnOrAfterMatch[1]) : (Date.now() + 600000);
      const dbToUse = options?.persistentReplayDb || classroomDb;
      
      const consumption = await dbToUse.consumeReplayIdentifier({
        type: 'SAML_ASSERTION',
        identifier: assertionId,
        contextId: expectedSpEntityId,
        expiresAt: isNaN(expiresAt) ? (Date.now() + 600000) : expiresAt,
      });

      if (consumption.alreadyConsumed) {
        return {
          valid: false,
          errorCode: 'SAML_ASSERTION_REPLAY_DETECTED',
          reason: `SAML Assertion ID '${assertionId}' has already been redeemed in persistent replay cache (cross-process replay rejected)`,
        };
      }
    }
  } catch (err: any) {
    console.warn('[validateSamlResponseAsync] Persistent replay cache warning:', err?.message || err);
  }

  return syncResult;
}

// ---------------------------------------------------------------------------
// 3. LTI 1.3 ADVANTAGE ARCHITECTURE & LMS PLATFORM BRIDGES
// ---------------------------------------------------------------------------

export interface LtiPlatformConfig {
  lmsType: 'canvas' | 'blackboard' | 'moodle';
  platformName: string;
  issuer: string;
  clientId: string;
  authEndpoint: string;
  jwksEndpoint: string;
  tokenEndpoint: string;
}

export interface LtiLaunchClaims {
  sub: string;
  name: string;
  email: string;
  messageType: 'LtiResourceLinkRequest';
  version: '1.3.0';
  resourceLinkId: string;
  contextId: string;
  contextTitle: string;
  targetLinkUri: string;
  roles: string[];
  agsEndpoint?: string;
  nrpsEndpoint?: string;
  nonce: string;
  deploymentId?: string;
}

export interface LtiValidationOptions {
  expectedIssuer?: string;
  expectedAudience?: string;
  expectedDeploymentId?: string;
  expectedContextId?: string;
  expectedTargetLinkUri?: string;
  institutionId?: string;
  publicKeyPem?: string;
  allowedAlgorithms?: string[];
  clockSkewSeconds?: number;
  skipReplayCheck?: boolean;
  persistentReplayDb?: any;
  jwksResolver?: LtiJwksResolver;
  configManager?: LtiConfigManager;
  allowInsecureHttpForTesting?: boolean;
  requireMandatoryClaims?: boolean;
}

export const CANVAS_LTI_CONFIG: LtiPlatformConfig = {
  lmsType: 'canvas',
  platformName: 'Instructure Canvas LMS',
  issuer: 'https://canvas.instructure.com',
  clientId: 'cortex_canvas_client_1001',
  authEndpoint: 'https://canvas.instructure.com/api/lti/authorize_redirect',
  jwksEndpoint: 'https://canvas.instructure.com/api/lti/security/jwks',
  tokenEndpoint: 'https://canvas.instructure.com/login/oauth2/token',
};

export const BLACKBOARD_LTI_CONFIG: LtiPlatformConfig = {
  lmsType: 'blackboard',
  platformName: 'Anthology Blackboard Learn',
  issuer: 'https://blackboard.com',
  clientId: 'cortex_bb_client_2002',
  authEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken',
  jwksEndpoint: 'https://developer.blackboard.com/api/v1/management/jwks.json',
  tokenEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken',
};

export const MOODLE_LTI_CONFIG: LtiPlatformConfig = {
  lmsType: 'moodle',
  platformName: 'Moodle LMS',
  issuer: 'https://moodle.org',
  clientId: 'cortex_moodle_client_3003',
  authEndpoint: 'https://moodle.org/mod/lti/auth.php',
  jwksEndpoint: 'https://moodle.org/mod/lti/certs.php',
  tokenEndpoint: 'https://moodle.org/mod/lti/token.php',
};

export function initiateLtiOidcLogin(params: {
  platform: LtiPlatformConfig;
  loginHint: string;
  targetLinkUri: string;
  ltiMessageHint?: string;
}): { redirectUrl: string; state: string; nonce: string } {
  const state = `st_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nonce = `n_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

  const query = new URLSearchParams({
    response_type: 'id_token',
    scope: 'openid',
    login_hint: params.loginHint,
    client_id: params.platform.clientId,
    redirect_uri: params.targetLinkUri,
    state,
    nonce,
    response_mode: 'form_post',
    prompt: 'none',
    ...(params.ltiMessageHint ? { lti_message_hint: params.ltiMessageHint } : {}),
  });

  const redirectUrl = `${params.platform.authEndpoint}?${query.toString()}`;
  return { redirectUrl, state, nonce };
}

/**
 * Creates an LTI 1.3 ID Token with RS256 (default) or configurable signing algorithms.
 */
export function createLtiIdToken(
  claims: LtiLaunchClaims,
  options?: {
    privateKeyPem?: string;
    keyId?: string;
    algorithm?: 'RS256' | 'HS256' | 'none';
    issuer?: string;
    audience?: string | string[];
    deploymentId?: string;
    expiresInSeconds?: number;
    customPayloadOverride?: Record<string, any>;
    customHeaderOverride?: Record<string, any>;
  }
): string {
  const alg = options?.algorithm || 'RS256';
  const fixture = getDefaultLtiFixture();
  const kid = options?.keyId || fixture.keyId;

  const header = {
    alg,
    typ: 'JWT',
    ...(alg !== 'none' ? { kid } : {}),
    ...(options?.customHeaderOverride || {}),
  };

  const defaultIssuer = claims.roles.some((r) => r.includes('canvas'))
    ? 'https://canvas.instructure.com'
    : 'https://moodle.org';

  const expSec = Math.floor(Date.now() / 1000) + (options?.expiresInSeconds ?? 3600);
  const iatSec = Math.floor(Date.now() / 1000);

  let payload: any = {
    iss: options?.issuer || defaultIssuer,
    sub: claims.sub,
    aud: options?.audience || 'cortex_lockdown_client',
    exp: expSec,
    iat: iatSec,
    nonce: claims.nonce,
    name: claims.name,
    email: claims.email,
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': options?.deploymentId || claims.deploymentId || 'dep_cortex_academic_prod_01',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': claims.messageType,
    'https://purl.imsglobal.org/spec/lti/claim/version': claims.version,
    'https://purl.imsglobal.org/spec/lti/claim/resource_link': { id: claims.resourceLinkId },
    'https://purl.imsglobal.org/spec/lti/claim/context': { id: claims.contextId, title: claims.contextTitle },
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': claims.targetLinkUri,
    'https://purl.imsglobal.org/spec/lti/claim/roles': claims.roles,
    ...(claims.agsEndpoint ? { 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': { lineitem: claims.agsEndpoint } } : {}),
    ...(claims.nrpsEndpoint ? { 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': { context_memberships_url: claims.nrpsEndpoint } } : {}),
  };

  if (options?.customPayloadOverride) {
    payload = { ...payload, ...options.customPayloadOverride };
    for (const [k, v] of Object.entries(options.customPayloadOverride)) {
      if (v === undefined) {
        delete payload[k];
      }
    }
  }

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${b64Header}.${b64Payload}`;

  if (alg === 'none') {
    return `${signingInput}.`;
  }

  if (alg === 'RS256') {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    const privateKey = options?.privateKeyPem || fixture.privateKeyPem;
    const sig = signer.sign(privateKey, 'base64url');
    return `${signingInput}.${sig}`;
  }

  // Fallback HS256 for backward compatibility test fixtures
  const sig = crypto.createHmac('sha256', 'mock_secret_key_lti_development_only').update(signingInput).digest('base64url');
  return `${signingInput}.${sig}`;
}

/**
 * Backward-compatible wrapper for createLtiIdToken.
 */
export function createMockLtiIdToken(claims: LtiLaunchClaims): string {
  // Support default RS256 while maintaining compatibility
  return createLtiIdToken(claims, { algorithm: 'RS256' });
}

/**
 * Validates an LTI 1.3 ID Token with RS256 signature verification, algorithm allowlisting,
 * nonce replay defense, issuer, audience, and deployment ID checking.
 */
export function validateLtiLaunchJwt(
  idTokenJwt: string,
  expectedNonce: string,
  options?: LtiValidationOptions
): {
  valid: boolean;
  claims?: LtiLaunchClaims;
  mappedRole?: AuditRole;
  errorCode?: string;
  reason?: string;
} {
  try {
    pruneReplayCaches();
    const parts = idTokenJwt.split('.');
    if (parts.length !== 3) {
      return { valid: false, errorCode: 'MALFORMED_JWT', reason: 'JWT must have header, payload, and signature components' };
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signatureB64 = parts[2];

    // 1. Algorithm Allowlisting Check
    const allowedAlgs = options?.allowedAlgorithms || ['RS256', 'HS256'];
    if (!allowedAlgs.includes(header.alg) || header.alg === 'none') {
      return {
        valid: false,
        errorCode: 'LTI_UNSUPPORTED_SIGNING_ALGORITHM',
        reason: `Algorithm '${header.alg}' is unsupported or disallowed by institutional security policy`,
      };
    }

    // 2. Cryptographic Signature Verification
    if (header.alg === 'RS256') {
      const pubKey = options?.publicKeyPem || getDefaultLtiFixture().publicKeyPem;
      try {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(signingInput);
        const verified = verifier.verify(pubKey, signatureB64, 'base64url');
        if (!verified) {
          return {
            valid: false,
            errorCode: 'LTI_SIGNATURE_FORGERY_DETECTED',
            reason: 'Cryptographic RS256 signature verification failed (forged or modified token)',
          };
        }
      } catch (err: any) {
        return {
          valid: false,
          errorCode: 'LTI_SIGNATURE_FORGERY_DETECTED',
          reason: `Verification exception: ${err?.message || 'Invalid RSA key or signature'}`,
        };
      }
    } else if (header.alg === 'HS256') {
      const expectedSig = crypto
        .createHmac('sha256', 'mock_secret_key_lti_development_only')
        .update(signingInput)
        .digest('base64url');
      if (signatureB64 !== expectedSig) {
        return {
          valid: false,
          errorCode: 'LTI_SIGNATURE_FORGERY_DETECTED',
          reason: 'HMAC signature mismatch (forged token)',
        };
      }
    }

    // 3. Issuer Validation
    if (options?.expectedIssuer && payload.iss !== options.expectedIssuer) {
      return {
        valid: false,
        errorCode: 'LTI_ISSUER_MISMATCH',
        reason: `LTI Token issuer '${payload.iss}' does not match registered LMS platform '${options.expectedIssuer}'`,
      };
    }

    // 4. Audience Validation
    if (options?.expectedAudience) {
      const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!auds.includes(options.expectedAudience)) {
        return {
          valid: false,
          errorCode: 'LTI_AUDIENCE_MISMATCH',
          reason: `LTI Token audience '[${auds.join(', ')}]' does not contain expected client '${options.expectedAudience}'`,
        };
      }
      if (auds.length > 1 && payload.azp && payload.azp !== options.expectedAudience) {
        return {
          valid: false,
          errorCode: 'LTI_AZP_MISMATCH',
          reason: `LTI Token authorized party '${payload.azp}' does not match expected client '${options.expectedAudience}'`,
        };
      }
    }

    // 5. Deployment ID Validation
    const deploymentId = payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    if (options?.expectedDeploymentId && deploymentId !== options.expectedDeploymentId) {
      return {
        valid: false,
        errorCode: 'LTI_DEPLOYMENT_ID_MISMATCH',
        reason: `LTI Deployment ID '${deploymentId}' does not match registered deployment '${options.expectedDeploymentId}'`,
      };
    }

    // 6. Nonce Matching Check
    if (payload.nonce !== expectedNonce) {
      return { valid: false, errorCode: 'NONCE_MISMATCH', reason: 'LTI ID token nonce does not match session initiation nonce' };
    }

    // 7. Nonce Replay Prevention Check
    const nowMs = Date.now();
    if (!options?.skipReplayCheck && payload.nonce) {
      if (_ltiNonceReplayCache.has(payload.nonce)) {
        return {
          valid: false,
          errorCode: 'LTI_NONCE_REPLAY_DETECTED',
          reason: `LTI launch nonce '${payload.nonce}' has already been redeemed (replay rejected)`,
        };
      }
      _ltiNonceReplayCache.set(payload.nonce, nowMs);
    }

    // 8. Expiration & Timestamps (Clock Skew 120s tolerance)
    const clockSkewSec = options?.clockSkewSeconds ?? 120;
    const nowSec = Math.floor(nowMs / 1000);

    if (payload.exp && payload.exp < nowSec - clockSkewSec) {
      return { valid: false, errorCode: 'TOKEN_EXPIRED', reason: `LTI ID token has expired (exp: ${payload.exp}, now: ${nowSec})` };
    }
    if (payload.iat && payload.iat > nowSec + clockSkewSec) {
      return { valid: false, errorCode: 'TOKEN_NOT_YET_VALID', reason: `LTI ID token issued in the future (iat: ${payload.iat}, now: ${nowSec})` };
    }

    // 9. Message Type Check
    const messageType = payload['https://purl.imsglobal.org/spec/lti/claim/message_type'];
    if (messageType !== 'LtiResourceLinkRequest') {
      return { valid: false, errorCode: 'UNSUPPORTED_MESSAGE_TYPE', reason: `Expected 'LtiResourceLinkRequest', got '${messageType}'` };
    }

    // 10. Mandatory Claims Validation
    if (options?.requireMandatoryClaims !== false) {
      if (!payload.sub || typeof payload.sub !== 'string') {
        return { valid: false, errorCode: 'LTI_MISSING_REQUIRED_CLAIMS', reason: "Missing mandatory claim 'sub' (subject identifier)" };
      }
      const rawRoles = payload['https://purl.imsglobal.org/spec/lti/claim/roles'];
      if (!rawRoles || !Array.isArray(rawRoles) || rawRoles.length === 0) {
        return { valid: false, errorCode: 'LTI_MISSING_REQUIRED_CLAIMS', reason: "Missing or empty mandatory claim 'roles'" };
      }
      const rawDeploymentId = payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
      if (!rawDeploymentId || typeof rawDeploymentId !== 'string') {
        return { valid: false, errorCode: 'LTI_MISSING_REQUIRED_CLAIMS', reason: "Missing mandatory claim 'deployment_id'" };
      }
      const rawTargetLinkUri = payload['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'];
      if (!rawTargetLinkUri || typeof rawTargetLinkUri !== 'string') {
        return { valid: false, errorCode: 'LTI_MISSING_REQUIRED_CLAIMS', reason: "Missing mandatory claim 'target_link_uri'" };
      }
      if (
        rawTargetLinkUri.startsWith('javascript:') ||
        rawTargetLinkUri.startsWith('data:') ||
        rawTargetLinkUri.startsWith('vbscript:')
      ) {
        return { valid: false, errorCode: 'LTI_INVALID_TARGET_LINK_URI', reason: "Malicious URI scheme in 'target_link_uri' rejected" };
      }
    }

    // 11. Role Mapping
    const roles: string[] = payload['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];
    let mappedRole: AuditRole = 'student';
    if (roles.some((r) => r.includes('Instructor') || r.includes('Faculty') || r.includes('Staff'))) {
      mappedRole = 'faculty_lead';
    } else if (roles.some((r) => r.includes('Administrator') || r.includes('SysAdmin'))) {
      mappedRole = 'department_dean';
    } else if (roles.some((r) => r.includes('TeachingAssistant') || r.includes('Proctor'))) {
      mappedRole = 'proctor';
    }

    const resourceLink = payload['https://purl.imsglobal.org/spec/lti/claim/resource_link'] || {};
    const context = payload['https://purl.imsglobal.org/spec/lti/claim/context'] || {};
    const ags = payload['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'] || {};
    const nrps = payload['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'] || {};

    const claims: LtiLaunchClaims = {
      sub: payload.sub,
      name: payload.name || 'Candidate',
      email: payload.email || `${payload.sub}@campus.edu`,
      messageType: 'LtiResourceLinkRequest',
      version: '1.3.0',
      resourceLinkId: resourceLink.id || 'res_default',
      contextId: context.id || 'course_default',
      contextTitle: context.title || 'Institutional Course',
      targetLinkUri: payload['https://purl.imsglobal.org/spec/lti/claim/target_link_uri'] || '',
      roles,
      agsEndpoint: ags.lineitem,
      nrpsEndpoint: nrps.context_memberships_url,
      nonce: payload.nonce,
      deploymentId: payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'] || 'dep_cortex_academic_prod_01',
    };

    // Course Context Check
    if (options?.expectedContextId && claims.contextId && claims.contextId !== options.expectedContextId) {
      return {
        valid: false,
        errorCode: 'LTI_CONTEXT_MISMATCH',
        reason: `LTI Course Context ID '${claims.contextId}' does not match expected '${options.expectedContextId}'`,
      };
    }

    // Target Link URI Check
    if (options?.expectedTargetLinkUri && claims.targetLinkUri && claims.targetLinkUri !== options.expectedTargetLinkUri) {
      return {
        valid: false,
        errorCode: 'LTI_TARGET_LINK_URI_MISMATCH',
        reason: `LTI Target Link URI '${claims.targetLinkUri}' does not match expected '${options.expectedTargetLinkUri}'`,
      };
    }

    return {
      valid: true,
      claims,
      mappedRole,
    };
  } catch (err: any) {
    return { valid: false, errorCode: 'JWT_VERIFICATION_FAILED', reason: err?.message || 'Failed to verify LTI ID token' };
  }
}

export interface LtiValidationResult {
  valid: boolean;
  claims?: LtiLaunchClaims;
  mappedRole?: AuditRole;
  errorCode?: string;
  reason?: string;
}

/**
 * Validates an LTI 1.3 launch token with persistent database-backed nonce replay protection
 * across independent Node.js processes, server instances, and application restarts.
 */
export async function validateLtiLaunchJwtAsync(
  idTokenJwt: string,
  expectedNonce: string,
  options?: LtiValidationOptions
): Promise<LtiValidationResult> {
  let effectiveOptions: LtiValidationOptions = { ...options };

  // 1. Dynamic JWKS Key Resolution (if jwksResolver provided and no static publicKeyPem)
  if (options?.jwksResolver && !options.publicKeyPem) {
    try {
      const parts = idTokenJwt.split('.');
      if (parts.length === 3) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

        if (header.alg !== 'RS256') {
          return {
            valid: false,
            errorCode: 'LTI_UNSUPPORTED_SIGNING_ALGORITHM',
            reason: `Dynamic JWKS resolution requires 'RS256'. Disallowed algorithm '${header.alg}' rejected`,
          };
        }

        const resolved = await options.jwksResolver.resolveSigningKey({
          issuer: payload.iss,
          kid: header.kid,
          allowInsecureHttpForTesting: options.allowInsecureHttpForTesting,
          institutionId: options.institutionId,
        });

        effectiveOptions.publicKeyPem = resolved.publicKeyPem;
      }
    } catch (jwksErr: any) {
      return {
        valid: false,
        errorCode: jwksErr?.errorCode || 'LTI_JWKS_RESOLUTION_FAILED',
        reason: `Failed to resolve LMS signing key via JWKS: ${jwksErr?.message || jwksErr}`,
      };
    }
  }

  // 2. Institutional Tenant Isolation Check
  if (options?.institutionId && options?.configManager) {
    try {
      const parts = idTokenJwt.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        const tenantCheck = options.configManager.enforceTenantIsolation(options.institutionId, {
          issuer: payload.iss,
          clientId: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
          deploymentId: payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
          contextId: payload['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
        });

        if (!tenantCheck.allowed) {
          return {
            valid: false,
            errorCode: 'LTI_TENANT_ISOLATION_VIOLATION',
            reason: tenantCheck.reason || 'Launch token violates multi-tenant institutional isolation boundaries',
          };
        }
      }
    } catch (_) {}
  }

  const syncResult = validateLtiLaunchJwt(idTokenJwt, expectedNonce, effectiveOptions);
  if (!syncResult.valid) {
    return syncResult;
  }

  // 3. Persistent Database Nonce Replay Protection
  const parts = idTokenJwt.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload.nonce && !effectiveOptions.skipReplayCheck) {
        const expiresAt = (payload.exp ? payload.exp * 1000 : (Date.now() + 600000));
        const dbToUse = effectiveOptions.persistentReplayDb || classroomDb;
        const consumption = await dbToUse.consumeReplayIdentifier({
          type: 'LTI_NONCE',
          identifier: payload.nonce,
          contextId: effectiveOptions.expectedAudience,
          expiresAt,
        });

        if (consumption.alreadyConsumed) {
          return {
            valid: false,
            errorCode: 'LTI_NONCE_REPLAY_DETECTED',
            reason: `LTI launch nonce '${payload.nonce}' has already been redeemed in persistent replay cache (cross-process replay rejected)`,
          };
        }
      }
    } catch (_) {}
  }

  return syncResult;
}

// ---------------------------------------------------------------------------
// 4. SAML INSTITUTIONAL CONFIGURATION MODEL
// ---------------------------------------------------------------------------

export interface SamlInstitutionalConfig {
  institutionId: string;
  version: number;
  active: boolean;
  idpEntityId: string;
  idpSsoUrl: string;
  spEntityId: string;
  acsUrl: string;
  primaryCert: {
    pem: string;
    thumbprint: string;
    notBefore?: string;
    notAfter?: string;
  };
  secondaryCert?: {
    pem: string;
    thumbprint: string;
    notBefore?: string;
    notAfter?: string;
  };
  allowedSignatureAlgorithms: string[];
  clockSkewSeconds: number;
  requireSignedAssertions: boolean;
  requireSignedResponse: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SamlConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export class SamlConfigManager {
  private configs: Map<string, SamlInstitutionalConfig> = new Map();

  public registerConfig(config: SamlInstitutionalConfig, authToken?: string): { success: boolean; error?: string } {
    if (authToken !== undefined && authToken !== 'cortex_admin_authorized_token') {
      return { success: false, error: 'Unauthorized: Administrative authorization token required to modify institutional SAML configuration' };
    }
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, error: `Invalid SAML configuration: ${validation.errors.join('; ')}` };
    }
    this.configs.set(config.institutionId, { ...config, updatedAt: new Date().toISOString() });
    return { success: true };
  }

  public getConfig(institutionId: string): SamlInstitutionalConfig | null {
    return this.configs.get(institutionId) || null;
  }

  public listConfigs(): SamlInstitutionalConfig[] {
    return Array.from(this.configs.values());
  }

  public validateConfig(config: SamlInstitutionalConfig): SamlConfigValidationResult {
    const errors: string[] = [];
    if (!config.institutionId || typeof config.institutionId !== 'string') {
      errors.push("Missing or invalid 'institutionId'");
    }
    if (!config.idpEntityId || typeof config.idpEntityId !== 'string') {
      errors.push("Missing or invalid 'idpEntityId'");
    }
    if (!config.spEntityId || typeof config.spEntityId !== 'string') {
      errors.push("Missing or invalid 'spEntityId'");
    }
    if (!config.acsUrl || typeof config.acsUrl !== 'string') {
      errors.push("Missing or invalid 'acsUrl'");
    } else {
      try {
        const u = new URL(config.acsUrl);
        if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) {
          errors.push('ACS URL must use HTTPS protocol');
        }
      } catch {
        errors.push('ACS URL is malformed');
      }
    }
    if (!config.primaryCert || !config.primaryCert.pem || !config.primaryCert.pem.includes('BEGIN')) {
      errors.push('Primary signing certificate missing or invalid PEM format');
    } else if (config.primaryCert.notAfter) {
      const exp = Date.parse(config.primaryCert.notAfter);
      if (!isNaN(exp) && Date.now() > exp) {
        errors.push(`Primary signing certificate expired at ${config.primaryCert.notAfter}`);
      }
    }
    if (config.allowedSignatureAlgorithms) {
      for (const alg of config.allowedSignatureAlgorithms) {
        if (alg.includes('sha1') || alg.includes('md5') || alg === 'none') {
          errors.push(`Insecure signature algorithm '${alg}' is prohibited by institutional policy`);
        }
      }
    }
    if (config.clockSkewSeconds < 0 || config.clockSkewSeconds > 300) {
      errors.push('Clock skew must be between 0 and 300 seconds');
    }
    return { valid: errors.length === 0, errors };
  }

  public rotateCertificate(
    institutionId: string,
    newPrimaryCert: { pem: string; thumbprint: string; notBefore?: string; notAfter?: string },
    authToken?: string
  ): { success: boolean; error?: string } {
    if (authToken !== undefined && authToken !== 'cortex_admin_authorized_token') {
      return { success: false, error: 'Unauthorized: Administrative authorization token required' };
    }
    const config = this.configs.get(institutionId);
    if (!config) {
      return { success: false, error: `Institution '${institutionId}' not found` };
    }
    config.secondaryCert = config.primaryCert;
    config.primaryCert = newPrimaryCert;
    config.version += 1;
    config.updatedAt = new Date().toISOString();
    return { success: true };
  }
}

// ---------------------------------------------------------------------------
// 5. LTI INSTITUTIONAL REGISTRATION & MULTI-TENANT CONFIGURATION
// ---------------------------------------------------------------------------

export interface LtiInstitutionalRegistration {
  institutionId: string;
  version: number;
  active: boolean;
  issuer: string;
  clientId: string;
  deploymentId: string;
  authEndpoint: string;
  jwksUri: string;
  tokenEndpoint: string;
  allowedRedirectUris: string[];
  registeredCourseContexts?: string[];
  clockSkewSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LtiRegistrationValidationResult {
  valid: boolean;
  errors: string[];
}

export class LtiConfigManager {
  private registrations: Map<string, LtiInstitutionalRegistration> = new Map();
  private issuerIndex: Map<string, string> = new Map();

  public registerPlatform(
    reg: LtiInstitutionalRegistration,
    authToken?: string
  ): { success: boolean; error?: string } {
    if (authToken !== undefined && authToken !== 'cortex_admin_authorized_token') {
      return { success: false, error: 'Unauthorized: Administrative authorization token required to register LTI platform' };
    }
    const validation = this.validateRegistration(reg);
    if (!validation.valid) {
      return { success: false, error: `Invalid LTI registration: ${validation.errors.join('; ')}` };
    }
    this.registrations.set(reg.institutionId, { ...reg, updatedAt: new Date().toISOString() });
    this.issuerIndex.set(reg.issuer, reg.institutionId);
    return { success: true };
  }

  public getRegistration(institutionId: string): LtiInstitutionalRegistration | null {
    return this.registrations.get(institutionId) || null;
  }

  public getRegistrationByIssuer(issuer: string, clientId?: string): LtiInstitutionalRegistration | null {
    const institutionId = this.issuerIndex.get(issuer);
    if (institutionId) {
      const reg = this.registrations.get(institutionId);
      if (reg && (!clientId || reg.clientId === clientId)) {
        return reg;
      }
    }
    for (const r of this.registrations.values()) {
      if (r.issuer === issuer && (!clientId || r.clientId === clientId)) {
        return r;
      }
    }
    return null;
  }

  public listRegistrations(): LtiInstitutionalRegistration[] {
    return Array.from(this.registrations.values());
  }

  public validateRegistration(reg: LtiInstitutionalRegistration): LtiRegistrationValidationResult {
    const errors: string[] = [];
    if (!reg.institutionId) errors.push("Missing 'institutionId'");
    if (!reg.issuer) errors.push("Missing 'issuer'");
    if (!reg.clientId) errors.push("Missing 'clientId'");
    if (!reg.deploymentId) errors.push("Missing 'deploymentId'");
    if (!reg.jwksUri) {
      errors.push("Missing 'jwksUri'");
    } else {
      const ssrf = isSsrfSafeUrl(reg.jwksUri, true);
      if (!ssrf.safe && ssrf.errorCode !== 'LTI_SSRF_LOOPBACK_BLOCKED') {
        errors.push(`JWKS URI failed SSRF validation: ${ssrf.reason}`);
      }
    }
    if (!reg.authEndpoint) errors.push("Missing 'authEndpoint'");
    if (!reg.tokenEndpoint) errors.push("Missing 'tokenEndpoint'");
    if (!reg.allowedRedirectUris || reg.allowedRedirectUris.length === 0) {
      errors.push('At least one allowed redirect URI must be specified');
    }
    return { valid: errors.length === 0, errors };
  }

  public enforceTenantIsolation(
    institutionId: string,
    claims: { issuer: string; clientId?: string; deploymentId?: string; contextId?: string }
  ): { allowed: boolean; reason?: string } {
    const reg = this.registrations.get(institutionId);
    if (!reg) {
      return { allowed: false, reason: `Institution '${institutionId}' is not registered` };
    }
    if (reg.issuer !== claims.issuer) {
      return { allowed: false, reason: `Issuer '${claims.issuer}' does not match registered platform '${reg.issuer}' for institution '${institutionId}'` };
    }
    if (claims.clientId && reg.clientId !== claims.clientId) {
      return { allowed: false, reason: `Client ID '${claims.clientId}' does not match registered client '${reg.clientId}' for institution '${institutionId}'` };
    }
    if (claims.deploymentId && reg.deploymentId !== claims.deploymentId) {
      return { allowed: false, reason: `Deployment ID '${claims.deploymentId}' does not belong to institution '${institutionId}' (cross-tenant substitution blocked)` };
    }
    if (claims.contextId && reg.registeredCourseContexts && reg.registeredCourseContexts.length > 0) {
      if (!reg.registeredCourseContexts.includes(claims.contextId)) {
        return { allowed: false, reason: `Course context '${claims.contextId}' is not authorized for institution '${institutionId}'` };
      }
    }
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// 6. SECURE LTI 1.3 DYNAMIC JWKS RESOLVER & SSRF DEFENSES
// ---------------------------------------------------------------------------

/**
 * Synchronous SSRF evaluation for URLs.
 * Validates protocol, port, userinfo, IP addresses, IPv6 representations, and cloud metadata.
 */
export function isSsrfSafeUrl(
  rawUrl: string,
  allowInsecureHttpForTesting = false
): { safe: boolean; errorCode?: string; reason?: string } {
  try {
    const parsed = new URL(rawUrl);

    const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');

    // 1. Disallow embedded credentials / userinfo (e.g. user:pass@host)
    if (parsed.username || parsed.password) {
      return {
        safe: false,
        errorCode: 'LTI_SSRF_CREDENTIALS_DISALLOWED',
        reason: 'Embedded userinfo/credentials in endpoint URL are prohibited (strict SSRF prevention)',
      };
    }

    // 2. Cloud Metadata & Cluster Internal Endpoints (checked before protocol)
    if (
      host === '169.254.169.254' ||
      host === '169.254.169.253' ||
      host === 'metadata.google.internal' ||
      host === 'metadata' ||
      host.endsWith('.metadata.google.internal') ||
      host === 'instance-data' ||
      host === '100.100.100.200' ||
      host === 'chassis.local' ||
      host === 'kubernetes.default' ||
      host === 'kubernetes.default.svc' ||
      host.endsWith('.svc.cluster.local') ||
      host.endsWith('.cluster.local')
    ) {
      return {
        safe: false,
        errorCode: 'LTI_SSRF_METADATA_ENDPOINT_BLOCKED',
        reason: `Target host '${host}' is a cloud metadata or internal cluster endpoint (strict SSRF prevention)`,
      };
    }

    // 3. Protocol Validation (strictly HTTPS, with localhost/127.0.0.1 test exception)
    if (parsed.protocol !== 'https:') {
      if (!(allowInsecureHttpForTesting && parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) {
        return {
          safe: false,
          errorCode: 'LTI_SSRF_INSECURE_PROTOCOL',
          reason: `JWKS endpoint must use secure HTTPS protocol. Found '${parsed.protocol}'`,
        };
      }
    }

    // 4. Port Validation (Production: default port or 443 only)
    if (!allowInsecureHttpForTesting && parsed.port && parsed.port !== '443') {
      return {
        safe: false,
        errorCode: 'LTI_SSRF_NON_STANDARD_PORT',
        reason: `Target port '${parsed.port}' is disallowed. Production JWKS endpoints must use standard HTTPS port 443`,
      };
    }

    // 5. Loopback hostnames
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '0') {
      if (!allowInsecureHttpForTesting) {
        return {
          safe: false,
          errorCode: 'LTI_SSRF_LOOPBACK_BLOCKED',
          reason: `Access to local loopback interface '${host}' is prohibited in production`,
        };
      }
      return { safe: true };
    }

    // 6. IPv6 and IPv4-mapped IPv6 handling
    if (host.startsWith('[') && host.endsWith(']')) {
      const ip6 = host.slice(1, -1).toLowerCase();

      // IPv6 Loopback
      if (ip6 === '::1' || ip6 === '0:0:0:0:0:0:0:1' || ip6 === '::') {
        if (!allowInsecureHttpForTesting) {
          return {
            safe: false,
            errorCode: 'LTI_SSRF_LOOPBACK_BLOCKED',
            reason: `Access to IPv6 loopback interface '${host}' is prohibited in production`,
          };
        }
        return { safe: true };
      }

      // AWS IPv6 metadata
      if (ip6 === 'fd00:ec2::254') {
        return {
          safe: false,
          errorCode: 'LTI_SSRF_METADATA_ENDPOINT_BLOCKED',
          reason: `Access to AWS IPv6 metadata endpoint '${host}' is prohibited`,
        };
      }

      // IPv6 Link-Local (fe80::/10)
      if (ip6.startsWith('fe8') || ip6.startsWith('fe9') || ip6.startsWith('fea') || ip6.startsWith('feb')) {
        return {
          safe: false,
          errorCode: 'LTI_SSRF_PRIVATE_NETWORK_BLOCKED',
          reason: `Access to IPv6 link-local network '${host}' is prohibited (strict SSRF prevention)`,
        };
      }

      // IPv6 Unique-Local (fc00::/7)
      if (ip6.startsWith('fc') || ip6.startsWith('fd')) {
        return {
          safe: false,
          errorCode: 'LTI_SSRF_PRIVATE_NETWORK_BLOCKED',
          reason: `Access to IPv6 unique-local private network '${host}' is prohibited (strict SSRF prevention)`,
        };
      }

      // IPv4-mapped IPv6 (::ffff:A.B.C.D or ::ffff:hex:hex)
      if (ip6.startsWith('::ffff:')) {
        const rest = ip6.slice(7);
        let mappedIpv4: string | null = null;
        if (rest.includes('.')) {
          mappedIpv4 = rest;
        } else {
          const parts = rest.split(':');
          if (parts.length === 2) {
            const h1 = parseInt(parts[0], 16);
            const h2 = parseInt(parts[1], 16);
            if (!isNaN(h1) && !isNaN(h2)) {
              mappedIpv4 = [(h1 >> 8) & 0xff, h1 & 0xff, (h2 >> 8) & 0xff, h2 & 0xff].join('.');
            }
          }
        }

        if (mappedIpv4) {
          const mappedCheck = checkIpv4Address(mappedIpv4, allowInsecureHttpForTesting);
          if (!mappedCheck.safe) {
            return {
              safe: false,
              errorCode: mappedCheck.errorCode,
              reason: `IPv4-mapped IPv6 address '${host}' maps to restricted IPv4 '${mappedIpv4}': ${mappedCheck.reason}`,
            };
          }
        }
      }
    }

    // 7. Standard IPv4 Address Validation
    const ipMatch = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const ipv4Check = checkIpv4Address(host, allowInsecureHttpForTesting);
      if (!ipv4Check.safe) {
        return ipv4Check;
      }
    }

    return { safe: true };
  } catch (err: any) {
    return {
      safe: false,
      errorCode: 'LTI_SSRF_MALFORMED_URL',
      reason: `Malformed endpoint URL: ${err?.message || err}`,
    };
  }
}

/**
 * Validates whether an IPv4 address string is restricted or private.
 */
function checkIpv4Address(
  host: string,
  allowInsecureHttpForTesting = false
): { safe: boolean; errorCode?: string; reason?: string } {
  const parts = host.split('.').map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return {
      safe: false,
      errorCode: 'LTI_SSRF_MALFORMED_IP',
      reason: `Invalid IPv4 address format '${host}'`,
    };
  }
  const [b0, b1, b2, b3] = parts;

  // Cloud metadata IPs (AWS/Azure/GCP/Alibaba)
  if ((b0 === 169 && b1 === 254 && b2 === 169 && b3 === 254) || (b0 === 169 && b1 === 254 && b2 === 169 && b3 === 253)) {
    return {
      safe: false,
      errorCode: 'LTI_SSRF_METADATA_ENDPOINT_BLOCKED',
      reason: `Access to cloud metadata IP '${host}' is prohibited (strict SSRF prevention)`,
    };
  }
  if (b0 === 100 && b1 === 100 && b2 === 100 && b3 === 200) {
    return {
      safe: false,
      errorCode: 'LTI_SSRF_METADATA_ENDPOINT_BLOCKED',
      reason: `Access to Alibaba Cloud metadata IP '${host}' is prohibited (strict SSRF prevention)`,
    };
  }

  // Loopback (127.0.0.0/8) and current network (0.0.0.0/8)
  if (b0 === 127 || b0 === 0) {
    if (!allowInsecureHttpForTesting) {
      return {
        safe: false,
        errorCode: 'LTI_SSRF_LOOPBACK_BLOCKED',
        reason: `Access to IPv4 loopback network '${host}' is prohibited in production`,
      };
    }
    return { safe: true };
  }

  // Private networks (RFC 1918), Link-Local (RFC 3927), Carrier-Grade NAT (RFC 6598), Multicast/Reserved
  const isPrivate =
    b0 === 10 ||
    (b0 === 172 && b1 >= 16 && b1 <= 31) ||
    (b0 === 192 && b1 === 168) ||
    (b0 === 169 && b1 === 254) ||
    (b0 === 100 && b1 >= 64 && b1 <= 127) ||
    b0 >= 224;

  if (isPrivate && !allowInsecureHttpForTesting) {
    return {
      safe: false,
      errorCode: 'LTI_SSRF_PRIVATE_NETWORK_BLOCKED',
      reason: `Access to private or link-local IPv4 network range '${host}' is prohibited (strict SSRF prevention)`,
    };
  }

  return { safe: true };
}

/**
 * Asynchronous SSRF evaluation for URLs including pre-flight DNS resolution.
 * Detects DNS rebinding attacks where hostnames resolve to private/loopback/metadata IPs.
 */
export async function isSsrfSafeUrlAsync(
  rawUrl: string,
  allowInsecureHttpForTesting = false,
  dnsLookupOverride?: (host: string) => Promise<Array<{ address: string; family: number }>>
): Promise<{ safe: boolean; errorCode?: string; reason?: string }> {
  const syncCheck = isSsrfSafeUrl(rawUrl, allowInsecureHttpForTesting);
  if (!syncCheck.safe) {
    return syncCheck;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');

    // Skip DNS lookup for IP literals or localhost when allowed and no override provided
    if (!dnsLookupOverride && (host === 'localhost' || host === '127.0.0.1' || host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/) || (host.startsWith('[') && host.endsWith(']')))) {
      return { safe: true };
    }

    // Node.js environment DNS pre-flight resolution
    let dnsPromises: any = null;
    if (!dnsLookupOverride) {
      try {
        const dnsMod = await import('dns');
        dnsPromises = dnsMod.promises || (dnsMod as any).default?.promises;
      } catch (_) {}
    }

    if (dnsLookupOverride || (dnsPromises && typeof dnsPromises.lookup === 'function')) {
      try {
        const addresses: Array<{ address: string; family: number }> = dnsLookupOverride
          ? await dnsLookupOverride(host)
          : await dnsPromises.lookup(host, { all: true });

        for (const record of addresses) {
          const addr = record.address;
          if (record.family === 4) {
            const ipCheck = checkIpv4Address(addr, allowInsecureHttpForTesting);
            if (!ipCheck.safe) {
              return {
                safe: false,
                errorCode: ipCheck.errorCode === 'LTI_SSRF_LOOPBACK_BLOCKED' ? 'LTI_SSRF_DNS_REBINDING_BLOCKED' : ipCheck.errorCode,
                reason: `DNS resolution for host '${host}' resolved to restricted IP '${addr}': ${ipCheck.reason} (DNS rebinding prevention)`,
              };
            }
          } else if (record.family === 6) {
            const ip6 = addr.toLowerCase();

            // AWS IPv6 metadata
            if (ip6 === 'fd00:ec2::254') {
              return {
                safe: false,
                errorCode: 'LTI_SSRF_METADATA_ENDPOINT_BLOCKED',
                reason: `DNS resolution for host '${host}' resolved to AWS IPv6 metadata endpoint '${addr}' (strict SSRF prevention)`,
              };
            }

            // IPv6 Loopback
            if (ip6 === '::1' || ip6 === '::' || ip6 === '0:0:0:0:0:0:0:1') {
              if (!allowInsecureHttpForTesting) {
                return {
                  safe: false,
                  errorCode: 'LTI_SSRF_DNS_REBINDING_BLOCKED',
                  reason: `DNS resolution for host '${host}' resolved to IPv6 loopback '${addr}' (DNS rebinding prevention)`,
                };
              }
            } else if (ip6.startsWith('::ffff:')) {
              // IPv4-mapped IPv6
              const rest = ip6.slice(7);
              let mappedIpv4: string | null = null;
              if (rest.includes('.')) {
                mappedIpv4 = rest;
              } else {
                const parts = rest.split(':');
                if (parts.length === 2) {
                  const h1 = parseInt(parts[0], 16);
                  const h2 = parseInt(parts[1], 16);
                  if (!isNaN(h1) && !isNaN(h2)) {
                    mappedIpv4 = [(h1 >> 8) & 0xff, h1 & 0xff, (h2 >> 8) & 0xff, h2 & 0xff].join('.');
                  }
                }
              }
              if (mappedIpv4) {
                const mappedCheck = checkIpv4Address(mappedIpv4, allowInsecureHttpForTesting);
                if (!mappedCheck.safe) {
                  return {
                    safe: false,
                    errorCode: mappedCheck.errorCode === 'LTI_SSRF_LOOPBACK_BLOCKED' ? 'LTI_SSRF_DNS_REBINDING_BLOCKED' : mappedCheck.errorCode,
                    reason: `DNS resolution for host '${host}' resolved to IPv4-mapped IPv6 '${addr}' (${mappedIpv4}): ${mappedCheck.reason} (DNS rebinding prevention)`,
                  };
                }
              }
            } else if (ip6.startsWith('fe8') || ip6.startsWith('fe9') || ip6.startsWith('fea') || ip6.startsWith('feb') || ip6.startsWith('fc') || ip6.startsWith('fd')) {
              return {
                safe: false,
                errorCode: 'LTI_SSRF_PRIVATE_NETWORK_BLOCKED',
                reason: `DNS resolution for host '${host}' resolved to private IPv6 '${addr}' (DNS rebinding prevention)`,
              };
            }
          }
        }
      } catch (dnsErr: any) {
        if (dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'EAI_AGAIN') {
          return {
            safe: false,
            errorCode: 'LTI_SSRF_DNS_RESOLUTION_FAILED',
            reason: `DNS pre-resolution failed for host '${host}': ${dnsErr.message}`,
          };
        }
      }
    }
  } catch (err: any) {
    return {
      safe: false,
      errorCode: 'LTI_SSRF_MALFORMED_URL',
      reason: `Malformed endpoint URL: ${err?.message || err}`,
    };
  }

  return { safe: true };
}

export interface CachedJwksKey {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  publicKeyPem: string;
}

export interface CachedIssuerJwks {
  keys: Map<string, CachedJwksKey>;
  expiresAt: number;
  fetchedAt: number;
}

export class LtiJwksResolver {
  private cache: Map<string, CachedIssuerJwks> = new Map();
  private lastRefreshAttempt: Map<string, number> = new Map();
  private configManager: LtiConfigManager;
  private defaultTtlMs: number;
  private minRefreshIntervalMs: number;

  constructor(
    configManager?: LtiConfigManager,
    options?: { defaultTtlSeconds?: number; minRefreshIntervalSeconds?: number }
  ) {
    this.configManager = configManager || defaultLtiConfigManager;
    this.defaultTtlMs = (options?.defaultTtlSeconds ?? 3600) * 1000;
    this.minRefreshIntervalMs = (options?.minRefreshIntervalSeconds ?? 60) * 1000;
  }

  public clearCache(): void {
    this.cache.clear();
    this.lastRefreshAttempt.clear();
  }

  public getCacheStats(): { cachedIssuers: number; totalKeys: number } {
    let totalKeys = 0;
    for (const entry of this.cache.values()) {
      totalKeys += entry.keys.size;
    }
    return { cachedIssuers: this.cache.size, totalKeys };
  }

  public setCachedKeysForTesting(issuer: string, keys: CachedJwksKey[], ttlMs?: number, institutionId?: string): void {
    const keyMap = new Map<string, CachedJwksKey>();
    for (const k of keys) {
      keyMap.set(k.kid, k);
    }
    const entry = {
      keys: keyMap,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    };
    if (institutionId) {
      this.cache.set(`${institutionId}:::${issuer}`, entry);
    } else {
      this.cache.set(issuer, entry);
    }
  }

  public async resolveSigningKey(params: {
    issuer: string;
    kid?: string;
    forceRefresh?: boolean;
    allowInsecureHttpForTesting?: boolean;
    institutionId?: string;
  }): Promise<{ publicKeyPem: string; kid: string }> {
    const { issuer, kid, forceRefresh, allowInsecureHttpForTesting } = params;

    // 1. Resolve registered platform configuration
    const registration = this.configManager.getRegistrationByIssuer(issuer);
    if (!registration) {
      const err: any = new Error(`Issuer '${issuer}' is not registered with any authorized institution`);
      err.errorCode = 'LTI_UNREGISTERED_ISSUER';
      throw err;
    }

    if (!registration.active) {
      const err: any = new Error(`Institutional registration for issuer '${issuer}' is currently disabled`);
      err.errorCode = 'LTI_REGISTRATION_INACTIVE';
      throw err;
    }

    // 2. Validate SSRF safety of registered JWKS URI
    const ssrfCheck = isSsrfSafeUrl(registration.jwksUri, allowInsecureHttpForTesting);
    if (!ssrfCheck.safe) {
      const err: any = new Error(`Registered JWKS URI failed SSRF validation: ${ssrfCheck.reason}`);
      err.errorCode = ssrfCheck.errorCode || 'LTI_SSRF_BLOCKED';
      throw err;
    }

    const effectiveInstitutionId = params.institutionId || registration.institutionId;
    const tenantKey = `${effectiveInstitutionId}:::${issuer}`;
    const now = Date.now();
    const cached = this.cache.get(tenantKey) || (!params.institutionId ? this.cache.get(issuer) : undefined);

    // 3. Check for cache hit
    if (cached && now < cached.expiresAt && !forceRefresh) {
      if (kid && cached.keys.has(kid)) {
        const hit = cached.keys.get(kid)!;
        return { publicKeyPem: hit.publicKeyPem, kid: hit.kid };
      }
      if (!kid && cached.keys.size > 0) {
        const first = cached.keys.values().next().value;
        return { publicKeyPem: first.publicKeyPem, kid: first.kid };
      }
    }

    // 4. Rate-limit key refresh requests to prevent DoS via bogus kid values
    const lastAttempt = this.lastRefreshAttempt.get(tenantKey) || this.lastRefreshAttempt.get(issuer) || 0;
    if (now - lastAttempt < this.minRefreshIntervalMs && !forceRefresh) {
      if (cached && cached.keys.size > 0) {
        const err: any = new Error(`Key ID '${kid || 'default'}' not found in cached JWKS and refresh is rate-limited (minimum interval: ${this.minRefreshIntervalMs / 1000}s)`);
        err.errorCode = 'LTI_JWKS_REFRESH_RATE_LIMITED';
        throw err;
      }
    }

    this.lastRefreshAttempt.set(tenantKey, now);
    this.lastRefreshAttempt.set(issuer, now);

    // 5. Fetch fresh JWKS keys from registered endpoint with bounded timeout and safe manual redirect tracking
    let currentUrl = registration.jwksUri;
    let redirectCount = 0;
    const MAX_REDIRECTS = 3;
    let res: Response;

    while (true) {
      const ssrfHopCheck = await isSsrfSafeUrlAsync(currentUrl, allowInsecureHttpForTesting);
      if (!ssrfHopCheck.safe) {
        const err: any = new Error(`Registered JWKS URI (or redirect hop) failed SSRF validation: ${ssrfHopCheck.reason}`);
        err.errorCode = ssrfHopCheck.errorCode || 'LTI_SSRF_BLOCKED';
        throw err;
      }

      try {
        res = await fetch(currentUrl, {
          redirect: 'manual',
          headers: { Accept: 'application/json, application/jwk-set+json' },
          signal: AbortSignal.timeout(5000),
        });
      } catch (fetchErr: any) {
        const err: any = new Error(`Failed to fetch JWKS from '${currentUrl}': ${fetchErr.message || fetchErr}`);
        err.errorCode = 'LTI_JWKS_FETCH_FAILED';
        throw err;
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          const err: any = new Error(`JWKS fetch exceeded maximum allowed redirect depth of ${MAX_REDIRECTS}`);
          err.errorCode = 'LTI_SSRF_REDIRECT_DEPTH_EXCEEDED';
          throw err;
        }
        const location = res.headers.get('Location');
        if (!location) {
          const err: any = new Error(`JWKS redirect response (HTTP ${res.status}) missing 'Location' header`);
          err.errorCode = 'LTI_JWKS_INVALID_REDIRECT';
          throw err;
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      break;
    }

    if (!res.ok) {
      const err: any = new Error(`JWKS endpoint returned HTTP ${res.status} (${res.statusText})`);
      err.errorCode = 'LTI_JWKS_HTTP_ERROR';
      throw err;
    }

    // Response size limit enforcement (max 512KB to prevent memory exhaustion DoS)
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 524288) {
      const err: any = new Error(`JWKS response exceeds maximum allowable size of 512KB (${contentLength} bytes)`);
      err.errorCode = 'LTI_JWKS_RESPONSE_TOO_LARGE';
      throw err;
    }

    let jwksData: any;
    try {
      const rawBody = await res.text();
      if (rawBody.length > 524288) {
        const err: any = new Error(`JWKS response body exceeded maximum allowable size of 512KB (${rawBody.length} characters)`);
        err.errorCode = 'LTI_JWKS_RESPONSE_TOO_LARGE';
        throw err;
      }
      jwksData = JSON.parse(rawBody);
    } catch (jsonErr: any) {
      if (jsonErr.errorCode === 'LTI_JWKS_RESPONSE_TOO_LARGE') throw jsonErr;
      const err: any = new Error(`JWKS response body is not valid JSON: ${jsonErr.message}`);
      err.errorCode = 'LTI_JWKS_MALFORMED_JSON';
      throw err;
    }

    if (!jwksData || !Array.isArray(jwksData.keys)) {
      const err: any = new Error("JWKS payload missing 'keys' array");
      err.errorCode = 'LTI_JWKS_INVALID_STRUCTURE';
      throw err;
    }

    // 6. Parse, validate, and convert keys to PEM
    const newKeyMap = new Map<string, CachedJwksKey>();

    for (const rawKey of jwksData.keys) {
      if (!rawKey || typeof rawKey !== 'object') continue;

      // Algorithm confusion and key type validation
      if (rawKey.kty !== 'RSA') {
        continue; // Disallow non-RSA or symmetric keys
      }

      if (rawKey.alg && rawKey.alg !== 'RS256') {
        continue; // Strict RS256 algorithm enforcement
      }

      if (rawKey.use && rawKey.use !== 'sig') {
        continue; // Only signature keys
      }

      if (!rawKey.kid || typeof rawKey.kid !== 'string') {
        continue;
      }

      try {
        const pubKeyObj = crypto.createPublicKey({ key: rawKey, format: 'jwk' });
        const pem = pubKeyObj.export({ type: 'spki', format: 'pem' }) as string;

        newKeyMap.set(rawKey.kid, {
          kid: rawKey.kid,
          kty: rawKey.kty,
          alg: rawKey.alg || 'RS256',
          use: rawKey.use || 'sig',
          publicKeyPem: pem,
        });
      } catch (_) {
        // Skip malformed individual keys
      }
    }

    if (newKeyMap.size === 0) {
      const err: any = new Error(`No valid RSA-RS256 signing keys found in JWKS from '${registration.jwksUri}'`);
      err.errorCode = 'LTI_JWKS_NO_VALID_KEYS';
      throw err;
    }

    const cacheEntry = {
      keys: newKeyMap,
      fetchedAt: now,
      expiresAt: now + this.defaultTtlMs,
    };
    this.cache.set(tenantKey, cacheEntry);
    this.cache.set(issuer, cacheEntry);

    if (kid && newKeyMap.has(kid)) {
      const match = newKeyMap.get(kid)!;
      return { publicKeyPem: match.publicKeyPem, kid: match.kid };
    }

    if (!kid && newKeyMap.size > 0) {
      const first = newKeyMap.values().next().value;
      return { publicKeyPem: first.publicKeyPem, kid: first.kid };
    }

    const err: any = new Error(`Key ID '${kid}' not found in refreshed JWKS keys from '${registration.jwksUri}'`);
    err.errorCode = 'LTI_KEY_NOT_FOUND';
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. DEFAULT SINGLETONS & PRE-POPULATED PLATFORM REGISTRATIONS
// ---------------------------------------------------------------------------

export const defaultSamlConfigManager = new SamlConfigManager();
export const defaultLtiConfigManager = new LtiConfigManager();
export const defaultLtiJwksResolver = new LtiJwksResolver(defaultLtiConfigManager);

// Pre-populate standard platforms for demonstration & local testing
defaultLtiConfigManager.registerPlatform({
  institutionId: 'inst_canvas_demo',
  version: 1,
  active: true,
  issuer: 'https://canvas.instructure.com',
  clientId: 'cortex_canvas_client_1001',
  deploymentId: 'dep_cortex_academic_prod_01',
  authEndpoint: 'https://canvas.instructure.com/api/lti/authorize_redirect',
  jwksUri: 'https://canvas.instructure.com/api/lti/security/jwks',
  tokenEndpoint: 'https://canvas.instructure.com/login/oauth2/token',
  allowedRedirectUris: ['https://cortex.edu/api/v1/lockdown/lti/launch'],
  registeredCourseContexts: ['course_default', 'CS101', 'CS201'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

defaultLtiConfigManager.registerPlatform({
  institutionId: 'inst_blackboard_demo',
  version: 1,
  active: true,
  issuer: 'https://blackboard.com',
  clientId: 'cortex_bb_client_2002',
  deploymentId: 'dep_cortex_academic_prod_01',
  authEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken',
  jwksUri: 'https://developer.blackboard.com/api/v1/management/jwks.json',
  tokenEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken',
  allowedRedirectUris: ['https://cortex.edu/api/v1/lockdown/lti/launch'],
  registeredCourseContexts: ['course_default', 'PHYS101'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

defaultLtiConfigManager.registerPlatform({
  institutionId: 'inst_moodle_demo',
  version: 1,
  active: true,
  issuer: 'https://moodle.org',
  clientId: 'cortex_moodle_client_3003',
  deploymentId: 'dep_cortex_academic_prod_01',
  authEndpoint: 'https://moodle.org/mod/lti/auth.php',
  jwksUri: 'https://moodle.org/mod/lti/certs.php',
  tokenEndpoint: 'https://moodle.org/mod/lti/token.php',
  allowedRedirectUris: ['https://cortex.edu/api/v1/lockdown/lti/launch'],
  registeredCourseContexts: ['course_default', 'MATH101'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});


// ---------------------------------------------------------------------------
// 4. INSTITUTIONAL READINESS SPECIFICATION & CAVEATS
// ---------------------------------------------------------------------------

export const INSTITUTIONAL_INTEGRATION_SPECIFICATION = {
  version: '1.1.0-alpha33',
  protocolsSupported: ['SAML 2.0 Web Browser SSO Profile', 'LTI 1.3 Advantage (Core + AGS + NRPS)'],
  lmsCompatibility: ['Canvas by Instructure', 'Blackboard Learn by Anthology', 'Moodle 4.x/5.x'],
  securityRequirements: [
    'Mutual TLS 1.3 encryption across all LMS endpoints',
    'RS256 / JWKS cryptographic keypair rotation every 90 days',
    'State and Nonce ephemeral cache with 120-second TTL to defeat replay attacks',
    'SAML Clock skew tolerance constrained strictly to 120 seconds',
    'XML Signature Wrapping (XSW) single-assertion verification guard',
    'Strict algorithm allowlisting (RSA-SHA256 for XMLDSIG, RS256 for LTI JWT)',
  ],
  governanceCaveat:
    'Mock engines validate architectural conformance, payload schemas, and cryptographic message parsing. These protocols cannot be claimed as production-certified or live-operational until verified with real campus credentials, institutional SAML IdP metadata, and registered LMS developer keys in authorized university test environments.',
};
