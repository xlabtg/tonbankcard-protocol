"""Печатает строки исходников без отдельных комментариев, сохраняя номера строк.

Используется только для навигации аудита. Оригиналы остаются источником истины.
"""
import pathlib
import sys

for name in sys.argv[1:]:
    path = pathlib.Path(name)
    print(f'\nFILE {path}')
    in_comment = False
    for index, line in enumerate(path.read_text().splitlines(), 1):
        stripped = line.strip()
        if in_comment:
            if '*/' in stripped:
                in_comment = False
            continue
        if stripped.startswith('/*'):
            in_comment = '*/' not in stripped
            continue
        if not stripped or stripped.startswith(('//', '#', '* ', '*', ';;')):
            continue
        print(f'{index}: {line}')
