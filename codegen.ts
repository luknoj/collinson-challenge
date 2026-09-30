import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'apps/api/src/schema.graphql',
  config: {
    useTypeImports: true,
    // Enums become a constant object and a type, with the names from the
    // schema (for example, ExplanationKey.SNOW_BASE).
    enumsAsConst: true,
    namingConvention: { enumValues: 'keep' },
    // The `params` of an explanation. The frontend has 1 type for each key.
    scalars: { JSON: 'Record<string, unknown>' },
  },
  generates: {
    'apps/api/src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../context.js#Context',
        // Query.activities returns the location. The activity fields use it.
        mappers: { Activities: '../resolvers/activities.js#ActivitiesParent' },
      },
    },
    'apps/web/src/generated/graphql.ts': {
      documents: 'apps/web/src/**/*.graphql',
      // typescript-operations also makes the enums and the input types that the
      // documents use. Thus, the web output does not use the typescript plugin.
      plugins: ['typescript-operations', 'typed-document-node'],
      config: { enumType: 'const' },
    },
  },
};

export default config;
