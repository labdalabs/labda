import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // ADR-0015: three-axis tag enforcement.
          //   scope:{api,ui,shared} × type:{common,domain,feature,test} × target:{server,client,isomorphic}
          depConstraints: [
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'scope:api',
                'scope:shared',
                'target:server',
                'target:isomorphic',
              ],
            },
            {
              sourceTag: 'scope:ui',
              onlyDependOnLibsWithTags: [
                'scope:ui',
                'scope:shared',
                'target:client',
                'target:isomorphic',
              ],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared', 'target:isomorphic'],
            },
            {
              sourceTag: 'type:common',
              onlyDependOnLibsWithTags: ['type:common'],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:common', 'type:domain'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:common',
                'type:domain',
                'type:feature',
              ],
            },
            {
              sourceTag: 'type:test',
              onlyDependOnLibsWithTags: [
                'type:common',
                'type:domain',
                'type:feature',
              ],
            },
            {
              sourceTag: 'target:server',
              onlyDependOnLibsWithTags: ['target:server', 'target:isomorphic'],
            },
            {
              sourceTag: 'target:client',
              onlyDependOnLibsWithTags: ['target:client', 'target:isomorphic'],
            },
            {
              sourceTag: 'target:isomorphic',
              onlyDependOnLibsWithTags: ['target:isomorphic'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
