import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const ZIEL = path.join(ROOT, 'public', 'offline-data')
const API = 'https://pokeapi.co/api/v2'
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites'
const API_URLS = new Set()

async function laden(url, versuch = 1) {
  const antwort = await fetch(url, { headers: { 'User-Agent': 'Feuerrot-Offline-Builder/1.0' } })
  if (antwort.ok) return antwort
  if (versuch < 4 && (antwort.status === 429 || antwort.status >= 500)) {
    await new Promise((resolve) => setTimeout(resolve, versuch * 1500))
    return laden(url, versuch + 1)
  }
  throw new Error(`${antwort.status} für ${url}`)
}

async function pool(werte, limit, arbeit) {
  let index = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (index < werte.length) {
      const aktuell = werte[index++]
      await arbeit(aktuell)
    }
  }))
}

function apiDatei(url) {
  const relativ = new URL(url).pathname.replace(/^\/api\/v2\//, '').replace(/\/$/, '')
  return path.join(ZIEL, 'api', `${relativ}.json`)
}

async function jsonSpeichern(url) {
  const datei = apiDatei(url)
  await mkdir(path.dirname(datei), { recursive: true })
  const daten = await (await laden(url)).json()
  await writeFile(datei, JSON.stringify(daten))
  return daten
}

async function bildSpeichern(url, datei, optional = false) {
  try {
    const antwort = await laden(url)
    await mkdir(path.dirname(datei), { recursive: true })
    await writeFile(datei, Buffer.from(await antwort.arrayBuffer()))
  } catch (error) {
    if (!optional) throw error
  }
}

await mkdir(ZIEL, { recursive: true })
console.log('Lade Pokémon- und Artendaten …')
const pokemonDaten = new Map()
const speciesDaten = new Map()
await pool(Array.from({ length: 386 }, (_, i) => i + 1), 12, async (id) => {
  const [pokemon, species] = await Promise.all([jsonSpeichern(`${API}/pokemon/${id}`), jsonSpeichern(`${API}/pokemon-species/${id}`)])
  pokemonDaten.set(id, pokemon)
  speciesDaten.set(id, species)
})

for (const pokemon of pokemonDaten.values()) {
  for (const eintrag of [...(pokemon.types ?? []), ...(pokemon.past_types ?? []).flatMap((alt) => alt.types ?? [])]) API_URLS.add(eintrag.type.url)
  for (const eintrag of pokemon.moves ?? []) {
    if ((eintrag.version_group_details ?? []).some((detail) => detail.version_group.name === 'firered-leafgreen')) API_URLS.add(eintrag.move.url)
  }
}
for (const species of speciesDaten.values()) if (species.evolution_chain?.url) API_URLS.add(species.evolution_chain.url)
for (let id = 1; id <= 354; id += 1) API_URLS.add(`${API}/move/${id}`)
const itemQuelle = await readFile(path.join(ROOT, 'src', 'itemData.ts'), 'utf8')
const itemNamen = [...itemQuelle.matchAll(/"identifier"\s*:\s*"([^"]+)"/g)].map((treffer) => treffer[1])
for (const name of itemNamen) API_URLS.add(`${API}/item/${name}`)

console.log(`Lade ${API_URLS.size} verknüpfte API-Datensätze …`)
const ersteRunde = [...API_URLS]
await pool(ersteRunde, 12, async (url) => {
  const daten = await jsonSpeichern(url)
  if (url.includes('/evolution-chain/')) {
    const besuchen = (knoten) => {
      for (const ziel of knoten.evolves_to ?? []) {
        for (const detail of ziel.evolution_details ?? []) {
          for (const key of ['item', 'held_item', 'known_move', 'location', 'trade_species']) if (detail[key]?.url) API_URLS.add(detail[key].url)
        }
        besuchen(ziel)
      }
    }
    besuchen(daten.chain)
  }
})
const zweiteRunde = [...API_URLS].filter((url) => !ersteRunde.includes(url))
await pool(zweiteRunde, 12, jsonSpeichern)

console.log('Lade Pokémon-Bilder …')
await pool(Array.from({ length: 386 }, (_, i) => i + 1), 10, (id) => bildSpeichern(`${SPRITES}/pokemon/other/official-artwork/${id}.png`, path.join(ZIEL, 'pokemon', `${id}.png`)))

console.log(`Lade ${itemNamen.length} Itembilder …`)
await pool(itemNamen, 12, (name) => bildSpeichern(`${SPRITES}/items/${name}.png`, path.join(ZIEL, 'items', `${name}.png`), true))
const maschinenTypen = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark']
console.log('Lade typabhängige TM- und VM-Bilder …')
await pool(maschinenTypen, 8, (typ) => bildSpeichern(`${SPRITES}/items/tm-${typ}.png`, path.join(ZIEL, 'items', `tm-${typ}.png`)))

console.log('Offline-Datenpaket vollständig.')
