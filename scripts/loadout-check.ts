// Validates the loadout parser against the REAL payload shape
// (cross-checked from pwall2222/NOWT's working C# client).
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { loadWeaponCatalog, parseLoadouts, resolveLoadoutForPlayer, groupByCategory } = await import(
  '../src/utils/loadout.ts'
);

const VANDAL = '9c82e19d-4575-0200-1a81-3eacf00cf872';
const CLASSIC = '29a0cfab-485b-f5d5-779a-b59f85e204a8';
const SKIN_SOCKET = '3ad1b2b2-acdb-4524-852f-954a76ddae0a';
// Real RGX 11z Pro Vandal CHROMA uuid — this is what Riot puts in the socket.
const RGX_CHROMA = '742740d0-4e50-57e1-af32-f991c7c640f8';
// Default (unskinned) vandal entry.
const VANDAL_DEFAULT = 'd980c0c8-492b-b8df-2d91-af99a7707170';

const payload = {
  Loadouts: [
    {
      CharacterID: 'add6443a-41bd-e414-f6ad-e58d267f4e95',
      Loadout: {
        Subject: '29bf3c62-9f92-5b55-8188-a4e88f04b8ec',
        Items: {
          [VANDAL]: {
            ID: VANDAL_DEFAULT,
            TypeID: VANDAL,
            Sockets: {
              [SKIN_SOCKET]: { ID: 'sock-1', Item: { ID: RGX_CHROMA, TypeID: 't-1' } },
            },
          },
          // No Sockets -> player runs the default Classic skin.
          [CLASSIC]: { ID: CLASSIC, TypeID: CLASSIC },
        },
        Sprays: { SpraySelections: [{ SocketID: 'sp1', SprayID: 'aaa-111', LevelID: '' }] },
        Expressions: { AESSelections: [{ SocketID: 'e1', AssetID: 'bbb-222', TypeID: 't' }] },
      },
    },
  ],
};

const catalog = await loadWeaponCatalog();
console.log('catalog weapons loaded:', Object.keys(catalog.weapons).length);

const all = parseLoadouts(payload, catalog);
const l = all[0];
console.log('\n--- parsed ---');
console.log('subject:', l.subject);
console.log('characterId:', l.characterId);
for (const w of l.weapons) {
  console.log(`  ${w.weaponName} -> skin="${w.skinName}" default=${w.isDefaultSkin}`);
}
console.log('expressions:', l.expressions.map((e) => e.kind).join(', '));

const byCat = groupByCategory(l.weapons);
console.log('categories:', Object.keys(byCat).join(' | '));

const checks: [string, boolean][] = [
  ['2 weapons parsed', l.weapons.length === 2],
  ['subject (puuid) extracted', l.subject === '29bf3c62-9f92-5b55-8188-a4e88f04b8ec'],
  ['vival vandal chroma resolved to RGX', l.weapons.some((w) => w.skinName.includes('RGX'))],
  ['chroma NOT reported as default', l.weapons.find((w) => w.weaponName === 'Vandal')?.isDefaultSkin === false],
  ['classic flagged default skin', l.weapons.find((w) => w.weaponName === 'Classic')?.isDefaultSkin === true],
  ['spray parsed', l.expressions.some((e) => e.kind === 'spray')],
  ['flex parsed', l.expressions.some((e) => e.kind === 'flex')],
  ['grouped into Rifle + Sidearm', !!byCat['EEquippableCategory::Rifle'] && !!byCat['EEquippableCategory::Sidearm']],
  ['resolve by PUUID', resolveLoadoutForPlayer(all, { puuid: l.subject }).loadout !== null],
  ['resolve by characterId', resolveLoadoutForPlayer(all, { characterId: l.characterId }).loadout !== null],
  ['resolve by index', resolveLoadoutForPlayer(all, { index: 0 }).loadout !== null],
  ['unknown puuid -> null', resolveLoadoutForPlayer(all, { puuid: 'nope' }).loadout === null],
];

let fail = 0;
console.log('\n--- checks ---');
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) fail++;
}
console.log(fail === 0 ? '\nLOADOUT_TEST_PASS' : `\nLOADOUT_TEST_FAIL (${fail})`);
if (fail) process.exit(1);
