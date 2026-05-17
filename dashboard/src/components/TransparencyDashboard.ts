/**
 * TONBANKCARD Public Transparency Dashboard (E4, Issue #135).
 *
 * A read-only, public-facing dashboard that renders the aggregated
 * snapshot served by `GET /api/v1/transparency/metrics`.
 *
 * SECURITY NOTICE:
 * ================
 * 1. This dashboard is PURELY PRESENTATIONAL.
 * 2. It does NOT sign transactions or hold keys.
 * 3. It does NOT custody funds.
 * 4. All data is READ-ONLY, sourced from the on-chain
 *    TransparencyRegistry via the indexer API.
 * 5. The blockchain is the ONLY source of truth — every number
 *    rendered here MUST be verifiable against an on-chain
 *    TransparencyRegistry event.
 *
 * Schema mirrored from
 * docs/governance/TRANSPARENCY_REPORTING.md §4.1.
 */

import {
  TransparencyDashboardConfig,
  TransparencyMetricsSnapshot,
  TransparencyProtocolMetricsRow,
  TransparencyLockActivityRow,
  TransparencyParameterChangeRow,
} from '../types';
import { formatCurrency, formatDate, shortAddress } from '../utils';

/**
 * Renders the public transparency snapshot using vanilla DOM elements.
 * Mirrors the lifecycle and theming of `TonbankcardDashboard` so the two
 * widgets can be embedded side-by-side without style conflicts.
 *
 * @example
 * ```html
 * <div id="transparency"></div>
 * <script>
 *   const dash = new TonbankcardTransparencyDashboard({
 *     containerId: 'transparency',
 *     theme: 'light',
 *   });
 *   dash.mount();
 *   fetch('/api/v1/transparency/metrics')
 *     .then((r) => r.json())
 *     .then((snapshot) => dash.setSnapshot(snapshot));
 * </script>
 * ```
 */
export class TonbankcardTransparencyDashboard {
  private config: Required<Pick<TransparencyDashboardConfig, 'containerId'>> &
    TransparencyDashboardConfig;
  private container: HTMLElement | null = null;
  private mounted = false;
  private snapshot: TransparencyMetricsSnapshot | null = null;

  constructor(config: TransparencyDashboardConfig) {
    if (!config.containerId) {
      throw new Error('containerId is required');
    }

    this.config = {
      theme: 'light',
      ...config,
    };
  }

  /**
   * Mount the dashboard into the container element.
   */
  mount(): void {
    if (this.mounted) {
      return;
    }

    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      const error = new Error(
        `Container element not found: #${this.config.containerId}`
      );
      this.config.onError?.(error);
      throw error;
    }

    this.render();
    this.mounted = true;
    this.config.onReady?.();
  }

  /**
   * Unmount the dashboard and clear the container.
   */
  unmount(): void {
    if (!this.mounted || !this.container) {
      return;
    }

    this.container.innerHTML = '';
    this.mounted = false;
  }

  /**
   * Set the metrics snapshot and re-render if mounted.
   */
  setSnapshot(snapshot: TransparencyMetricsSnapshot): void {
    this.snapshot = snapshot;
    if (this.mounted) {
      this.rerender();
    }
  }

  /**
   * Get the currently rendered snapshot, if any.
   */
  getSnapshot(): TransparencyMetricsSnapshot | null {
    return this.snapshot;
  }

  private rerender(): void {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.render();
  }

  private isDark(): boolean {
    return this.config.theme === 'dark';
  }

  private render(): void {
    if (!this.container) return;

    const isDark = this.isDark();
    const wrapper = document.createElement('div');
    wrapper.className = 'tonbankcard-transparency';
    wrapper.style.cssText = [
      'font-family:system-ui,-apple-system,sans-serif',
      'border-radius:16px',
      'padding:24px',
      'min-height:400px',
      isDark
        ? 'background:#1a1a2e;color:#e0e0ff;border:1px solid #333'
        : 'background:#ffffff;color:#1a1a1a;border:1px solid #e0e0e0',
    ].join(';');

    wrapper.appendChild(this.renderHeader());
    wrapper.appendChild(this.renderDisclaimer());

    if (!this.snapshot) {
      wrapper.appendChild(this.renderEmpty());
    } else {
      wrapper.appendChild(this.renderProtocolMetricsSection());
      wrapper.appendChild(this.renderLockActivitySection());
      wrapper.appendChild(this.renderParameterChangesSection());
    }

    wrapper.appendChild(this.renderFooter());
    this.container.appendChild(wrapper);
  }

  private renderHeader(): HTMLElement {
    const isDark = this.isDark();

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';

    const title = document.createElement('h1');
    title.style.cssText = 'margin:0;font-size:22px;font-weight:700;';
    title.textContent = 'Protocol Transparency';
    header.appendChild(title);

    if (this.snapshot) {
      const stamp = document.createElement('div');
      stamp.style.cssText = `font-size:12px;font-family:monospace;${
        isDark ? 'color:#888;' : 'color:#999;'
      }`;
      stamp.textContent = `block ${this.snapshot.snapshot.latestBlockIndexed} · indexed ${formatDate(
        this.snapshot.snapshot.indexedAt
      )}`;
      header.appendChild(stamp);
    }

    return header;
  }

  private renderDisclaimer(): HTMLElement {
    const isDark = this.isDark();
    const notice = document.createElement('div');
    notice.style.cssText = [
      'padding:12px 14px',
      'border-radius:8px',
      'font-size:13px',
      'margin-bottom:20px',
      isDark
        ? 'background:#262640;color:#bbb;border:1px solid #333'
        : 'background:#f0f4ff;color:#555;border:1px solid #dde4ff',
    ].join(';');
    notice.textContent =
      this.snapshot?.disclaimer ??
      'This data is non-authoritative. Verify all data on-chain. Governance outcomes are advisory only.';
    return notice;
  }

  private renderEmpty(): HTMLElement {
    const isDark = this.isDark();
    const empty = document.createElement('div');
    empty.style.cssText = `text-align:center;padding:40px;${
      isDark ? 'color:#888;' : 'color:#999;'
    }`;
    empty.textContent =
      'No transparency snapshot loaded yet. Call setSnapshot() with the GET /api/v1/transparency/metrics response.';
    return empty;
  }

  private renderProtocolMetricsSection(): HTMLElement {
    const isDark = this.isDark();
    const wrap = this.createSection(
      'Protocol Metrics',
      `${this.snapshot?.protocolMetrics.periodCount ?? 0} period(s) recorded`
    );

    const latest = this.snapshot?.protocolMetrics.latest ?? null;
    if (!latest) {
      wrap.appendChild(
        this.createEmptyRow('No protocol metric checksums anchored yet.')
      );
      return wrap;
    }

    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:16px;';

    const cards: Array<{ label: string; value: string }> = [
      { label: 'Active accounts', value: latest.activeAccounts.toLocaleString() },
      {
        label: 'TBC volume (period)',
        value: formatCurrency(latest.tbcVolumeTransferred),
      },
      { label: 'Transfers (period)', value: latest.transferCount.toLocaleString() },
      {
        label: 'Period',
        value: `${formatDate(latest.periodStart)} → ${formatDate(latest.periodEnd)}`,
      },
    ];

    for (const card of cards) {
      grid.appendChild(this.createStatCard(card.label, card.value));
    }
    wrap.appendChild(grid);

    const history = this.snapshot?.protocolMetrics.history ?? [];
    if (history.length > 0) {
      wrap.appendChild(this.renderProtocolMetricsHistory(history));
    }

    const anchor = document.createElement('div');
    anchor.style.cssText = `margin-top:8px;font-size:11px;font-family:monospace;${
      isDark ? 'color:#666;' : 'color:#aaa;'
    }`;
    anchor.textContent = `latest anchor: block ${latest.blockNumber} · tx ${shortAddress(
      latest.transactionHash
    )}`;
    wrap.appendChild(anchor);

    return wrap;
  }

  private renderProtocolMetricsHistory(
    rows: TransparencyProtocolMetricsRow[]
  ): HTMLElement {
    return this.createTable(
      ['Period end', 'Active accounts', 'TBC volume', 'Transfers', 'Block'],
      rows.map((r) => [
        formatDate(r.periodEnd),
        r.activeAccounts.toLocaleString(),
        formatCurrency(r.tbcVolumeTransferred),
        r.transferCount.toLocaleString(),
        String(r.blockNumber),
      ])
    );
  }

  private renderLockActivitySection(): HTMLElement {
    const isDark = this.isDark();
    const wrap = this.createSection(
      'Lock Activity',
      `${this.snapshot?.lockActivity.periodCount ?? 0} period(s) recorded`
    );

    const latest = this.snapshot?.lockActivity.latest ?? null;
    if (!latest) {
      wrap.appendChild(
        this.createEmptyRow('No lock-activity checksums anchored yet.')
      );
      return wrap;
    }

    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;';

    const cards: Array<{ label: string; value: string }> = [
      { label: 'Locks set', value: latest.locksSet.toLocaleString() },
      { label: 'Locks cleared', value: latest.locksCleared.toLocaleString() },
      { label: 'Locks active', value: latest.locksActive.toLocaleString() },
      { label: 'Appeals filed', value: latest.appealsFiled.toLocaleString() },
      {
        label: 'Appeals overturned',
        value: latest.appealsOverturned.toLocaleString(),
      },
      { label: 'Appeals upheld', value: latest.appealsUpheld.toLocaleString() },
    ];

    for (const card of cards) {
      grid.appendChild(this.createStatCard(card.label, card.value));
    }
    wrap.appendChild(grid);

    const history = this.snapshot?.lockActivity.history ?? [];
    if (history.length > 0) {
      wrap.appendChild(this.renderLockActivityHistory(history));
    }

    const anchor = document.createElement('div');
    anchor.style.cssText = `margin-top:8px;font-size:11px;font-family:monospace;${
      isDark ? 'color:#666;' : 'color:#aaa;'
    }`;
    anchor.textContent = `latest anchor: block ${latest.blockNumber} · tx ${shortAddress(
      latest.transactionHash
    )}`;
    wrap.appendChild(anchor);

    return wrap;
  }

  private renderLockActivityHistory(
    rows: TransparencyLockActivityRow[]
  ): HTMLElement {
    return this.createTable(
      [
        'Period end',
        'Set',
        'Cleared',
        'Active',
        'Appeals (filed/overturned/upheld)',
        'Block',
      ],
      rows.map((r) => [
        formatDate(r.periodEnd),
        r.locksSet.toLocaleString(),
        r.locksCleared.toLocaleString(),
        r.locksActive.toLocaleString(),
        `${r.appealsFiled} / ${r.appealsOverturned} / ${r.appealsUpheld}`,
        String(r.blockNumber),
      ])
    );
  }

  private renderParameterChangesSection(): HTMLElement {
    const wrap = this.createSection(
      'Parameter Changes',
      `${this.snapshot?.parameterChanges.total ?? 0} total on-chain`
    );

    const history = this.snapshot?.parameterChanges.history ?? [];
    if (history.length === 0) {
      wrap.appendChild(
        this.createEmptyRow('No parameter changes have been recorded.')
      );
      return wrap;
    }

    wrap.appendChild(this.renderParameterChangesTable(history));
    return wrap;
  }

  private renderParameterChangesTable(
    rows: TransparencyParameterChangeRow[]
  ): HTMLElement {
    return this.createTable(
      [
        'Parameter',
        'Effective block',
        'Old hash',
        'New hash',
        'Proposal',
        'Timestamp',
      ],
      rows.map((r) => [
        r.parameterId,
        String(r.effectiveBlock),
        shortAddress(r.oldValueHash, 8),
        shortAddress(r.newValueHash, 8),
        r.governanceProposalId === null ? '—' : `#${r.governanceProposalId}`,
        formatDate(r.timestamp),
      ])
    );
  }

  private createSection(title: string, subtitle: string): HTMLElement {
    const isDark = this.isDark();

    const section = document.createElement('section');
    section.style.cssText = 'margin-bottom:28px;';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px;';

    const heading = document.createElement('h2');
    heading.style.cssText = 'margin:0;font-size:18px;font-weight:600;';
    heading.textContent = title;
    header.appendChild(heading);

    const sub = document.createElement('span');
    sub.style.cssText = `font-size:12px;${isDark ? 'color:#888;' : 'color:#888;'}`;
    sub.textContent = subtitle;
    header.appendChild(sub);

    section.appendChild(header);
    return section;
  }

  private createStatCard(label: string, value: string): HTMLElement {
    const isDark = this.isDark();
    const card = document.createElement('div');
    card.style.cssText = [
      'padding:16px',
      'border-radius:12px',
      isDark
        ? 'background:#262640;border:1px solid #333'
        : 'background:#f8f9fa;border:1px solid #e8e8e8',
    ].join(';');

    const labelEl = document.createElement('div');
    labelEl.style.cssText = `font-size:12px;margin-bottom:6px;${
      isDark ? 'color:#888;' : 'color:#666;'
    }`;
    labelEl.textContent = label;
    card.appendChild(labelEl);

    const valueEl = document.createElement('div');
    valueEl.style.cssText = 'font-size:20px;font-weight:700;';
    valueEl.textContent = value;
    card.appendChild(valueEl);

    return card;
  }

  private createEmptyRow(message: string): HTMLElement {
    const isDark = this.isDark();
    const el = document.createElement('div');
    el.style.cssText = `padding:16px;border-radius:10px;font-size:13px;${
      isDark
        ? 'background:#262640;color:#888;border:1px solid #333'
        : 'background:#f8f9fa;color:#777;border:1px solid #e8e8e8'
    }`;
    el.textContent = message;
    return el;
  }

  private createTable(headers: string[], rows: string[][]): HTMLElement {
    const isDark = this.isDark();
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'overflow-x:auto;';

    const table = document.createElement('table');
    table.style.cssText = [
      'width:100%',
      'border-collapse:collapse',
      'font-size:13px',
      'font-family:monospace',
      isDark ? 'color:#ccc' : 'color:#333',
    ].join(';');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of headers) {
      const th = document.createElement('th');
      th.style.cssText = [
        'text-align:left',
        'padding:8px 10px',
        `border-bottom:1px solid ${isDark ? '#333' : '#e0e0e0'}`,
        'font-weight:600',
        `color:${isDark ? '#888' : '#666'}`,
      ].join(';');
      th.textContent = h;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr');
      for (const cell of row) {
        const td = document.createElement('td');
        td.style.cssText = `padding:8px 10px;border-bottom:1px solid ${
          isDark ? '#262640' : '#f0f0f0'
        };`;
        td.textContent = cell;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    wrapper.appendChild(table);
    return wrapper;
  }

  private renderFooter(): HTMLElement {
    const isDark = this.isDark();
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top:24px;padding-top:16px;border-top:1px solid ${
      isDark ? '#333' : '#e0e0e0'
    };font-size:11px;text-align:center;${isDark ? 'color:#666;' : 'color:#aaa;'}`;
    footer.textContent =
      'TONBANKCARD Public Transparency Dashboard | Read-only | Blockchain is the source of truth';
    return footer;
  }
}
