// Validates the loadout parser against the REAL payload shape captured from a
// live match, cross-checked with pwall2222/NOWT's working C# client.
//
//   bun run test:loadout
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
const MARSHAL = 'c4883e50-4494-202c-3ec3-6b8a9284f00b';
const CLASSIC = '29a0cfab-485b-f5d5-779a-b59f85e204a8';
const SKIN_SOCKET = '3ad1b2b2-acdb-4524-852f-954a76ddae0a';
// Real RGX 11z Pro Vandal CHROMA — what Riot puts in the socket for a skinned gun.
const RGX_CHROMA = '742740d0-4e50-57e1-af32-f991c7c640f8';
// Real "Standard Marshal" SKIN uuid — its CDN art is a grey-X placeholder,
// which is exactly why the parser must fall back to the weapon-level render.
const STANDARD_MARSHAL = 'fd44b2d5-49ee-77ab-fa56-588f3ac0c268';
// Real expression assets: a spray and a flex, which need DIFFERENT image paths.
const SPRAY_ID = '0a6db78c-48b9-a32d-c47a-82be597584c1'; // "VALORANT Spray"
const FLEX_ID = 'fc33f376-4a58-687c-6961-bd8a7e529346'; // "ORA by OneTap Flex"

const payload = {
  Loadouts: [
    {
      CharacterID: 'add6443a-41bd-e414-f6ad-e58d267f4e95',
      Subject: '29bf3c62-9f92-5b55-8188-a4e88f04b8ec',
      Loadout: {
        Subject: '29bf3c62-9f92-5b55-8188-a4e88f04b8ec',
        Items: {
          [VANDAL]: {
            ID: VANDAL,
            TypeID: VANDAL,
            Sockets: { [SKIN_SOCKET]: { ID: 's1', Item: { ID: RGX_CHROMA, TypeID: 't1' } } },
          },
          [MARSHAL]: {
            ID: STANDARD_MARSHAL,
            TypeID: MARSHAL,
            Sockets: { [SKIN_SOCKET]: { ID: 's2', Item: { ID: STANDARD_MARSHAL, TypeID: 't2' } } },
          },
          [CLASSIC]: { ID: CLASSIC, TypeID: CLASSIC },
        },
        // Sprays and flexes arrive TOGETHER under AESSelections; `Sprays` is
        // absent from the live payload entirely.
        Expressions: {
          AESSelections: [
            { AssetID: SPRAY_ID, TypeID: 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475' },
            { AssetID: FLEX_ID, TypeID: 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475' },
          ],
        },
        DynamicOptions: {},
      },
    },
  ],
};

const catalog = await loadWeaponCatalog();
console.log('catalog: weapons=%d sprays=%d flex=%d skinIndex=%d', Object.keys(catalog.weapons).length, Object.keys(catalog.sprays).length, Object.keys(catalog.flex).length, Object.keys(catalog.skinIndex).length);
if (Object.keys(catalog.sprays).length === 0) console.log('WARNING: spray table empty (network?)');

const all = parseLoadouts(payload, catalog);
const l = all[0];
console.log('\n--- parsed ---');
console.log('subject:', l.subject);
for (const w of l.weapons) {
  console.log(`  ${w.weaponName.padEnd(9)} skin="${w.skinName}" default=${w.isDefaultSkin}`);
  console.log(`            icon=${w.icon.split('/').slice(-3)[0]}/${w.icon.split('/').pop()}`);
}
for (const e of l.expressions) console.log(`  expr: ${e.kind.padEnd(5)} "${e.name}"`);

const vandal = l.weapons.find((w) => w.weaponName === 'Vandal');
const marshal = l.weapons.find((w) => w.weaponName === 'Marshal');
const spray = l.expressions.find((e) => e.kind === 'spray');
const flex = l.expressions.find((e) => e.kind === 'flex');

const checks: [string, boolean][] = [
  ['3 weapons parsed', l.weapons.length === 3],
  ['subject (PUUID) extracted', l.subject === '29bf3c62-9f92-5b55-8188-a4e88f04b8ec'],
  ['vandal chroma -> real skin art', !!vandal && vandal.skinName.includes('RGX') && vandal.icon.includes('weaponskinchromas')],
  ['vandal not default', vandal?.isDefaultSkin === false],
  ['standard marshal flagged default', marshal?.isDefaultSkin === true],
  ['standard marshal uses WEAPON art (not the X placeholder)', !!marshal && marshal.icon.includes('/weapons/') && !marshal.icon.includes('weaponskins/')],
  ['classic (no socket) uses weapon art', l.weapons.find((w) => w.weaponName === 'Classic')?.icon.includes('/weapons/') === true],
  ['spray resolved with SPRAY path', !!spray && spray.icon.includes('/sprays/')],
  ['spray named', !!spray && spray.name.length > 0],
  ['flex resolved with FLEX path', !!flex && flex.icon.includes('/flex/')],
  ['flex named', !!flex && flex.name.length > 0],
  ['resolve by PUUID', resolveLoadoutForPlayer(all, { puuid: l.subject }).loadout !== null],
  ['resolve by characterId', resolveLoadoutForPlayer(all, { characterId: l.characterId }).loadout !== null],
  ['resolve by index', resolveLoadoutForPlayer(all, { index: 0 }).loadout !== null],
  ['unknown puuid -> null', resolveLoadoutForPlayer(all, { puuid: 'nope' }).loadout === null],
  ['grouped into Rifle + Sidearm + Sniper', !!groupByCategory(l.weapons)['EEquippableCategory::Rifle'] && !!groupByCategory(l.weapons)['EEquippableCategory::Sidearm'] && !!groupByCategory(l.weapons)['EEquippableCategory::Sniper']],
];

let fail = 0;
console.log('\n--- checks ---');
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) fail++;
}
console.log(fail === 0 ? '\nLOADOUT_TEST_PASS' : `\nLOADOUT_TEST_FAIL (${fail})`);
if (fail) process.exit(1);
