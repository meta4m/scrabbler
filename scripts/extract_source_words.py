"""Extract the word lists from the supplied Word Study PDF text export.

The PDF is a curated study sheet, so this keeps the printed section as
provenance instead of treating the result as a universal dictionary.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / 'data/source/Word Study.pdf'
OUT_WORDS = ROOT / 'src/data/source-words.json'
OUT_BINGOS = ROOT / 'src/data/bingo-families.json'
text = subprocess.check_output(['pdftotext', '-raw', str(PDF), '-'], text=True)
lines = [line.strip() for line in text.splitlines()]

def between(start, end):
    a = lines.index(start) + 1
    b = next(index for index in range(a, len(lines)) if lines[index].startswith(end))
    return lines[a:b]

def words_in(items, lengths=None):
    return [item for item in items if re.fullmatch(r'[A-Z]+', item) and (lengths is None or len(item) in lengths)]

records = []
def add(section, category, items, lengths=None):
    for spelling in words_in(items, lengths):
        records.append({'spelling': spelling, 'category': category, 'sourceSection': section})

add('2-Letter Words', '2-letter', between('2-Letter Words', 'Short J Words'), {2})
add('Short J Words', 'power', between('Short J Words', 'Short Q Words'))
add('Short Q Words', 'power', between('Short Q Words', 'Short X Words'))
add('Short X Words', 'power', between('Short X Words', 'Short Z Words'))
add('Short Z Words', 'power', between('Short Z Words', '3-Letter Words'))
add('3-Letter Words', '3-letter', between('3-Letter Words', 'BINGOS:'), {3})

bingo_start = lines.index('TISANE + ?')
bingo_end = lines.index('I Dumps')
current = None
families = []
for line in lines[bingo_start:bingo_end]:
    if line.endswith(' + ?'):
        current = {'stem': line.split(' + ')[0], 'answers': []}
        families.append(current)
    elif current and re.fullmatch(r'[A-Z]{7}', line):
        current['answers'].append(line)

for family in families:
    add(f"{family['stem']} bingo family", 'bingo', family['answers'], {7})

hiprob7 = lines.index('Hi Prob 7s')
hiprob8 = lines.index('Hi Prob 8s')
idumps = lines.index('I Dumps')
add('High Probability 7s', 'high-probability-bingo', lines[hiprob7 + 1:hiprob8], {7})
add('High Probability 8s', 'high-probability-bingo', lines[hiprob8 + 1:idumps], {8})
dump_sections = [('I Dumps', 'i-dump', 'U Dumps'), ('U Dumps', 'u-dump', 'Vowel Dumps'), ('Vowel Dumps', 'vowel-dump', None)]
for section, category, end in dump_sections:
    items = between(section, end) if end else lines[lines.index(section) + 1:]
    add(section, category, items)

OUT_WORDS.write_text(json.dumps(records, indent=2) + '\n')
OUT_BINGOS.write_text(json.dumps(families, indent=2) + '\n')
print(f'Wrote {len(records)} source entries and {sum(len(f["answers"]) for f in families)} bingo answers')
