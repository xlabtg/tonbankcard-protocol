/**
 * Compare two gas-profile JSON reports and emit a Markdown delta table.
 *
 * Usage:
 *   npx ts-node compare.ts baseline.json optimized.json [--out delta.md]
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

interface OperationResult {
    name: string;
    description: string;
    avgGas: number;
    minGas: number;
    maxGas: number;
}

interface ProfileReport {
    label: string;
    generatedAt: string;
    contract: string;
    operations: OperationResult[];
}

function loadReport(path: string): ProfileReport {
    const abs = resolve(__dirname, path);
    return JSON.parse(readFileSync(abs, 'utf8'));
}

function main() {
    const argv = process.argv.slice(2);
    if (argv.length < 2) {
        console.error('Usage: ts-node compare.ts <baseline.json> <optimized.json> [--out delta.md]');
        process.exit(2);
    }
    const baselinePath = argv[0];
    const optimizedPath = argv[1];
    let outPath: string | undefined;
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--out' && i + 1 < argv.length) outPath = argv[++i];
    }

    const baseline = loadReport(baselinePath);
    const optimized = loadReport(optimizedPath);

    const byName = new Map(baseline.operations.map((o) => [o.name, o]));
    const rows: string[] = [];
    rows.push('| Operation | Baseline (avg) | Optimized (avg) | Δ gas | Δ % |');
    rows.push('| --- | ---: | ---: | ---: | ---: |');

    let totalBaseline = 0;
    let totalOptimized = 0;
    for (const op of optimized.operations) {
        const base = byName.get(op.name);
        if (!base) continue;
        const delta = op.avgGas - base.avgGas;
        const pct = base.avgGas === 0 ? 0 : (delta / base.avgGas) * 100;
        totalBaseline += base.avgGas;
        totalOptimized += op.avgGas;
        rows.push(
            `| \`${op.name}\` | ${base.avgGas} | ${op.avgGas} | ${delta >= 0 ? '+' : ''}${delta} | ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% |`,
        );
    }

    const totalDelta = totalOptimized - totalBaseline;
    const totalPct = totalBaseline === 0 ? 0 : (totalDelta / totalBaseline) * 100;
    rows.push(
        `| **Total** | **${totalBaseline}** | **${totalOptimized}** | **${totalDelta >= 0 ? '+' : ''}${totalDelta}** | **${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(2)}%** |`,
    );

    const md = `# Gas optimization delta\n\nBaseline:  \`${baseline.label}\` (${baseline.generatedAt})\nOptimized: \`${optimized.label}\` (${optimized.generatedAt})\nContract:  ${optimized.contract}\n\n${rows.join('\n')}\n`;

    console.log(md);

    if (outPath) {
        const abs = resolve(__dirname, outPath);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, md);
        console.log(`Delta written to: ${abs}`);
    }
}

main();
