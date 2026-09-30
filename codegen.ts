import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'apps/api/src/schema.graphql',
  config: {
    useTypeImports: true,
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
