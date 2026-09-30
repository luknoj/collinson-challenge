import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'apps/api/src/schema.graphql',
  // The web app has no .graphql documents until phase 5 adds the row queries.
  ignoreNoDocuments: true,
  config: {
    useTypeImports: true,
    // Enums become a constant object and a type, with the names from the
    // schema (for example, ExplanationKey.SNOW_BASE).
    enumsAsConst: true,
    namingConvention: { enumValues: 'keep' },
  },
  generates: {
    'apps/api/src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
    },
    'apps/web/src/generated/graphql.ts': {
      documents: 'apps/web/src/**/*.graphql',
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
    },
  },
};

export default config;
