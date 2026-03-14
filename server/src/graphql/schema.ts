export const typeDefs = `#graphql
  type AuthPayload {
    accessToken: String!
    email:       String!
    status:      String
    id:          String
  }

  type RefreshPayload {
    accessToken: String!
  }

  type PresenceHealth {
    ok:      Boolean!
    message: String
  }

  type Query {
    presenceHealth: PresenceHealth!
  }

  type Mutation {
    login(
      email:             String!
      password:          String!
      deviceFingerprint: String
      deviceName:        String
    ): AuthPayload!

    register(
      email:      String!
      repassword: String!
    ): AuthPayload!

    refresh: RefreshPayload!
  }
`;
