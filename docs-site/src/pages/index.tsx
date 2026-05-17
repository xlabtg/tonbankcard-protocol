import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/INDEX"
          >
            Read the docs →
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="/sdk-api/"
            style={{ marginLeft: 12 }}
          >
            SDK API
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="/docs/merchant-api-spec"
            style={{ marginLeft: 12 }}
          >
            REST API
          </Link>
        </div>
      </div>
    </header>
  );
}

const sections: Array<{
  title: string;
  description: string;
  to: string;
}> = [
  {
    title: 'For Merchants',
    description:
      'Integration guides, REST API reference, and SDK quickstart for accepting non-custodial TON payments.',
    to: '/docs/merchant-api-spec',
  },
  {
    title: 'For Developers',
    description:
      'Architecture overview, smart-contract specifications, and contributing guide.',
    to: '/docs/architecture',
  },
  {
    title: 'For Auditors',
    description:
      'Threat model, protocol invariants, audit scope, and audit readiness documentation.',
    to: '/docs/security/THREAT_MODEL',
  },
  {
    title: 'For the Community',
    description:
      'Whitepaper, litepaper, DAO governance, and transparency commitments.',
    to: '/docs/whitepaper/whitepaper-v1',
  },
];

function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {sections.map((section) => (
            <div key={section.title} className={clsx('col col--6')}>
              <div className={styles.featureCard}>
                <Heading as="h3">{section.title}</Heading>
                <p>{section.description}</p>
                <Link to={section.to}>Learn more →</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} documentation`}
      description="Public documentation for the Tonbankcard non-custodial virtual bank protocol on TON."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
