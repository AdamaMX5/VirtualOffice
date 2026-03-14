import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { GQL_PATH } from '../model/constants';

const httpLink = createHttpLink({
  uri: GQL_PATH,
  credentials: 'include', // sendet httponly Refresh-Cookie automatisch mit
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
