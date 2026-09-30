import { GraphQLScalarType, valueFromASTUntyped } from 'graphql';

/** Any JSON value. The API uses it only for the `params` of the outputs. */
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Any JSON value.',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (ast, variables) => valueFromASTUntyped(ast, variables),
});
