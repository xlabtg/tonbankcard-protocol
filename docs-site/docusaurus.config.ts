import path from 'node:path';
import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain ESM remark plugin without bundled types
import rewriteExternalLinks from './src/remark/rewrite-external-links.mjs';

const config: Config = {
  title: 'Tonbankcard Protocol',
  tagline: 'Non-custodial virtual bank protocol on TON',
  favicon: 'img/favicon.svg',

  url: 'https://docs.tonbankcard.com',
  baseUrl: '/',

  organizationName: 'xlabtg',
  projectName: 'tonbankcard-protocol',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
    // `.md` files are parsed as CommonMark so existing docs that contain
    // `<TOKEN>`-style placeholders do not trip MDX's JSX parser. New rich
    // pages can opt into MDX by using the `.mdx` extension.
    format: 'detect',
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/xlabtg/tonbankcard-protocol/edit/main/docs/',
          beforeDefaultRemarkPlugins: [
            [
              rewriteExternalLinks,
              { docsDir: path.resolve(__dirname, '..', 'docs') },
            ],
          ],
          include: ['**/*.md', '**/*.mdx'],
          exclude: [
            '**/_*.{js,jsx,ts,tsx,md,mdx}',
            '**/_*/**',
            '**/*.test.{js,jsx,ts,tsx}',
            '**/__tests__/**',
          ],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'sdk-api',
        path: 'sdk-api',
        routeBasePath: 'sdk-api',
        sidebarPath: './sidebars.sdk-api.ts',
      },
    ],
  ],

  themeConfig: {
    image: 'img/social-card.svg',
    navbar: {
      title: 'Tonbankcard Protocol',
      logo: {
        alt: 'Tonbankcard Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          to: '/docs/INDEX',
          label: 'Docs',
          position: 'left',
          activeBasePath: '/docs',
        },
        {
          to: '/sdk-api/',
          label: 'SDK API',
          position: 'left',
        },
        {
          to: '/docs/merchant-api-spec',
          label: 'REST API',
          position: 'left',
        },
        {
          href: 'https://github.com/xlabtg/tonbankcard-protocol',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Index', to: '/docs/INDEX' },
            { label: 'Architecture', to: '/docs/architecture' },
            { label: 'Invariants', to: '/docs/invariants' },
          ],
        },
        {
          title: 'For Merchants',
          items: [
            { label: 'API Spec', to: '/docs/merchant-api-spec' },
            { label: 'Onboarding', to: '/docs/merchants/onboarding-guide' },
            { label: 'API Security', to: '/docs/merchant-api-security' },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/xlabtg/tonbankcard-protocol',
            },
            {
              label: 'Security policy',
              href: 'https://github.com/xlabtg/tonbankcard-protocol/blob/main/SECURITY.md',
            },
          ],
        },
      ],
      copyright: `MIT licensed. Built on TON.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript', 'tsx', 'yaml'],
    },
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
