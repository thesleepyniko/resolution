import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from './db';
import { session, user } from './db/schema';
import { dev } from '$app/environment';
import { AuthorizationCode } from 'simple-oauth2';
import { env } from '$env/dynamic/private';

const adapter = new DrizzlePostgreSQLAdapter(db, session, user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: !dev
    }
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      hackClubId: attributes.hackClubId,
      firstName: attributes.firstName,
      lastName: attributes.lastName,
      slackId: attributes.slackId,
      verificationStatus: attributes.verificationStatus,
      yswsEligible: attributes.yswsEligible,
      isAdmin: attributes.isAdmin
    };
  }
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  email: string;
  hackClubId: string;
  firstName: string | null;
  lastName: string | null;
  slackId: string | null;
  verificationStatus: string | null;
  yswsEligible: boolean;
  isAdmin: boolean;
}

export const hackClubAuth = new AuthorizationCode({
  client: {
    id: env.HACK_CLUB_CLIENT_ID!,
    secret: env.HACK_CLUB_CLIENT_SECRET!
  },
  auth: {
    tokenHost: 'https://auth.hackclub.com',
    tokenPath: '/oauth/token',
    authorizePath: '/oauth/authorize'
  }
});
