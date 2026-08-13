/** Issue #431: every deployable source must be covered by the contract build. */

import { describe, expect, it } from '@jest/globals';
import { DEPLOYABLE_CONTRACTS } from '../../scripts/deploy/deployable-contracts';
import { DEPLOYABLE_BUILD_PROJECTS } from '../../scripts/deploy/deployable-build-projects';

describe('deployable contract build coverage', () => {
  it('covers every deployable source exactly once and no non-deployable source', () => {
    const deployableSources = Object.values(DEPLOYABLE_CONTRACTS).flat().sort();
    const compiledSources = DEPLOYABLE_BUILD_PROJECTS
      .map((project) => project.source)
      .sort();

    expect(compiledSources).toEqual(deployableSources);
    expect(new Set(compiledSources).size).toBe(compiledSources.length);
  });

  it('uses the deployment contract name for every build project', () => {
    for (const project of DEPLOYABLE_BUILD_PROJECTS) {
      expect(DEPLOYABLE_CONTRACTS[project.name]).toContain(project.source);
    }
  });
});
