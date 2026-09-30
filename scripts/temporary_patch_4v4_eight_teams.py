from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

TEAMS = [
    ('lions', 'LIONS', 'Proverbs 28:1', 'lions-logo.png'),
    ('valiant', 'VALIANT', 'Joshua 1:9', 'valiant-logo.png'),
    ('watchmen', 'WATCHMEN', 'Isaiah 62:6', 'watchmen-logo.png'),
    ('conquerors', 'CONQUERORS', 'Romans 8:37', 'conquerors-logo.png'),
    ('chosen', 'CHOSEN', '1 Peter 2:9', 'chosen-logo.png'),
    ('eagles', 'EAGLES', 'Isaiah 40:31', 'eagles-logo.png'),
    ('steadfast', 'STEADFAST', '1 Corinthians 15:58', 'steadfast-logo.png'),
    ('warriors', 'WARRIORS', 'Exodus 15:3', 'warriors-logo.png'),
]


def read(name):
    return (ROOT / name).read_text(encoding='utf-8')


def write(name, text):
    (ROOT / name).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Missing patch marker: {label}')
    return text.replace(old, new, 1)


# Premium carousel registry.
path = 'home-future-4v4-card-cleanup.js'
text = read(path)
new_clubs = '  const CLUBS = [\n' + ''.join(
    f"    {{ id: '{club}', name: '{name}', verse: '{verse}', art: 'assets/3v3/clubs/{art}' }},\n"
    for club, name, verse, art in TEAMS
) + '  ];'
text, count = re.subn(r"  const CLUBS = \[\n(?:    \{[^\n]+\},\n)+  \];", new_clubs, text, count=1)
if count != 1:
    raise SystemExit('Could not replace premium carousel CLUBS registry')
write(path, text)

# Team Code registry.
path = 'home-future-4v4-team-code-beta.js'
text = read(path)
new_names = "  const CLUB_NAMES = Object.freeze({\n" + ''.join(
    f"    {club}: '{name}',\n" for club, name, _verse, _art in TEAMS
) + '  });'
text, count = re.subn(r"  const CLUB_NAMES = Object\.freeze\(\{\n(?:    [a-z]+: '[A-Z]+',\n)+  \}\);", new_names, text, count=1)
if count != 1:
    raise SystemExit('Could not replace Team Code CLUB_NAMES registry')
write(path, text)

# OVR header registry. Keep the legacy balance sample scoped to the original four so this catalog expansion does not change OVR rules.
path = 'home-future-4v4-team-ovr-header.js'
text = read(path)
old = "  const CLUB_NAMES = Object.freeze({ lions:'LIONS', valiant:'VALIANT', watchmen:'WATCHMEN', conquerors:'CONQUERORS' });"
new = "  const CLUB_NAMES = Object.freeze({ lions:'LIONS', valiant:'VALIANT', watchmen:'WATCHMEN', conquerors:'CONQUERORS', chosen:'CHOSEN', eagles:'EAGLES', steadfast:'STEADFAST', warriors:'WARRIORS' });\n  const BALANCE_CLUB_IDS = Object.freeze(['lions', 'valiant', 'watchmen', 'conquerors']);"
text = replace_once(text, old, new, 'OVR club names')
text = replace_once(
    text,
    "    const validByClub = Object.keys(CLUB_NAMES).map((clubId) => clubPlayers(clubId).map((p) => finite(p?.ovr)).filter((v) => v !== null && v > 0));",
    "    const validByClub = BALANCE_CLUB_IDS.map((clubId) => clubPlayers(clubId).map((p) => finite(p?.ovr)).filter((v) => v !== null && v > 0));",
    'OVR legacy balance scope',
)
match = re.search(r'(      \.rp-4v4-static-view\[data-rp-active-club="conquerors"\]\{[^\n]+\}\n)', text)
if not match:
    raise SystemExit('Missing OVR conquerors theme marker')
ovr_extra = (
    '      .rp-4v4-static-view[data-rp-active-club="chosen"]{--rp4v4-ovr-accent:#2dd4bf;--rp4v4-ovr-mid:#168d83;--rp4v4-ovr-deep:#0f655f;--rp4v4-ovr-dark:#062d2b;--rp4v4-ovr-line:#55ead6;--rp4v4-ovr-line-deep:#0d625b;--rp4v4-ovr-soft:rgba(45,212,191,.24);--rp4v4-ovr-glow:rgba(45,212,191,.25);--rp4v4-ovr-shadow:#0a514b;--rp4v4-ovr-label:#b4fff4}\n'
    '      .rp-4v4-static-view[data-rp-active-club="eagles"]{--rp4v4-ovr-accent:#47b7ff;--rp4v4-ovr-mid:#167fc6;--rp4v4-ovr-deep:#0d5e98;--rp4v4-ovr-dark:#06233d;--rp4v4-ovr-line:#6cc8ff;--rp4v4-ovr-line-deep:#0b568d;--rp4v4-ovr-soft:rgba(71,183,255,.24);--rp4v4-ovr-glow:rgba(71,183,255,.25);--rp4v4-ovr-shadow:#08436f;--rp4v4-ovr-label:#c2eaff}\n'
    '      .rp-4v4-static-view[data-rp-active-club="steadfast"]{--rp4v4-ovr-accent:#5fd16f;--rp4v4-ovr-mid:#2c943d;--rp4v4-ovr-deep:#1d6d2b;--rp4v4-ovr-dark:#092d12;--rp4v4-ovr-line:#7de98c;--rp4v4-ovr-line-deep:#1b6528;--rp4v4-ovr-soft:rgba(95,209,111,.24);--rp4v4-ovr-glow:rgba(95,209,111,.24);--rp4v4-ovr-shadow:#145321;--rp4v4-ovr-label:#c8ffd0}\n'
    '      .rp-4v4-static-view[data-rp-active-club="warriors"]{--rp4v4-ovr-accent:#ff8b35;--rp4v4-ovr-mid:#c95314;--rp4v4-ovr-deep:#96380d;--rp4v4-ovr-dark:#3b1406;--rp4v4-ovr-line:#ffa45f;--rp4v4-ovr-line-deep:#8a320b;--rp4v4-ovr-soft:rgba(255,139,53,.24);--rp4v4-ovr-glow:rgba(255,139,53,.24);--rp4v4-ovr-shadow:#6b2808;--rp4v4-ovr-label:#ffd8bc}\n'
)
text = text[:match.end()] + ovr_extra + text[match.end():]
write(path, text)

# Shared club art helper.
path = 'three-v-three-club-art.js'
text = read(path)
text = replace_once(
    text,
    "    CONQUERORS: 'assets/3v3/clubs/conquerors-logo.png',\n  };",
    "    CONQUERORS: 'assets/3v3/clubs/conquerors-logo.png',\n    CHOSEN: 'assets/3v3/clubs/chosen-logo.png',\n    EAGLES: 'assets/3v3/clubs/eagles-logo.png',\n    STEADFAST: 'assets/3v3/clubs/steadfast-logo.png',\n    WARRIORS: 'assets/3v3/clubs/warriors-logo.png',\n  };",
    'club art map',
)
text = replace_once(
    text,
    "  const CLUB_CLASSES = ['club-lions', 'club-valiant', 'club-watchmen', 'club-conquerors'];",
    "  const CLUB_CLASSES = ['club-lions', 'club-valiant', 'club-watchmen', 'club-conquerors', 'club-chosen', 'club-eagles', 'club-steadfast', 'club-warriors'];",
    'club class list',
)
write(path, text)

# Shared premium card/background themes.
path = 'three-v-three-club-themes.css'
text = read(path)
active_marker = ".rp-3v3-view[data-rp-active-club='conquerors']{\n  --rp-active-club-color:#a64dff;\n  --rp-active-club-art:url('assets/3v3/clubs/conquerors-logo.png');\n}\n"
active_add = """.rp-3v3-view[data-rp-active-club='chosen']{
  --rp-active-club-color:#2dd4bf;
  --rp-active-club-art:url('assets/3v3/clubs/chosen-logo.png');
}
.rp-3v3-view[data-rp-active-club='eagles']{
  --rp-active-club-color:#47b7ff;
  --rp-active-club-art:url('assets/3v3/clubs/eagles-logo.png');
}
.rp-3v3-view[data-rp-active-club='steadfast']{
  --rp-active-club-color:#5fd16f;
  --rp-active-club-art:url('assets/3v3/clubs/steadfast-logo.png');
}
.rp-3v3-view[data-rp-active-club='warriors']{
  --rp-active-club-color:#ff8b35;
  --rp-active-club-art:url('assets/3v3/clubs/warriors-logo.png');
}
"""
text = replace_once(text, active_marker, active_marker + active_add, 'active club background themes')
card_marker = ".rp-team-card[data-rp-three-club='conquerors'],\n.rp-team-fixed-card.club-conquerors{\n  --club-accent:#b45cff;\n  --club-accent-rgb:180,92,255;\n  --club-secondary:#6d24db;\n  --club-secondary-rgb:109,36,219;\n  --club-glow:rgba(171,74,255,.24);\n}\n"
card_add = """
.rp-team-card[data-rp-three-club='chosen'],
.rp-team-fixed-card.club-chosen{
  --club-accent:#2dd4bf;
  --club-accent-rgb:45,212,191;
  --club-secondary:#167f75;
  --club-secondary-rgb:22,127,117;
  --club-glow:rgba(45,212,191,.23);
}

.rp-team-card[data-rp-three-club='eagles'],
.rp-team-fixed-card.club-eagles{
  --club-accent:#47b7ff;
  --club-accent-rgb:71,183,255;
  --club-secondary:#176ea8;
  --club-secondary-rgb:23,110,168;
  --club-glow:rgba(71,183,255,.23);
}

.rp-team-card[data-rp-three-club='steadfast'],
.rp-team-fixed-card.club-steadfast{
  --club-accent:#5fd16f;
  --club-accent-rgb:95,209,111;
  --club-secondary:#2d873a;
  --club-secondary-rgb:45,135,58;
  --club-glow:rgba(95,209,111,.23);
}

.rp-team-card[data-rp-three-club='warriors'],
.rp-team-fixed-card.club-warriors{
  --club-accent:#ff8b35;
  --club-accent-rgb:255,139,53;
  --club-secondary:#b94713;
  --club-secondary-rgb:185,71,19;
  --club-glow:rgba(255,139,53,.23);
}
"""
text = replace_once(text, card_marker, card_marker + card_add, 'card themes')
write(path, text)

# Cache-bust the active 4v4 runtime chain.
path = 'home-4v4-slot-picker-dynamic-v2.js'
text = read(path)
text = replace_once(text, "  const CURRENT_4V4_RUNTIME_VERSION = '20260930-slot-handoff-runtime-v7';", "  const CURRENT_4V4_RUNTIME_VERSION = '20260930-eight-team-runtime-v8';", '4v4 runtime version')
write(path, text)

path = 'home-4v4-slot-picker.js'
text = read(path)
text = replace_once(text, 'home-4v4-slot-picker-dynamic-v2.js?v=20260930-admin-time-blocks-v4', 'home-4v4-slot-picker-dynamic-v2.js?v=20260930-eight-team-catalog-v5', 'slot picker dynamic version')
write(path, text)

path = 'index.html'
text = read(path)
text = replace_once(text, 'data-rp-deploy="20260930-home-team-time-blocks-v149"', 'data-rp-deploy="20260930-eight-team-catalog-v150"', 'deploy marker')
text = replace_once(text, 'home-4v4-slot-picker.js?v=20260930-slot-header-v10', 'home-4v4-slot-picker.js?v=20260930-eight-team-catalog-v11', 'slot picker loader cache key')
write(path, text)

# If auxiliary loaders have explicit cache keys, bump only those references.
versions = {
    'home-future-4v4-team-code-beta.js': '20260930-eight-team-catalog-v2',
    'home-future-4v4-team-ovr-header.js': '20260930-eight-team-catalog-v2',
    'three-v-three-club-art.js': '20260930-eight-team-catalog-v2',
    'three-v-three-club-themes.css': '20260930-eight-team-catalog-v2',
}
for candidate in [*ROOT.glob('*.js'), *ROOT.glob('*.html'), *ROOT.glob('*.css')]:
    source = candidate.read_text(encoding='utf-8')
    updated = source
    for filename, version in versions.items():
        updated = re.sub(re.escape(filename) + r'\?v=[^\"\'\)\s]+', f'{filename}?v={version}', updated)
    if updated != source:
        candidate.write_text(updated, encoding='utf-8')

# Contract sanity.
required = [team[0] for team in TEAMS]
for filename in ['home-future-4v4-card-cleanup.js', 'home-future-4v4-team-code-beta.js', 'home-future-4v4-team-ovr-header.js']:
    source = read(filename).lower()
    missing = [club for club in required if club not in source]
    if missing:
        raise SystemExit(f'{filename} missing team ids: {missing}')

print('Eight-team frontend patch complete:', ', '.join(required))
