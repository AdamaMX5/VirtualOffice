import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login(
    $email: String!
    $password: String!
    $deviceFingerprint: String
    $deviceName: String
  ) {
    login(
      email: $email
      password: $password
      deviceFingerprint: $deviceFingerprint
      deviceName: $deviceName
    ) {
      accessToken
      email
      status
      id
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $repassword: String!) {
    register(email: $email, repassword: $repassword) {
      accessToken
      email
    }
  }
`;

export const REFRESH_MUTATION = gql`
  mutation Refresh {
    refresh {
      accessToken
    }
  }
`;
