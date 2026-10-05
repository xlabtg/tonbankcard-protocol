"""Локальная проверка workspace с раздельными логами и сохранением всех exit codes.

Запуск: python3 experiments/check-501/run-local-checks.py [runtime|contracts]
Использует Node/npm из PATH, не обновляет tracked lockfiles.
"""
import json
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[2]
logs = root / 'ci-logs' / 'check-501'
logs.mkdir(parents=True, exist_ok=True)
results = []

def run(directory, label, command):
    log = logs / (directory.replace('/', '-') + '-' + label + '.log')
    with log.open('w') as output:
        result = subprocess.run(command, cwd=root / directory, stdout=output,
                                stderr=subprocess.STDOUT, env={**os.environ, 'HUSKY': '0'})
    row = {'directory': directory, 'check': label, 'exit_code': result.returncode,
           'command': command, 'log': str(log.relative_to(root))}
    results.append(row)
    (logs / ('results-' + sys.argv[1] + '.json')).write_text(json.dumps(results, indent=2))
    print(f'{directory} {label}: {result.returncode}', flush=True)
    return result.returncode == 0

if sys.argv[1] == 'runtime':
    for directory in ['.', 'sdk', 'api', 'backend/indexer', 'wallet-ui', 'mobile',
                      'mobile-app', 'dashboard', 'scripts/faucet', 'tests/tooling',
                      'tests/invariants', 'tests/adversarial', 'tests/lending-adapter',
                      'tests/nowpayments-adapter', 'tests/recurring-payments', 'tests/dex']:
        package = json.loads((root / directory / 'package.json').read_text())
        install = ['npm', 'ci', '--no-audit', '--no-fund'] if (root / directory / 'package-lock.json').exists() else ['npm', 'install', '--package-lock=false', '--no-audit', '--no-fund']
        if not run(directory, 'install', install):
            continue
        for label in ['build', 'typecheck', 'lint', 'test']:
            if label in package.get('scripts', {}):
                command = ['npm', 'run', label]
                if label == 'test' and ('jest' in package['scripts'][label]):
                    command += ['--', '--runInBand']
                run(directory, label, command)
        if directory in ['sdk', 'api', 'backend/indexer', 'wallet-ui', 'mobile',
                         'mobile-app', 'dashboard', 'scripts/faucet']:
            run(directory, 'audit', ['npm', 'audit', '--json'])
elif sys.argv[1] == 'contracts':
    for directory in ['contracts/payment-hub', 'contracts/governance', 'contracts/multisig',
                      'contracts/lending', 'contracts/key-collision', 'contracts/merchant-hub',
                      'contracts/collateral-signal']:
        if not run(directory, 'install', ['npm', 'install', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund']):
            continue
        package = json.loads((root / directory / 'package.json').read_text())
        for label in ['build', 'build:deployable', 'build:phase4', 'lint', 'test']:
            if label in package.get('scripts', {}):
                command = ['npm', 'run', label]
                if label == 'test':
                    command += ['--', '--runInBand']
                run(directory, label, command)
else:
    raise SystemExit('Ожидался runtime или contracts')
raise SystemExit(1 if any(row['exit_code'] for row in results) else 0)
