import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { POKEMON, type PokedexEntry } from './pokemonData'
import { ATTACKEN } from './moveData'
import { ITEMS } from './itemData'

const API = 'https://pokeapi.co/api/v2'
const BILD = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
const ITEM_BILD = (identifier: string) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${identifier}.png`

type NamedResource = { name: string; url: string }
type LocalizedName = { name: string; language: NamedResource }
type PokemonType = { slot: number; type: NamedResource }
type PokemonStat = { base_stat: number; stat: NamedResource }
type DamageRelations = {
  double_damage_from: NamedResource[]
  double_damage_to: NamedResource[]
  half_damage_from: NamedResource[]
  half_damage_to: NamedResource[]
  no_damage_from: NamedResource[]
  no_damage_to: NamedResource[]
}
type PastType = { generation: NamedResource; types: PokemonType[] }
type PastStat = { generation: NamedResource; stats: PokemonStat[] }
type TypeApi = {
  name: string
  damage_relations: DamageRelations
  past_damage_relations: { generation: NamedResource; damage_relations: DamageRelations }[]
}
type PokemonApi = {
  id: number
  height: number
  weight: number
  types: PokemonType[]
  past_types: PastType[]
  stats: PokemonStat[]
  past_stats: PastStat[]
  moves: {
    move: NamedResource
    version_group_details: {
      level_learned_at: number
      move_learn_method: NamedResource
      version_group: NamedResource
    }[]
  }[]
}
type SpeciesApi = {
  names: LocalizedName[]
  genera: { genus: string; language: NamedResource }[]
  flavor_text_entries: {
    flavor_text: string
    language: NamedResource
    version: NamedResource
  }[]
  evolution_chain: { url: string }
}
type MoveApi = {
  id: number
  names: LocalizedName[]
  type: NamedResource
  power: number | null
  accuracy: number | null
}
type EvolutionDetail = {
  trigger: NamedResource
  version_group: NamedResource | null
  item: NamedResource | null
  held_item: NamedResource | null
  known_move: NamedResource | null
  location: NamedResource | null
  min_level: number | null
  min_happiness: number | null
  min_beauty: number | null
  relative_physical_stats: number | null
  time_of_day: string
  trade_species: NamedResource | null
}
type ChainLink = {
  species: NamedResource
  evolution_details: EvolutionDetail[]
  evolves_to: ChainLink[]
}
type EvolutionApi = { chain: ChainLink }

type Matchup = { type: string; multiplier?: number }
type LevelMove = {
  id: number
  name: string
  level: number
  type: string
  power: number | null
  accuracy: number | null
}
type EvolutionStep = { fromId: number; toId: number; condition: string }
type PokemonDetails = {
  id: number
  name: string
  genus: string
  description: string
  height: number
  weight: number
  types: string[]
  stats: { name: string; value: number }[]
  strongAgainst: Matchup[]
  weaknesses: Matchup[]
  resistances: Matchup[]
  immunities: Matchup[]
  moves: LevelMove[]
  evolutions: EvolutionStep[]
}

const TYPEN: Record<string, string> = {
  normal: 'Normal',
  fighting: 'Kampf',
  flying: 'Flug',
  poison: 'Gift',
  ground: 'Boden',
  rock: 'Gestein',
  bug: 'Käfer',
  ghost: 'Geist',
  steel: 'Stahl',
  fire: 'Feuer',
  water: 'Wasser',
  grass: 'Pflanze',
  electric: 'Elektro',
  psychic: 'Psycho',
  ice: 'Eis',
  dragon: 'Drache',
  dark: 'Unlicht',
}

const WERTE: Record<string, string> = {
  hp: 'KP',
  attack: 'Angriff',
  defense: 'Verteidigung',
  'special-attack': 'Spezial-Angriff',
  'special-defense': 'Spezial-Verteidigung',
  speed: 'Initiative',
}

const VERSION_RANG: Record<string, number> = {
  'red-blue': 1,
  yellow: 2,
  'gold-silver': 3,
  crystal: 4,
  'ruby-sapphire': 5,
  emerald: 6,
  'firered-leafgreen': 7,
}

const apiCache = new Map<string, Promise<unknown>>()

function laden<T>(url: string): Promise<T> {
  if (!apiCache.has(url)) {
    apiCache.set(
      url,
      fetch(url).then((antwort) => {
        if (!antwort.ok) throw new Error('Die Pokédex-Daten konnten nicht geladen werden.')
        return antwort.json()
      }),
    )
  }
  return apiCache.get(url) as Promise<T>
}

function ressourcenId(resource: NamedResource | { url: string }) {
  return Number(resource.url.match(/\/(\d+)\/?$/)?.[1] ?? 0)
}

function generationsId(resource: NamedResource) {
  return ressourcenId(resource)
}

function typenFuerGeneration(pokemon: PokemonApi) {
  const historisch = pokemon.past_types
    .filter((eintrag) => generationsId(eintrag.generation) >= 3)
    .sort((a, b) => generationsId(a.generation) - generationsId(b.generation))[0]
  return (historisch?.types ?? pokemon.types).sort((a, b) => a.slot - b.slot)
}

function werteFuerGeneration(pokemon: PokemonApi) {
  return pokemon.stats.map((aktuellerWert) => {
    const historischerWert = pokemon.past_stats
      .filter((eintrag) => generationsId(eintrag.generation) >= 3)
      .sort((a, b) => generationsId(a.generation) - generationsId(b.generation))
      .flatMap((eintrag) => eintrag.stats)
      .find((wert) => wert.stat.name === aktuellerWert.stat.name)

    return historischerWert ?? aktuellerWert
  })
}

function relationFuerGeneration(typ: TypeApi) {
  const historisch = typ.past_damage_relations
    .filter((eintrag) => generationsId(eintrag.generation) >= 3)
    .sort((a, b) => generationsId(a.generation) - generationsId(b.generation))[0]
  return historisch?.damage_relations ?? typ.damage_relations
}

function istEnthalten(liste: NamedResource[], name: string) {
  return liste.some((eintrag) => eintrag.name === name)
}

function angriffsFaktor(angriff: string, verteidiger: DamageRelations) {
  if (istEnthalten(verteidiger.no_damage_from, angriff)) return 0
  if (istEnthalten(verteidiger.double_damage_from, angriff)) return 2
  if (istEnthalten(verteidiger.half_damage_from, angriff)) return 0.5
  return 1
}

function deutsch(liste: LocalizedName[], fallback: string) {
  return liste.find((eintrag) => eintrag.language.name === 'de')?.name ?? fallback
}

function fallbackName(name: string) {
  return name
    .split('-')
    .map((teil) => teil.charAt(0).toUpperCase() + teil.slice(1))
    .join(' ')
}

async function lokalisierterRessourcenName(resource: NamedResource | null) {
  if (!resource) return ''
  try {
    const daten = await laden<{ names?: LocalizedName[] }>(resource.url)
    return deutsch(daten.names ?? [], fallbackName(resource.name))
  } catch {
    return fallbackName(resource.name)
  }
}

function entwicklungsDetail(details: EvolutionDetail[]) {
  return [...details]
    .filter((detail) => detail.version_group && VERSION_RANG[detail.version_group.name] <= 7)
    .sort(
      (a, b) =>
        VERSION_RANG[b.version_group?.name ?? ''] - VERSION_RANG[a.version_group?.name ?? ''],
    )[0] ?? details[0]
}

async function entwicklungsBedingung(detail: EvolutionDetail | undefined) {
  if (!detail) return 'Entwicklungsbedingung unbekannt'

  const teile: string[] = []
  if (detail.trigger.name === 'trade') teile.push('durch Tausch')
  else if (detail.trigger.name === 'use-item') teile.push('durch Einsatz eines Items')
  else if (detail.trigger.name === 'shed') teile.push('beim Levelaufstieg mit freiem Teamplatz')
  else teile.push('durch Levelaufstieg')

  if (detail.min_level) teile.push(`ab Level ${detail.min_level}`)
  if (detail.min_happiness) teile.push(`mit Freundschaft ${detail.min_happiness}+`)
  if (detail.min_beauty) teile.push(`mit Schönheit ${detail.min_beauty}+`)
  if (detail.item) teile.push(`mit ${await lokalisierterRessourcenName(detail.item)}`)
  if (detail.held_item)
    teile.push(`mit getragenem Item ${await lokalisierterRessourcenName(detail.held_item)}`)
  if (detail.known_move)
    teile.push(`mit der Attacke ${await lokalisierterRessourcenName(detail.known_move)}`)
  if (detail.location)
    teile.push(`am Ort ${await lokalisierterRessourcenName(detail.location)}`)
  if (detail.trade_species)
    teile.push(`im Tausch gegen ${await lokalisierterRessourcenName(detail.trade_species)}`)
  if (detail.time_of_day === 'day') teile.push('tagsüber (in Feuerrot nicht direkt möglich)')
  if (detail.time_of_day === 'night') teile.push('nachts (in Feuerrot nicht direkt möglich)')
  if (detail.relative_physical_stats === 1) teile.push('mit Angriff > Verteidigung')
  if (detail.relative_physical_stats === 0) teile.push('mit Angriff = Verteidigung')
  if (detail.relative_physical_stats === -1) teile.push('mit Angriff < Verteidigung')

  return teile.join(' · ')
}

async function evolutionenAufbereiten(kette: EvolutionApi) {
  const schritte: EvolutionStep[] = []

  async function durchlaufen(link: ChainLink) {
    const von = ressourcenId(link.species)
    for (const ziel of link.evolves_to) {
      const zu = ressourcenId(ziel.species)
      if (von <= 386 && zu <= 386) {
        schritte.push({
          fromId: von,
          toId: zu,
          condition: await entwicklungsBedingung(entwicklungsDetail(ziel.evolution_details)),
        })
      }
      await durchlaufen(ziel)
    }
  }

  await durchlaufen(kette.chain)
  return schritte
}

async function detailsLaden(id: number): Promise<PokemonDetails> {
  const [pokemon, art] = await Promise.all([
    laden<PokemonApi>(`${API}/pokemon/${id}`),
    laden<SpeciesApi>(`${API}/pokemon-species/${id}`),
  ])

  const typen = typenFuerGeneration(pokemon)
  const typenDaten = await Promise.all(typen.map(({ type }) => laden<TypeApi>(type.url)))
  const relationen = new Map(
    typenDaten.map((typ) => [typ.name, relationFuerGeneration(typ)]),
  )

  const schwach: Matchup[] = []
  const resistent: Matchup[] = []
  const immun: Matchup[] = []

  Object.keys(TYPEN).forEach((angriff) => {
    const faktor = typen.reduce((produkt, verteidiger) => {
      const relation = relationen.get(verteidiger.type.name)
      return produkt * (relation ? angriffsFaktor(angriff, relation) : 1)
    }, 1)

    if (faktor > 1) schwach.push({ type: angriff, multiplier: faktor })
    else if (faktor === 0) immun.push({ type: angriff, multiplier: faktor })
    else if (faktor < 1) resistent.push({ type: angriff, multiplier: faktor })
  })

  schwach.sort((a, b) => (b.multiplier ?? 0) - (a.multiplier ?? 0))
  resistent.sort((a, b) => (a.multiplier ?? 1) - (b.multiplier ?? 1))

  const starkeTypen = new Set<string>()
  relationen.forEach((relation) => {
    relation.double_damage_to
      .filter((typ) => typ.name !== 'fairy')
      .forEach((typ) => starkeTypen.add(typ.name))
  })

  const levelAttacken = pokemon.moves
    .flatMap(({ move, version_group_details }) =>
      version_group_details
        .filter(
          (detail) =>
            detail.version_group.name === 'firered-leafgreen' &&
            detail.move_learn_method.name === 'level-up',
        )
        .map((detail) => ({ move, level: detail.level_learned_at })),
    )
    .filter(
      (eintrag, index, alle) =>
        alle.findIndex(
          (vergleich) =>
            vergleich.move.name === eintrag.move.name && vergleich.level === eintrag.level,
        ) === index,
    )
    .sort((a, b) => a.level - b.level || a.move.name.localeCompare(b.move.name))

  const attacken: LevelMove[] = await Promise.all(
    levelAttacken.map(async ({ move, level }) => {
      const daten = await laden<MoveApi>(move.url)
      return {
        id: daten.id,
        name: deutsch(daten.names, fallbackName(move.name)),
        level,
        type: daten.type.name,
        power: daten.power,
        accuracy: daten.accuracy,
      }
    }),
  )

  const kette = await laden<EvolutionApi>(art.evolution_chain.url)
  const eintrag = POKEMON[id - 1]
  const beschreibung =
    art.flavor_text_entries.find(
      (text) => text.language.name === 'de' && text.version.name === 'firered',
    ) ?? art.flavor_text_entries.find((text) => text.language.name === 'de')

  return {
    id,
    name: deutsch(art.names, eintrag.name),
    genus:
      art.genera.find((gattung) => gattung.language.name === 'de')?.genus ?? eintrag.genus,
    description: beschreibung?.flavor_text.replace(/[\n\f]/g, ' ') ?? '',
    height: pokemon.height / 10,
    weight: pokemon.weight / 10,
    types: typen.map(({ type }) => type.name),
    stats: werteFuerGeneration(pokemon).map((wert) => ({
      name: WERTE[wert.stat.name] ?? fallbackName(wert.stat.name),
      value: wert.base_stat,
    })),
    strongAgainst: [...starkeTypen].map((type) => ({ type })),
    weaknesses: schwach,
    resistances: resistent,
    immunities: immun,
    moves: attacken,
    evolutions: await evolutionenAufbereiten(kette),
  }
}

function nummer(id: number) {
  return `#${String(id).padStart(3, '0')}`
}

function suchText(text: string) {
  return text
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('♀', ' weiblich')
    .replace('♂', ' maennlich')
}

function TypMarke({ typ, faktor }: { typ: string; faktor?: number }) {
  return (
    <span className={`typ typ--${typ}`}>
      {TYPEN[typ] ?? fallbackName(typ)}
      {faktor !== undefined && faktor !== 1 ? ` ×${faktor}` : ''}
    </span>
  )
}

const ARENEN_FORTSCHRITT = [
  { name: 'Arena 1', cap: '14 / 12', orden: 1 },
  { name: 'Arena 2', cap: '21 / 19', orden: 2 },
  { name: 'Arena 3', cap: '24 / 22', orden: 3 },
  { name: 'Arena 4', cap: '29 / 27', orden: 4 },
  { name: 'Arena 5', cap: '43 / 41', orden: 5 },
  { name: 'Arena 6', cap: '43 / 41', orden: 6 },
  { name: 'Arena 7', cap: '47 / 45', orden: 7 },
  { name: 'Arena 8', cap: '50 / 48', orden: 8 },
  { name: 'Top 4 · Kampf 1', cap: '54 / 52', orden: 8 },
  { name: 'Top 4 · Kampf 2', cap: '56 / 54', orden: 8 },
  { name: 'Top 4 · Kampf 3', cap: '58 / 56', orden: 8 },
  { name: 'Top 4 · Kampf 4', cap: '60 / 58', orden: 8 },
  { name: 'Champ', cap: '63 / 61', orden: 8 },
] as const

const ORDEN_NAMEN = ['Felsorden', 'Quellorden', 'Donnerorden', 'Farborden', 'Seelenorden', 'Sumpforden', 'Vulkanorden', 'Erdorden']
const LIGA_NAMEN = ['Top 4 · Eis', 'Top 4 · Kampf', 'Top 4 · Geist', 'Top 4 · Drache', 'Champ']

function OrdenSymbol({ index }: { index: number }) {
  if (index === 0) return <svg viewBox="0 0 64 64" aria-hidden="true"><polygon points="13,16 25,7 46,10 56,25 49,49 28,57 8,43 8,25" fill="#85898d" stroke="#c6c9cc" strokeWidth="3" /><path d="M18 20 30 13 46 17 49 29 42 45 27 50 15 39Z" fill="#aeb2b5" /></svg>
  if (index === 1) return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5C25 18 12 29 12 42c0 12 9 18 20 18s20-6 20-18C52 29 39 18 32 5Z" fill="#309bd1" stroke="#83d6ef" strokeWidth="3" /><path d="M25 23c-5 8-8 13-8 19 0 5 3 9 7 11" fill="none" stroke="#d8f6ff" strokeWidth="4" strokeLinecap="round" /></svg>
  if (index === 2) return <svg viewBox="0 0 64 64" aria-hidden="true"><polygon points="32,3 38,17 52,9 48,24 62,29 49,37 55,53 39,46 32,61 25,46 9,53 15,37 2,29 16,24 12,9 26,17" fill="#f4b323" stroke="#ffe17a" strokeWidth="2" /><circle cx="32" cy="30" r="9" fill="#ffd75d" /></svg>
  if (index === 3) return <svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#fff" strokeWidth="1.5"><circle cx="32" cy="13" r="11" fill="#ed5555" /><circle cx="45.5" cy="18.5" r="11" fill="#f59b35" /><circle cx="51" cy="32" r="11" fill="#f1d64b" /><circle cx="45.5" cy="45.5" r="11" fill="#5abb65" /><circle cx="32" cy="51" r="11" fill="#43a9cf" /><circle cx="18.5" cy="45.5" r="11" fill="#5c70cf" /><circle cx="13" cy="32" r="11" fill="#9b5bc4" /><circle cx="18.5" cy="18.5" r="11" fill="#df65a6" /></g><circle cx="32" cy="32" r="9" fill="#fff3b0" /></svg>
  if (index === 4) return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 57C25 48 9 40 9 24 9 11 25 7 32 19 39 7 55 11 55 24c0 16-16 24-23 33Z" fill="#e468a4" stroke="#ffb6d7" strokeWidth="3" /><path d="M20 21c4-6 9-4 12 1" fill="none" stroke="#ffd7e9" strokeWidth="4" strokeLinecap="round" /></svg>
  if (index === 5) return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="25" fill="#d9473f" stroke="#ff9a66" strokeWidth="3" /><circle cx="32" cy="32" r="17" fill="#f0b833" /><circle cx="32" cy="32" r="8" fill="#ffe58b" /><path d="M32 10v44M10 32h44" stroke="#c53635" strokeWidth="2" opacity=".55" /></svg>
  if (index === 6) return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 55 22 25l10 9L42 8l14 47Z" fill="#d64b32" stroke="#ff9870" strokeWidth="3" strokeLinejoin="round" /><path d="m22 25 10 9L42 8l-6 31 10 16H18l9-17Z" fill="#f07735" /><path d="M29 47c3-7 7-9 11-15 0 9 7 11 5 19H27Z" fill="#ffd259" /></svg>
  return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M11 54C13 27 30 8 55 8c0 26-15 45-44 46Z" fill="#43a66a" stroke="#9bd89b" strokeWidth="3" /><path d="M14 51C27 39 38 28 51 12M26 41l-1-14M35 32l14-1" fill="none" stroke="#d8f2b0" strokeWidth="3" strokeLinecap="round" /></svg>
}

function LigaSymbol({ index }: { index: number }) {
  if (index === 0) return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#367fae" stroke="#9ee8f4" strokeWidth="3" /><g stroke="#e5fbff" strokeWidth="4" strokeLinecap="round"><path d="M32 13v38M15.5 22.5l33 19M15.5 41.5l33-19" /><path d="m32 13-5 6m5-6 5 6m-5 32-5-6m5 6 5-6M15.5 22.5l8 1m-8-1 3 7m30 12-8-1m8 1-3-7M15.5 41.5l8-1m-8 1 3-7m30-12-8 1m8-1-3 7" strokeWidth="2.5" /></g></svg>
  if (index === 1) return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#a54535" stroke="#f0a174" strokeWidth="3" /><path d="M18 32V20c0-5 7-5 7 0v8-12c0-5 7-5 7 0v12-10c0-5 7-5 7 0v10-7c0-5 7-5 7 0v15c0 13-8 19-18 19-8 0-14-6-17-13-2-5 4-8 7-3l5 6V32Z" fill="#f0c3a1" stroke="#6d291f" strokeWidth="2" strokeLinejoin="round" /></svg>
  if (index === 2) return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#654a86" stroke="#bca0de" strokeWidth="3" /><path d="M15 50V31c0-13 7-22 17-22s17 9 17 22v19l-7-5-5 6-6-6-6 6-5-6Z" fill="#a56cc1" /><path d="M22 29c5-7 15-7 20 0-6 6-14 6-20 0Z" fill="#352745" /><circle cx="27" cy="29" r="2.5" fill="#ffe56b" /><circle cx="37" cy="29" r="2.5" fill="#ffe56b" /></svg>
  if (index === 3) return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#38559b" stroke="#8ab1ed" strokeWidth="3" /><path d="M15 45c3-19 11-29 29-32l-4 9 10 7-9 5 6 10-13-3-7 10Z" fill="#71a6d9" stroke="#d6edff" strokeWidth="2" strokeLinejoin="round" /><path d="m27 27 9-3-4 8 8 3-11 2Z" fill="#263b73" /><circle cx="37" cy="22" r="2" fill="#ffdf5a" /></svg>
  return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#63312f" stroke="#f3c85d" strokeWidth="3" /><path d="m11 22 13 10 8-18 8 18 13-10-5 27H16Z" fill="#f0b52e" stroke="#ffe58b" strokeWidth="3" strokeLinejoin="round" /><path d="M18 42h28" stroke="#a85f20" strokeWidth="4" /><circle cx="32" cy="14" r="4" fill="#f46255" /><circle cx="11" cy="22" r="3" fill="#55a7e6" /><circle cx="53" cy="22" r="3" fill="#55a7e6" /></svg>
}

function Startseite({
  pokedexOeffnen,
  teamplanerOeffnen,
  kampfberaterOeffnen,
}: {
  pokedexOeffnen: () => void
  teamplanerOeffnen: () => void
  kampfberaterOeffnen: () => void
}) {
  const [fortschritt, setFortschritt] = useState<number | null>(() => {
    const gespeichert = localStorage.getItem('feuerrot-arenen-fortschritt')
    if (gespeichert === null) return null
    const wert = Number(gespeichert)
    return Number.isInteger(wert) && wert >= 0 && wert < ARENEN_FORTSCHRITT.length ? wert : null
  })

  useEffect(() => {
    if (fortschritt === null) localStorage.removeItem('feuerrot-arenen-fortschritt')
    else localStorage.setItem('feuerrot-arenen-fortschritt', String(fortschritt))
  }, [fortschritt])

  const aktuellerAbschnitt = fortschritt === null ? null : ARENEN_FORTSCHRITT[fortschritt]
  const ligaFortschritt = fortschritt === null ? 0 : Math.max(0, fortschritt - 7)
  const bereiche = [
    {
      titel: 'Pokédex',
      text: 'Alle 386 Pokémon mit Feuerrot-Daten',
      symbol: '◉',
      aktiv: true,
      aktion: pokedexOeffnen,
    },
    {
      titel: 'Teamplaner',
      text: 'Plane zwei Teams und verbinde Pokémon-Paare',
      symbol: '♟',
      aktiv: true,
      aktion: teamplanerOeffnen,
    },
    {
      titel: 'Kampfberater',
      text: 'Finde Pokémon und Attacke für den nächsten Kampf',
      symbol: '⚔',
      aktiv: true,
      aktion: kampfberaterOeffnen,
    },
    { titel: 'Arenen', text: 'Orden, Leiter und empfohlene Typen', symbol: '◆' },
    { titel: 'Orte', text: 'Routen, Städte und wichtige Fundorte', symbol: '⌖' },
    { titel: 'Items', text: 'Fundorte und Wirkung wichtiger Items', symbol: '▣' },
  ]

  return (
    <main className="startseite">
      <section className="held">
        <div className="held__inhalt">
          <span className="edition">GENERATION III · FEUERROT</span>
          <h1>Dein Begleiter für Kanto</h1>
          <p>
            Plane dein Abenteuer, durchsuche den Nationalen Pokédex und behalte deinen
            Fortschritt an einem Ort.
          </p>
        </div>
        <div className="held__ball" aria-hidden="true">
          <span />
        </div>
      </section>

      <section className="bereich-auswahl" aria-labelledby="bereiche-titel">
        <div className="abschnitt-kopf">
          <div>
            <span className="ueberzeile">ABENTEUER-WERKZEUGE</span>
            <h2 id="bereiche-titel">Wähle einen Bereich</h2>
          </div>
          <span className="status"><i /> 3 von 6 verfügbar</span>
        </div>

        <section className="arenen-fortschritt" aria-label="Arenen-Fortschritt und Level-Caps">
          <div className="orden-reihe">
            {ORDEN_NAMEN.map((name, index) => {
              const erhalten = index < (aktuellerAbschnitt?.orden ?? 0)
              return (
                <div className={`fortschritt-symbol orden ${erhalten ? 'fortschritt-symbol--erhalten' : ''}`} key={name} title={name}>
                  <OrdenSymbol index={index} />
                  <small>{index + 1}</small>
                  <span>{name}</span>
                </div>
              )
            })}
            {LIGA_NAMEN.map((name, index) => {
              const geschafft = index < ligaFortschritt
              return (
                <div className={`fortschritt-symbol liga-symbol ${geschafft ? 'fortschritt-symbol--erhalten' : ''}`} key={name} title={name}>
                  <LigaSymbol index={index} />
                  <small>{index < 4 ? `T${index + 1}` : 'C'}</small>
                  <span>{name}</span>
                </div>
              )
            })}
          </div>
          <div className="arena-auswahl">
            <label htmlFor="arena-fortschritt">Aktueller Abschnitt</label>
            <div>
              <select
                id="arena-fortschritt"
                value={fortschritt ?? ''}
                onChange={(event) => setFortschritt(event.target.value === '' ? null : Number(event.target.value))}
              >
                <option value="">Arena oder Liga-Kampf wählen …</option>
                {ARENEN_FORTSCHRITT.map((abschnitt, index) => <option value={index} key={abschnitt.name}>{abschnitt.name}</option>)}
              </select>
              <span className="level-cap"><small>LEVEL-CAP</small><strong>{aktuellerAbschnitt?.cap ?? '— / —'}</strong></span>
            </div>
          </div>
          <p>{aktuellerAbschnitt ? `${aktuellerAbschnitt.name} · ${aktuellerAbschnitt.orden} von 8 Orden · ${ligaFortschritt} von 5 Liga-Symbolen` : 'Wähle deinen aktuellen Fortschritt. Noch sind alle Orden und Liga-Symbole grau.'}</p>
        </section>

        <div className="bereich-raster">
          {bereiche.map((bereich, index) => (
            <button
              className={`bereich-karte ${bereich.aktiv ? 'bereich-karte--aktiv' : ''}`}
              key={bereich.titel}
              onClick={bereich.aktion}
              disabled={!bereich.aktiv}
            >
              <span className="bereich-karte__nummer">0{index + 1}</span>
              <span className="bereich-karte__symbol" aria-hidden="true">{bereich.symbol}</span>
              <strong>{bereich.titel}</strong>
              <span>{bereich.text}</span>
              <em>{bereich.aktiv ? 'Öffnen →' : 'Demnächst'}</em>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function PokedexKarte({ pokemon, oeffnen }: { pokemon: PokedexEntry; oeffnen: () => void }) {
  return (
    <button className="pokemon-karte" onClick={oeffnen} aria-label={`${pokemon.name} öffnen`}>
      <span className="pokemon-karte__nummer">{nummer(pokemon.id)}</span>
      <div className="pokemon-karte__bild">
        <img src={BILD(pokemon.id)} alt={pokemon.name} loading="lazy" />
      </div>
      <strong>{pokemon.name}</strong>
      <span>{pokemon.genus}</span>
      <em>Details ansehen</em>
    </button>
  )
}

function MatchupListe({ titel, eintraege }: { titel: string; eintraege: Matchup[] }) {
  return (
    <div className="matchup-gruppe">
      <h4>{titel}</h4>
      <div className="typen-liste">
        {eintraege.length ? (
          eintraege.map((eintrag) => (
            <TypMarke key={eintrag.type} typ={eintrag.type} faktor={eintrag.multiplier} />
          ))
        ) : (
          <span className="keine-angabe">Keine</span>
        )}
      </div>
    </div>
  )
}

function DetailFenster({ id, schliessen }: { id: number; schliessen: () => void }) {
  const [details, setDetails] = useState<PokemonDetails | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    let aktiv = true
    setDetails(null)
    setFehler('')
    detailsLaden(id)
      .then((daten) => aktiv && setDetails(daten))
      .catch((error: Error) => aktiv && setFehler(error.message))
    return () => {
      aktiv = false
    }
  }, [id])

  useEffect(() => {
    const taste = (event: KeyboardEvent) => event.key === 'Escape' && schliessen()
    window.addEventListener('keydown', taste)
    document.body.classList.add('modal-offen')
    return () => {
      window.removeEventListener('keydown', taste)
      document.body.classList.remove('modal-offen')
    }
  }, [schliessen])

  return (
    <div className="modal-hintergrund" role="presentation" onMouseDown={schliessen}>
      <section
        className="detailfenster"
        role="dialog"
        aria-modal="true"
        aria-label="Pokémon-Details"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-schliessen" onClick={schliessen} aria-label="Details schließen">×</button>

        {!details && !fehler && (
          <div className="laden" aria-live="polite">
            <span className="ladeball" />
            <strong>Pokédex-Daten werden geladen …</strong>
            <p>Attacken und Entwicklungsdaten werden für Feuerrot zusammengestellt.</p>
          </div>
        )}

        {fehler && (
          <div className="laden laden--fehler">
            <strong>Das hat leider nicht funktioniert.</strong>
            <p>{fehler}</p>
            <button onClick={schliessen}>Zurück zum Pokédex</button>
          </div>
        )}

        {details && (
          <>
            <header className="detail-kopf">
              <div className="detail-kopf__bild">
                <span>{nummer(details.id)}</span>
                <img src={BILD(details.id)} alt={details.name} />
              </div>
              <div className="detail-kopf__text">
                <span className="ueberzeile">{details.genus}</span>
                <h2>{details.name}</h2>
                <div className="typen-liste">
                  {details.types.map((typ) => <TypMarke key={typ} typ={typ} />)}
                </div>
                <p>{details.description}</p>
                <dl className="koerperdaten">
                  <div><dt>Größe</dt><dd>{details.height.toLocaleString('de-DE')} m</dd></div>
                  <div><dt>Gewicht</dt><dd>{details.weight.toLocaleString('de-DE')} kg</dd></div>
                </dl>
              </div>
            </header>

            <div className="detail-inhalt">
              <section className="detail-abschnitt">
                <div className="detail-abschnitt__titel">
                  <span>01</span><div><small>KAMPFDATEN</small><h3>Basiswerte</h3></div>
                </div>
                <div className="werte-liste">
                  {details.stats.map((wert) => (
                    <div className="wert" key={wert.name}>
                      <span>{wert.name}</span>
                      <div><i style={{ width: `${Math.min(100, (wert.value / 160) * 100)}%` }} /></div>
                      <strong>{wert.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-abschnitt">
                <div className="detail-abschnitt__titel">
                  <span>02</span><div><small>TYPENLEHRE · GENERATION III</small><h3>Stärken und Schwächen</h3></div>
                </div>
                <div className="matchup-raster">
                  <MatchupListe titel="Stark gegen" eintraege={details.strongAgainst} />
                  <MatchupListe titel="Schwach gegen" eintraege={details.weaknesses} />
                  <MatchupListe titel="Widersteht" eintraege={details.resistances} />
                  <MatchupListe titel="Immun gegen" eintraege={details.immunities} />
                </div>
              </section>

              <section className="detail-abschnitt">
                <div className="detail-abschnitt__titel">
                  <span>03</span><div><small>FEUERROT / BLATTGRÜN</small><h3>Attacken durch Levelaufstieg</h3></div>
                </div>
                {details.moves.length ? (
                  <div className="attacken-tabelle">
                    <div className="attacken-zeile attacken-zeile--kopf">
                      <span>Level</span><span>Attacke</span><span>Typ</span><span>Stärke</span><span>Gen.</span>
                    </div>
                    {details.moves.map((attacke) => (
                      <div className="attacken-zeile" key={`${attacke.name}-${attacke.level}`}>
                        <strong>{attacke.level === 0 ? 'Start' : attacke.level}</strong>
                        <span>{attacke.name}</span>
                        <TypMarke typ={attacke.type} />
                        <span>{attacke.power ?? '—'}</span>
                        <span>{attacke.accuracy ? `${attacke.accuracy} %` : '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hinweis">In Feuerrot/Blattgrün sind keine Level-Attacken hinterlegt.</p>
                )}
              </section>

              <section className="detail-abschnitt">
                <div className="detail-abschnitt__titel">
                  <span>04</span><div><small>ENTWICKLUNGSREIHE</small><h3>Wann entwickelt es sich?</h3></div>
                </div>
                {details.evolutions.length ? (
                  <div className="entwicklung-liste">
                    {details.evolutions.map((schritt) => (
                      <div className="entwicklung" key={`${schritt.fromId}-${schritt.toId}`}>
                        <div><img src={BILD(schritt.fromId)} alt={POKEMON[schritt.fromId - 1]?.name} /><strong>{POKEMON[schritt.fromId - 1]?.name}</strong></div>
                        <span><b>→</b><small>{schritt.condition}</small></span>
                        <div><img src={BILD(schritt.toId)} alt={POKEMON[schritt.toId - 1]?.name} /><strong>{POKEMON[schritt.toId - 1]?.name}</strong></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hinweis">Dieses Pokémon besitzt innerhalb der ersten drei Generationen keine Entwicklung.</p>
                )}
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

type PokemonPaar = {
  id: string
  links: number
  rechts: number
  aktiv: boolean
  slot: number | null
  levelLinks: number
  levelRechts: number
  itemLinks: number | null
  itemRechts: number | null
  attackenLinks: number[]
  attackenRechts: number[]
}

function PokemonSuche({
  titel,
  farbe,
  ausgewaehlt,
  gesperrt,
  onAuswaehlen,
}: {
  titel: string
  farbe: 'rot' | 'blau'
  ausgewaehlt: number | null
  gesperrt: number[]
  onAuswaehlen: (id: number | null) => void
}) {
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState(false)
  const bereichRef = useRef<HTMLDivElement>(null)
  const pokemon = ausgewaehlt ? POKEMON[ausgewaehlt - 1] : null

  useEffect(() => {
    if (!offen) return
    function ausserhalbSchliessen(event: PointerEvent) {
      if (!bereichRef.current?.contains(event.target as Node)) setOffen(false)
    }
    function mitEscapeSchliessen(event: KeyboardEvent) {
      if (event.key === 'Escape') setOffen(false)
    }
    document.addEventListener('pointerdown', ausserhalbSchliessen)
    document.addEventListener('keydown', mitEscapeSchliessen)
    return () => {
      document.removeEventListener('pointerdown', ausserhalbSchliessen)
      document.removeEventListener('keydown', mitEscapeSchliessen)
    }
  }, [offen])

  const vorschlaege = useMemo(() => {
    const begriff = suchText(suche.trim().replace(/^#/, ''))
    if (!begriff) return POKEMON.filter((eintrag) => !gesperrt.includes(eintrag.id)).slice(0, 8)
    return POKEMON.filter(
      (eintrag) =>
        !gesperrt.includes(eintrag.id) &&
        (suchText(eintrag.name).includes(begriff) || String(eintrag.id).includes(begriff)),
    ).slice(0, 8)
  }, [gesperrt, suche])

  function waehlen(id: number) {
    onAuswaehlen(id)
    setSuche('')
    setOffen(false)
  }

  return (
    <div ref={bereichRef} className={`paar-suche paar-suche--${farbe}`}>
      <label>{titel}</label>
      {pokemon ? (
        <div className="auswahl-chip">
          <img src={BILD(pokemon.id)} alt={pokemon.name} />
          <span><small>{nummer(pokemon.id)}</small><strong>{pokemon.name}</strong></span>
          <button onClick={() => onAuswaehlen(null)} aria-label={`${pokemon.name} entfernen`}>×</button>
        </div>
      ) : (
        <div className="such-auswahl">
          <input
            type="search"
            value={suche}
            onFocus={() => setOffen(true)}
            onChange={(event) => {
              setSuche(event.target.value)
              setOffen(true)
            }}
            placeholder="Pokémon suchen …"
            aria-label={`Pokémon für ${titel} suchen`}
          />
          {offen && (
            <div className="such-vorschlaege">
              {vorschlaege.length ? vorschlaege.map((eintrag) => (
                <button key={eintrag.id} onClick={() => waehlen(eintrag.id)}>
                  <img src={BILD(eintrag.id)} alt="" loading="lazy" />
                  <span><small>{nummer(eintrag.id)}</small><strong>{eintrag.name}</strong></span>
                </button>
              )) : <p>Kein freies Pokémon gefunden.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LevelWaehler({ level, onAendern, kompakt = false }: { level: number; onAendern: (level: number) => void; kompakt?: boolean }) {
  const [offen, setOffen] = useState(false)
  const bereichRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offen) return

    function ausserhalbSchliessen(event: PointerEvent) {
      if (!bereichRef.current?.contains(event.target as Node)) setOffen(false)
    }

    function mitEscapeSchliessen(event: KeyboardEvent) {
      if (event.key === 'Escape') setOffen(false)
    }

    document.addEventListener('pointerdown', ausserhalbSchliessen)
    document.addEventListener('keydown', mitEscapeSchliessen)
    return () => {
      document.removeEventListener('pointerdown', ausserhalbSchliessen)
      document.removeEventListener('keydown', mitEscapeSchliessen)
    }
  }, [offen])

  return (
    <div ref={bereichRef} className={`level-waehler ${kompakt ? 'level-waehler--kompakt' : ''} ${offen ? 'level-waehler--offen' : ''}`}>
      <button className="level-waehler__wert" onClick={() => setOffen((aktuell) => !aktuell)} aria-expanded={offen}>
        <small>Level</small><strong>{level}</strong><span>⌄</span>
      </button>
      {offen && (
        <div className="level-waehler__liste" role="listbox" aria-label="Level auswählen">
          {Array.from({ length: 100 }, (_, index) => index + 1).map((wert) => (
            <button
              key={wert}
              className={wert === level ? 'aktiv' : ''}
              onClick={() => { onAendern(wert); setOffen(false) }}
              role="option"
              aria-selected={wert === level}
            >
              {wert}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemAuswahl({ itemId, pokemonName, onAendern }: { itemId: number | null; pokemonName: string; onAendern: (id: number | null) => void }) {
  const [offen, setOffen] = useState(false)
  const [suche, setSuche] = useState('')
  const bereichRef = useRef<HTMLDivElement>(null)
  const item = itemId ? ITEMS.find((eintrag) => eintrag.id === itemId) : null
  const begriff = suchText(suche.trim())
  const ergebnisse = (begriff
    ? ITEMS.filter((eintrag) => suchText(eintrag.name).includes(begriff) || suchText(eintrag.identifier).includes(begriff))
    : ITEMS
  ).slice(0, 40)

  useEffect(() => {
    if (!offen) return
    function ausserhalbSchliessen(event: PointerEvent) {
      if (!bereichRef.current?.contains(event.target as Node)) setOffen(false)
    }
    function mitEscapeSchliessen(event: KeyboardEvent) {
      if (event.key === 'Escape') setOffen(false)
    }
    document.addEventListener('pointerdown', ausserhalbSchliessen)
    document.addEventListener('keydown', mitEscapeSchliessen)
    return () => {
      document.removeEventListener('pointerdown', ausserhalbSchliessen)
      document.removeEventListener('keydown', mitEscapeSchliessen)
    }
  }, [offen])

  return (
    <div ref={bereichRef} className="item-auswahl">
      <button className={`item-auswahl__wert ${item ? 'item-auswahl__wert--belegt' : ''}`} onClick={() => setOffen((aktuell) => !aktuell)} aria-expanded={offen} title={item?.name ?? 'Item auswählen'}>
        {item ? <img src={ITEM_BILD(item.identifier)} alt="" /> : <span>+</span>}
        <small>{item?.name ?? 'Item'}</small>
      </button>
      {offen && (
        <div className="item-auswahl__fenster">
          <header><strong>Item für {pokemonName}</strong><button onClick={() => setOffen(false)} aria-label="Item-Auswahl schließen">×</button></header>
          <input type="search" value={suche} onChange={(event) => setSuche(event.target.value)} placeholder="Item suchen …" autoFocus />
          <div>
            <button className="item-ergebnis item-ergebnis--leer" onClick={() => { onAendern(null); setOffen(false); setSuche('') }}><span>×</span><b>Kein Item</b></button>
            {ergebnisse.map((eintrag) => (
              <button className={`item-ergebnis ${eintrag.id === itemId ? 'aktiv' : ''}`} key={eintrag.id} onClick={() => { onAendern(eintrag.id); setOffen(false); setSuche('') }}>
                <img src={ITEM_BILD(eintrag.identifier)} alt="" loading="lazy" /><b>{eintrag.name}</b>{eintrag.id === itemId && <i>✓</i>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeamKurzinfo({
  id,
  level,
  attacken,
  onAttackenAendern,
}: {
  id: number
  level: number
  attacken: number[]
  onAttackenAendern: (ids: number[]) => void
}) {
  const [details, setDetails] = useState<PokemonDetails | null>(null)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    let aktiv = true
    setDetails(null)
    setFehler('')
    detailsLaden(id)
      .then((daten) => aktiv && setDetails(daten))
      .catch((error: Error) => aktiv && setFehler(error.message))
    return () => { aktiv = false }
  }, [id])

  if (fehler) return <div className="kurzinfo-status">{fehler}</div>
  if (!details) return <div className="kurzinfo-status"><span className="ladeball" /> Daten werden geladen …</div>

  return (
    <div className="team-kurzinfo">
      <div className="team-kurzinfo__kopf">
        <img src={BILD(details.id)} alt={details.name} />
        <div>
          <small>{nummer(details.id)} · {details.genus}</small>
          <h4>{details.name}</h4>
          <div className="typen-liste">{details.types.map((typ) => <TypMarke key={typ} typ={typ} />)}</div>
        </div>
      </div>
      <div className="team-kurzinfo__matchups">
        <MatchupListe titel="Stark gegen" eintraege={details.strongAgainst} />
        <MatchupListe titel="Schwach gegen" eintraege={details.weaknesses} />
      </div>
      <div className="kurz-attacken">
        <h4>Alle Level-Attacken · aktuelles Level {level}</h4>
        <div>
          {details.moves.length ? details.moves.map((attacke) => (
            <span className={attacke.level <= level ? 'attacke-verfuegbar' : 'attacke-spaeter'} key={`${attacke.name}-${attacke.level}`}>
              <b>{attacke.level === 0 ? 'Start' : `Lv. ${attacke.level}`}</b>
              {attacke.name}
              <i>{attacke.level <= level ? '✓' : 'später'}</i>
            </span>
          )) : <em>Keine Level-Attacken hinterlegt.</em>}
        </div>
      </div>
      <div className="team-attacken-editor">
        <h4>Attackenset für den Kampfberater speichern</h4>
        <p>Wähle eine bis vier echte Attacken. Die Auswahl bleibt auch auf der Ersatzbank gespeichert.</p>
        <AttackenAuswahl pokemon={details} level={level} ausgewaehlt={attacken} onAendern={onAttackenAendern} />
      </div>
    </div>
  )
}

function TeamPokemon({
  id,
  level,
  itemId,
  seite,
  aktiv,
  onOeffnen,
  onLevelAendern,
  onItemAendern,
}: {
  id: number
  level: number
  itemId: number | null
  seite: 'rot' | 'blau'
  aktiv: boolean
  onOeffnen: () => void
  onLevelAendern: (level: number) => void
  onItemAendern: (id: number | null) => void
}) {
  const pokemon = POKEMON[id - 1]
  return (
    <div className={`team-pokemon team-pokemon--${seite} ${aktiv ? 'team-pokemon--aktiv' : ''}`}>
      <button className="team-pokemon__info" onClick={onOeffnen}>
        <img src={BILD(id)} alt={pokemon.name} />
        <span><small>{nummer(id)}</small><strong>{pokemon.name}</strong><em>{aktiv ? 'Planung schließen' : 'Attacken planen'}</em></span>
      </button>
      <div className="team-pokemon__steuerung">
        <LevelWaehler level={level} onAendern={onLevelAendern} kompakt />
        <ItemAuswahl itemId={itemId} pokemonName={pokemon.name} onAendern={onItemAendern} />
      </div>
    </div>
  )
}

function PaarZeile({
  paar,
  index,
  offen,
  onOeffnen,
  onEntfernen,
  onBank,
  onSlotWechseln,
  onLevelAendern,
  onItemAendern,
  onAttackenAendern,
}: {
  paar: PokemonPaar | null
  index: number
  offen: { paarId: string; pokemonId: number } | null
  onOeffnen: (paarId: string, pokemonId: number) => void
  onEntfernen: (id: string) => void
  onBank: (id: string) => void
  onSlotWechseln: (id: string, slot: number) => void
  onLevelAendern: (id: string, seite: 'links' | 'rechts', level: number) => void
  onItemAendern: (id: string, seite: 'links' | 'rechts', itemId: number | null) => void
  onAttackenAendern: (id: string, seite: 'links' | 'rechts', attacken: number[]) => void
}) {
  if (!paar) {
    return (
      <div className="paar-zeile paar-zeile--leer">
        <div><span>+</span><small>Freier Platz</small></div>
        <span className="paar-verbindung"><i /><b>{index + 1}</b><i /></span>
        <div><span>+</span><small>Freier Platz</small></div>
      </div>
    )
  }

  const offeneId = offen?.paarId === paar.id ? offen.pokemonId : null
  return (
    <div className="paar-block">
      <div className="paar-zeile">
        <TeamPokemon id={paar.links} level={paar.levelLinks} itemId={paar.itemLinks} seite="rot" aktiv={offeneId === paar.links} onOeffnen={() => onOeffnen(paar.id, paar.links)} onLevelAendern={(level) => onLevelAendern(paar.id, 'links', level)} onItemAendern={(itemId) => onItemAendern(paar.id, 'links', itemId)} />
        <span className="paar-verbindung">
          <i />
          <select
            value={index}
            onChange={(event) => onSlotWechseln(paar.id, Number(event.target.value))}
            aria-label={`Slot für Paar ${index + 1} auswählen`}
          >
            {Array.from({ length: 6 }, (_, slot) => (
              <option key={slot} value={slot}>Slot {slot + 1}</option>
            ))}
          </select>
          <i />
        </span>
        <TeamPokemon id={paar.rechts} level={paar.levelRechts} itemId={paar.itemRechts} seite="blau" aktiv={offeneId === paar.rechts} onOeffnen={() => onOeffnen(paar.id, paar.rechts)} onLevelAendern={(level) => onLevelAendern(paar.id, 'rechts', level)} onItemAendern={(itemId) => onItemAendern(paar.id, 'rechts', itemId)} />
        <button className="paar-entfernen" onClick={() => onEntfernen(paar.id)} aria-label="Paar entfernen">×</button>
        <button className="paar-auf-bank" onClick={() => onBank(paar.id)}>↓ Auf Bank</button>
      </div>
      {offeneId && (
        <TeamKurzinfo
          id={offeneId}
          level={offeneId === paar.links ? paar.levelLinks : paar.levelRechts}
          attacken={offeneId === paar.links ? paar.attackenLinks : paar.attackenRechts}
          onAttackenAendern={(attacken) => onAttackenAendern(paar.id, offeneId === paar.links ? 'links' : 'rechts', attacken)}
        />
      )}
    </div>
  )
}

function Teamplaner({ zurueck }: { zurueck: () => void }) {
  const [paare, setPaare] = useState<PokemonPaar[]>(() => {
    try {
      const gespeichert = JSON.parse(localStorage.getItem('feuerrot-teamplaner-paare') ?? '[]') as Partial<PokemonPaar>[]
      return gespeichert.map((paar, index) => ({
        id: paar.id ?? `${Date.now()}-${index}`,
        links: paar.links ?? 1,
        rechts: paar.rechts ?? 4,
        aktiv: paar.aktiv ?? index < 6,
        slot: paar.slot !== undefined ? paar.slot : index < 6 ? index : null,
        levelLinks: Math.max(1, Math.min(100, paar.levelLinks ?? 50)),
        levelRechts: Math.max(1, Math.min(100, paar.levelRechts ?? 50)),
        itemLinks: paar.itemLinks ?? null,
        itemRechts: paar.itemRechts ?? null,
        attackenLinks: paar.attackenLinks ?? [],
        attackenRechts: paar.attackenRechts ?? [],
      }))
    } catch {
      return []
    }
  })
  const [links, setLinks] = useState<number | null>(null)
  const [rechts, setRechts] = useState<number | null>(null)
  const [offen, setOffen] = useState<{ paarId: string; pokemonId: number } | null>(null)
  const [tauschZiele, setTauschZiele] = useState<Record<string, number>>({})
  const [teamNamen, setTeamNamen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('feuerrot-teamplaner-namen') ?? '{"rot":"Team Rot","blau":"Team Blau"}') as { rot: string; blau: string }
    } catch {
      return { rot: 'Team Rot', blau: 'Team Blau' }
    }
  })

  useEffect(() => {
    localStorage.setItem('feuerrot-teamplaner-paare', JSON.stringify(paare))
  }, [paare])

  useEffect(() => {
    localStorage.setItem('feuerrot-teamplaner-namen', JSON.stringify(teamNamen))
  }, [teamNamen])

  const teamRot = paare.map((paar) => paar.links)
  const teamBlau = paare.map((paar) => paar.rechts)
  const aktivePaare = paare.filter((paar) => paar.aktiv).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  const weiterePaare = paare.filter((paar) => !paar.aktiv)
  const freieSlots = Array.from({ length: 6 }, (_, index) => index).filter(
    (slot) => !aktivePaare.some((paar) => paar.slot === slot),
  )
  const nameRot = teamNamen.rot.trim() || 'Team Rot'
  const nameBlau = teamNamen.blau.trim() || 'Team Blau'
  const hatAenderungen = paare.length > 0 || nameRot !== 'Team Rot' || nameBlau !== 'Team Blau'

  function paarHinzufuegen() {
    if (!links || !rechts) return
    const freierSlot = freieSlots[0]
    setPaare((aktuell) => [...aktuell, {
      id: `${Date.now()}-${links}-${rechts}`,
      links,
      rechts,
      aktiv: freierSlot !== undefined,
      slot: freierSlot ?? null,
      levelLinks: 50,
      levelRechts: 50,
      itemLinks: null,
      itemRechts: null,
      attackenLinks: [],
      attackenRechts: [],
    }])
    setLinks(null)
    setRechts(null)
  }

  function kurzinfoOeffnen(paarId: string, pokemonId: number) {
    setOffen((aktuell) =>
      aktuell?.paarId === paarId && aktuell.pokemonId === pokemonId ? null : { paarId, pokemonId },
    )
  }

  function entfernen(id: string) {
    setPaare((aktuell) => aktuell.filter((paar) => paar.id !== id))
    if (offen?.paarId === id) setOffen(null)
  }

  function aufBank(id: string) {
    setPaare((aktuell) => aktuell.map((paar) =>
      paar.id === id ? { ...paar, aktiv: false, slot: null } : paar,
    ))
    if (offen?.paarId === id) setOffen(null)
  }

  function einwechseln(id: string, zielSlot: number) {
    setPaare((aktuell) => aktuell.map((paar) => {
      if (paar.id === id) return { ...paar, aktiv: true, slot: zielSlot }
      if (paar.aktiv && paar.slot === zielSlot) return { ...paar, aktiv: false, slot: null }
      return paar
    }))
    setOffen(null)
  }

  function slotWechseln(id: string, zielSlot: number) {
    const quellSlot = paare.find((paar) => paar.id === id)?.slot
    if (quellSlot === null || quellSlot === undefined || quellSlot === zielSlot) return

    setPaare((aktuell) => aktuell.map((paar) => {
      if (paar.id === id) return { ...paar, slot: zielSlot }
      if (paar.aktiv && paar.slot === zielSlot) return { ...paar, slot: quellSlot }
      return paar
    }))
  }

  function levelAendern(id: string, seite: 'links' | 'rechts', level: number) {
    setPaare((aktuell) => aktuell.map((paar) => {
      if (paar.id !== id) return paar
      return seite === 'links' ? { ...paar, levelLinks: level } : { ...paar, levelRechts: level }
    }))
  }

  function itemAendern(id: string, seite: 'links' | 'rechts', itemId: number | null) {
    setPaare((aktuell) => aktuell.map((paar) => {
      if (paar.id !== id) return paar
      return seite === 'links' ? { ...paar, itemLinks: itemId } : { ...paar, itemRechts: itemId }
    }))
  }

  function attackenAendern(id: string, seite: 'links' | 'rechts', attacken: number[]) {
    setPaare((aktuell) => aktuell.map((paar) => {
      if (paar.id !== id) return paar
      return seite === 'links' ? { ...paar, attackenLinks: attacken } : { ...paar, attackenRechts: attacken }
    }))
  }

  function zuruecksetzen() {
    if (!hatAenderungen || window.confirm('Möchtest du den gesamten Teamplaner zurücksetzen?')) {
      setPaare([])
      setLinks(null)
      setRechts(null)
      setOffen(null)
      setTauschZiele({})
      setTeamNamen({ rot: 'Team Rot', blau: 'Team Blau' })
    }
  }

  const hauptPaare = Array.from(
    { length: 6 },
    (_, index) => aktivePaare.find((paar) => paar.slot === index) ?? null,
  )

  return (
    <main className="teamplaner-seite">
      <header className="teamplaner-kopf">
        <button className="zurueck" onClick={zurueck}>← Startseite</button>
        <span className="edition">TEAMPLANER · ZWEI TEAMS</span>
        <div className="teamplaner-kopf__zeile">
          <div><h1>Pokémon-Paare planen</h1><p>Verbinde jeweils ein Pokémon aus {nameRot} mit einem Pokémon aus {nameBlau}.</p></div>
          <button className="reset-knopf" onClick={zuruecksetzen} disabled={!hatAenderungen}>↻ Alles zurücksetzen</button>
        </div>
      </header>

      <section className="teamplaner-inhalt">
        <div className="paar-erstellen">
          <div className="paar-erstellen__kopf">
            <span className="ueberzeile">NEUES PAAR</span>
            <h2>Zwei Pokémon verbinden</h2>
            <p>Suche auf jeder Seite ein Pokémon und füge beide als Paar hinzu.</p>
          </div>
          <div className="paar-erstellen__felder">
            <PokemonSuche titel={nameRot} farbe="rot" ausgewaehlt={links} gesperrt={teamRot} onAuswaehlen={setLinks} />
            <span className="verbindungs-symbol" aria-hidden="true">↔</span>
            <PokemonSuche titel={nameBlau} farbe="blau" ausgewaehlt={rechts} gesperrt={teamBlau} onAuswaehlen={setRechts} />
          </div>
          <button className="paar-hinzufuegen" onClick={paarHinzufuegen} disabled={!links || !rechts}>Paar hinzufügen</button>
        </div>

        <div className="teams-kopf">
          <div>
            <span className="team-punkt team-punkt--rot" />
            <input
              className="teamname teamname--rot"
              value={teamNamen.rot}
              maxLength={24}
              onChange={(event) => setTeamNamen((aktuell) => ({ ...aktuell, rot: event.target.value }))}
              onBlur={() => !teamNamen.rot.trim() && setTeamNamen((aktuell) => ({ ...aktuell, rot: 'Team Rot' }))}
              aria-label="Name des roten Teams"
            />
            <small>{aktivePaare.length} / 6</small>
          </div>
          <span>VERBUNDENE SLOTS</span>
          <div>
            <small>{aktivePaare.length} / 6</small>
            <input
              className="teamname teamname--blau"
              value={teamNamen.blau}
              maxLength={24}
              onChange={(event) => setTeamNamen((aktuell) => ({ ...aktuell, blau: event.target.value }))}
              onBlur={() => !teamNamen.blau.trim() && setTeamNamen((aktuell) => ({ ...aktuell, blau: 'Team Blau' }))}
              aria-label="Name des blauen Teams"
            />
            <span className="team-punkt team-punkt--blau" />
          </div>
        </div>

        <div className="paar-liste">
          {hauptPaare.map((paar, index) => (
            <PaarZeile key={paar?.id ?? `leer-${index}`} paar={paar} index={index} offen={offen} onOeffnen={kurzinfoOeffnen} onEntfernen={entfernen} onBank={aufBank} onSlotWechseln={slotWechseln} onLevelAendern={levelAendern} onItemAendern={itemAendern} onAttackenAendern={attackenAendern} />
          ))}
        </div>

        {weiterePaare.length > 0 && (
          <section className="weitere-paare">
            <div><span className="ueberzeile">ERSATZBANK</span><h2>Weitere Pokémon-Paare</h2><p>Diese Paare liegen außerhalb der sechs Hauptplätze.</p></div>
            <div className="weitere-paare__raster">
              {weiterePaare.map((paar, index) => (
                <div className="mini-paar" key={paar.id}>
                  <button onClick={() => kurzinfoOeffnen(paar.id, paar.links)}><img src={BILD(paar.links)} alt={POKEMON[paar.links - 1].name} /><span>{POKEMON[paar.links - 1].name}</span></button>
                  <span>↔ <small>{index + 7}</small></span>
                  <button onClick={() => kurzinfoOeffnen(paar.id, paar.rechts)}><img src={BILD(paar.rechts)} alt={POKEMON[paar.rechts - 1].name} /><span>{POKEMON[paar.rechts - 1].name}</span></button>
                  <button className="mini-paar__entfernen" onClick={() => entfernen(paar.id)} aria-label="Paar entfernen">×</button>
                  <div className="mini-levels">
                    <LevelWaehler level={paar.levelLinks} onAendern={(level) => levelAendern(paar.id, 'links', level)} kompakt />
                    <LevelWaehler level={paar.levelRechts} onAendern={(level) => levelAendern(paar.id, 'rechts', level)} kompakt />
                  </div>
                  <div className="bank-aktion">
                    {freieSlots.length ? (
                      <button onClick={() => einwechseln(paar.id, freieSlots[0])}>↑ In Slot {freieSlots[0] + 1} einwechseln</button>
                    ) : (
                      <>
                        <select
                          aria-label="Aktiven Slot zum Tauschen auswählen"
                          value={tauschZiele[paar.id] ?? 0}
                          onChange={(event) => setTauschZiele((aktuell) => ({ ...aktuell, [paar.id]: Number(event.target.value) }))}
                        >
                          {hauptPaare.map((aktivesPaar, slot) => aktivesPaar && (
                            <option key={aktivesPaar.id} value={slot}>Slot {slot + 1}: {POKEMON[aktivesPaar.links - 1].name} ↔ {POKEMON[aktivesPaar.rechts - 1].name}</option>
                          ))}
                        </select>
                        <button onClick={() => einwechseln(paar.id, tauschZiele[paar.id] ?? 0)}>↔ Mit Slot tauschen</button>
                      </>
                    )}
                  </div>
                  {offen?.paarId === paar.id && (
                    <TeamKurzinfo
                      id={offen.pokemonId}
                      level={offen.pokemonId === paar.links ? paar.levelLinks : paar.levelRechts}
                      attacken={offen.pokemonId === paar.links ? paar.attackenLinks : paar.attackenRechts}
                      onAttackenAendern={(attacken) => attackenAendern(paar.id, offen.pokemonId === paar.links ? 'links' : 'rechts', attacken)}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

type TeamMitglied = { id: number; level: number; slot: number; attacken: number[]; itemId: number | null }
type KampfErgebnis = {
  pokemon: PokemonDetails
  level: number
  slot: number
  attacke: LevelMove | null
  effektivitaet: number
  score: number
  gefahr: number
}

const SPEZIAL_TYPEN = new Set(['fire', 'water', 'grass', 'electric', 'ice', 'psychic', 'dragon', 'dark'])

function gespeichertePaareLesen() {
  try {
    const gespeichert = JSON.parse(localStorage.getItem('feuerrot-teamplaner-paare') ?? '[]') as Partial<PokemonPaar>[]
    return gespeichert.map((paar, index): PokemonPaar => ({
      id: paar.id ?? `${index}`,
      links: paar.links ?? 1,
      rechts: paar.rechts ?? 4,
      aktiv: paar.aktiv ?? index < 6,
      slot: paar.slot !== undefined ? paar.slot : index < 6 ? index : null,
      levelLinks: Math.max(1, Math.min(100, paar.levelLinks ?? 50)),
      levelRechts: Math.max(1, Math.min(100, paar.levelRechts ?? 50)),
      itemLinks: paar.itemLinks ?? null,
      itemRechts: paar.itemRechts ?? null,
      attackenLinks: paar.attackenLinks ?? [],
      attackenRechts: paar.attackenRechts ?? [],
    }))
  } catch {
    return []
  }
}

function gespeicherteNamenLesen() {
  try {
    return JSON.parse(localStorage.getItem('feuerrot-teamplaner-namen') ?? '{"rot":"Team Rot","blau":"Team Blau"}') as { rot: string; blau: string }
  } catch {
    return { rot: 'Team Rot', blau: 'Team Blau' }
  }
}

function effektivitaetGegen(attackenTyp: string, ziel: PokemonDetails) {
  const immun = ziel.immunities.find((eintrag) => eintrag.type === attackenTyp)
  if (immun) return 0
  const schwach = ziel.weaknesses.find((eintrag) => eintrag.type === attackenTyp)
  if (schwach) return schwach.multiplier ?? 2
  const resistent = ziel.resistances.find((eintrag) => eintrag.type === attackenTyp)
  if (resistent) return resistent.multiplier ?? 0.5
  return 1
}

function basiswert(pokemon: PokemonDetails, name: string) {
  return pokemon.stats.find((wert) => wert.name === name)?.value ?? 80
}

function moveApiAlsAttacke(attacke: MoveApi): LevelMove {
  return {
    id: attacke.id,
    name: deutsch(attacke.names, fallbackName(ATTACKEN.find((eintrag) => eintrag.id === attacke.id)?.identifier ?? 'Attacke')),
    level: 0,
    type: attacke.type.name,
    power: attacke.power,
    accuracy: attacke.accuracy,
  }
}

async function attackenIdsLaden(ids: number[]) {
  return Promise.all(ids.map(async (id) => moveApiAlsAttacke(await laden<MoveApi>(`${API}/move/${id}`))))
}

function kampfWertBerechnen(
  pokemon: PokemonDetails,
  mitglied: TeamMitglied,
  gegner: PokemonDetails,
  gegnerLevel: number,
  attacken: LevelMove[],
): KampfErgebnis {
  const bewerteteAttacken = attacken
    .filter((attacke) => attacke.power !== null && attacke.power > 0)
    .map((attacke) => {
      const effektivitaet = effektivitaetGegen(attacke.type, gegner)
      const stab = pokemon.types.includes(attacke.type) ? 1.5 : 1
      const spezial = SPEZIAL_TYPEN.has(attacke.type)
      const angriff = basiswert(pokemon, spezial ? 'Spezial-Angriff' : 'Angriff')
      const verteidigung = basiswert(gegner, spezial ? 'Spezial-Verteidigung' : 'Verteidigung')
      const genauigkeit = (attacke.accuracy ?? 100) / 100
      const schaden = (attacke.power ?? 0) * effektivitaet * stab * genauigkeit * (angriff / Math.max(1, verteidigung))
      return { attacke, effektivitaet, schaden }
    })
    .sort((a, b) => b.schaden - a.schaden)

  const besteAttacke = bewerteteAttacken[0]
  const gegnerGefahr = Math.max(0.5, ...gegner.types.map((typ) => effektivitaetGegen(typ, pokemon)))
  const levelFaktor = mitglied.level / Math.max(1, gegnerLevel)
  const tempoBonus = 1 + Math.max(-0.15, Math.min(0.15, (basiswert(pokemon, 'Initiative') - basiswert(gegner, 'Initiative')) / 500))
  const score = (besteAttacke?.schaden ?? 0) * levelFaktor * tempoBonus / gegnerGefahr

  return {
    pokemon,
    level: mitglied.level,
    slot: mitglied.slot,
    attacke: besteAttacke?.attacke ?? null,
    effektivitaet: besteAttacke?.effektivitaet ?? 0,
    score,
    gefahr: gegnerGefahr,
  }
}

function TeamVorschau({
  name,
  farbe,
  mitglieder,
  aktiv,
  onAuswaehlen,
}: {
  name: string
  farbe: 'rot' | 'blau'
  mitglieder: TeamMitglied[]
  aktiv: boolean
  onAuswaehlen: () => void
}) {
  return (
    <button className={`berater-team berater-team--${farbe} ${aktiv ? 'berater-team--aktiv' : ''}`} onClick={onAuswaehlen}>
      <header><span className={`team-punkt team-punkt--${farbe}`} /><strong>{name}</strong><em>{aktiv ? 'Ausgewählt' : 'Team wählen'}</em></header>
      <div>
        {Array.from({ length: 6 }, (_, slot) => {
          const mitglied = mitglieder.find((eintrag) => eintrag.slot === slot)
          return mitglied ? (
            <span className="berater-pokemon" key={slot}>
              <img src={BILD(mitglied.id)} alt={POKEMON[mitglied.id - 1].name} />
              {mitglieder.find((eintrag) => eintrag.slot === slot)?.itemId && (() => {
                const item = ITEMS.find((eintrag) => eintrag.id === mitglied.itemId)
                return item ? <img className="berater-pokemon__item" src={ITEM_BILD(item.identifier)} alt={item.name} title={item.name} /> : null
              })()}
              <small>Lv. {mitglied.level}</small>
              <b>{POKEMON[mitglied.id - 1].name}</b>
            </span>
          ) : <span className="berater-pokemon berater-pokemon--leer" key={slot}>Slot {slot + 1}</span>
        })}
      </div>
    </button>
  )
}

function AttackenAuswahl({
  pokemon,
  level,
  ausgewaehlt,
  onAendern,
}: {
  pokemon: PokemonDetails
  level: number
  ausgewaehlt: number[]
  onAendern: (ids: number[]) => void
}) {
  const [suche, setSuche] = useState('')
  const [sucheOffen, setSucheOffen] = useState(false)
  const suchbereichRef = useRef<HTMLDivElement>(null)
  const standardAttacken = pokemon.moves.filter(
    (attacke, index, alle) =>
      attacke.level <= level && alle.findIndex((vergleich) => vergleich.id === attacke.id) === index,
  )
  const begriff = suchText(suche.trim())
  const suchErgebnisse = begriff
    ? ATTACKEN.filter(
        (attacke) =>
          !ausgewaehlt.includes(attacke.id) &&
          (suchText(attacke.name).includes(begriff) || suchText(attacke.identifier).includes(begriff)),
      ).slice(0, 10)
    : []

  useEffect(() => {
    if (!sucheOffen) return
    function ausserhalbSchliessen(event: PointerEvent) {
      if (!suchbereichRef.current?.contains(event.target as Node)) setSucheOffen(false)
    }
    function mitEscapeSchliessen(event: KeyboardEvent) {
      if (event.key === 'Escape') setSucheOffen(false)
    }
    document.addEventListener('pointerdown', ausserhalbSchliessen)
    document.addEventListener('keydown', mitEscapeSchliessen)
    return () => {
      document.removeEventListener('pointerdown', ausserhalbSchliessen)
      document.removeEventListener('keydown', mitEscapeSchliessen)
    }
  }, [sucheOffen])

  function hinzufuegen(id: number) {
    if (ausgewaehlt.includes(id) || ausgewaehlt.length >= 4) return
    onAendern([...ausgewaehlt, id])
    setSuche('')
    setSucheOffen(false)
  }

  return (
    <div className="attacken-auswahl">
      <div className="attacken-auswahl__gewaehlt">
        <h4>Ausgewählte Attacken <span>{ausgewaehlt.length} / 4</span></h4>
        <div>
          {ausgewaehlt.length ? ausgewaehlt.map((id) => {
            const attacke = ATTACKEN.find((eintrag) => eintrag.id === id)
            return (
              <span key={id}>{attacke?.name ?? `Attacke ${id}`}<button onClick={() => onAendern(ausgewaehlt.filter((eintrag) => eintrag !== id))} aria-label="Attacke entfernen">×</button></span>
            )
          }) : <p>Noch keine Attacke ausgewählt. Eine bis vier sind möglich.</p>}
        </div>
      </div>

      <div className="standard-attacken">
        <h4>Bis Level {level} per Levelaufstieg möglich</h4>
        <div>
          {standardAttacken.length ? standardAttacken.map((attacke) => (
            <button
              key={attacke.id}
              className={ausgewaehlt.includes(attacke.id) ? 'ausgewaehlt' : ''}
              onClick={() => ausgewaehlt.includes(attacke.id) ? onAendern(ausgewaehlt.filter((id) => id !== attacke.id)) : hinzufuegen(attacke.id)}
              disabled={!ausgewaehlt.includes(attacke.id) && ausgewaehlt.length >= 4}
            >
              <b>{attacke.level === 0 ? 'Start' : `Lv. ${attacke.level}`}</b>{attacke.name}<i>{ausgewaehlt.includes(attacke.id) ? '✓' : '+'}</i>
            </button>
          )) : <p>Für dieses Level wurde keine Level-Attacke gefunden. Du kannst unten frei suchen.</p>}
        </div>
      </div>

      <div ref={suchbereichRef} className="manuelle-attacke">
        <label htmlFor="attacken-suche">Andere Attacke aus Generation 1–3 ergänzen</label>
        <input
          id="attacken-suche"
          type="search"
          value={suche}
          onFocus={() => setSucheOffen(true)}
          onChange={(event) => { setSuche(event.target.value); setSucheOffen(true) }}
          placeholder="Deutschen Attackennamen suchen …"
          disabled={ausgewaehlt.length >= 4}
        />
        {sucheOffen && suchErgebnisse.length > 0 && (
          <div>{suchErgebnisse.map((attacke) => <button key={attacke.id} onClick={() => hinzufuegen(attacke.id)}>{attacke.name}<small>#{attacke.id}</small></button>)}</div>
        )}
      </div>
    </div>
  )
}

function Kampfberater({
  zurueck,
  teamplanerOeffnen,
}: {
  zurueck: () => void
  teamplanerOeffnen: () => void
}) {
  const [paare] = useState<PokemonPaar[]>(gespeichertePaareLesen)
  const [namen] = useState(gespeicherteNamenLesen)
  const [team, setTeam] = useState<'rot' | 'blau'>('rot')
  const [gegnerId, setGegnerId] = useState<number | null>(null)
  const [gegnerLevel, setGegnerLevel] = useState(50)
  const [ergebnisse, setErgebnisse] = useState<KampfErgebnis[]>([])
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')
  const [attackenIds, setAttackenIds] = useState<number[]>([])
  const [nachpruefung, setNachpruefung] = useState<KampfErgebnis[]>([])
  const [prueftAttacken, setPrueftAttacken] = useState(false)

  const aktivePaare = paare.filter((paar) => paar.aktiv && paar.slot !== null)
  const teamRot: TeamMitglied[] = aktivePaare.map((paar) => ({ id: paar.links, level: paar.levelLinks, slot: paar.slot ?? 0, attacken: paar.attackenLinks, itemId: paar.itemLinks }))
  const teamBlau: TeamMitglied[] = aktivePaare.map((paar) => ({ id: paar.rechts, level: paar.levelRechts, slot: paar.slot ?? 0, attacken: paar.attackenRechts, itemId: paar.itemRechts }))
  const ausgewaehltesTeam = team === 'rot' ? teamRot : teamBlau
  const ausgewaehlterName = team === 'rot' ? namen.rot : namen.blau

  async function kampfAnalysieren() {
    if (!gegnerId || !ausgewaehltesTeam.length) return
    setLaedt(true)
    setFehler('')
    setErgebnisse([])
    setAttackenIds([])
    setNachpruefung([])

    try {
      const [gegner, ...teamDetails] = await Promise.all([
        detailsLaden(gegnerId),
        ...ausgewaehltesTeam.map((mitglied) => detailsLaden(mitglied.id)),
      ])

      const verwendeteAttacken = await Promise.all(teamDetails.map((pokemon, index) => {
        const mitglied = ausgewaehltesTeam[index]
        return mitglied.attacken.length
          ? attackenIdsLaden(mitglied.attacken)
          : pokemon.moves.filter((attacke) => attacke.level <= mitglied.level)
      }))

      const bewertungen = teamDetails.map((pokemon, index): KampfErgebnis =>
        kampfWertBerechnen(pokemon, ausgewaehltesTeam[index], gegner, gegnerLevel, verwendeteAttacken[index]),
      ).sort((a, b) => b.score - a.score)

      setErgebnisse(bewertungen)
      const bestesMitglied = ausgewaehltesTeam.find((mitglied) => mitglied.id === bewertungen[0]?.pokemon.id && mitglied.slot === bewertungen[0]?.slot)
      setAttackenIds(bestesMitglied?.attacken ?? [])
    } catch (error) {
      setFehler(error instanceof Error ? error.message : 'Die Kampfanalyse ist fehlgeschlagen.')
    } finally {
      setLaedt(false)
    }
  }

  const empfehlung = ergebnisse[0]
  const nachpruefungBeste = nachpruefung[0]

  async function echteAttackenPruefen() {
    if (!empfehlung || !gegnerId || !attackenIds.length) return
    setPrueftAttacken(true)
    setFehler('')
    try {
      const [gegner, echteAttacken] = await Promise.all([detailsLaden(gegnerId), attackenIdsLaden(attackenIds)])
      const empfehlungsMitglied = ausgewaehltesTeam.find((mitglied) => mitglied.id === empfehlung.pokemon.id && mitglied.slot === empfehlung.slot)
      const mitglied: TeamMitglied = empfehlungsMitglied ?? { id: empfehlung.pokemon.id, level: empfehlung.level, slot: empfehlung.slot, attacken: attackenIds, itemId: null }
      const neuBewertet = kampfWertBerechnen(empfehlung.pokemon, mitglied, gegner, gegnerLevel, echteAttacken)
      const neueReihenfolge = [neuBewertet, ...ergebnisse.filter((ergebnis) => ergebnis.pokemon.id !== empfehlung.pokemon.id)]
        .sort((a, b) => b.score - a.score)
      setNachpruefung(neueReihenfolge)
    } catch (error) {
      setFehler(error instanceof Error ? error.message : 'Die Attacken konnten nicht geprüft werden.')
    } finally {
      setPrueftAttacken(false)
    }
  }

  return (
    <main className="kampfberater-seite">
      <header className="kampfberater-kopf">
        <button className="zurueck" onClick={zurueck}>← Startseite</button>
        <span className="edition">DEIN CHEATCODE · KAMPFBERATER</span>
        <h1>Der nächste beste Zug</h1>
        <p>Wähle dein Team und den aktuellen Gegner. Die App vergleicht Typen, Level, Werte und mögliche Attacken.</p>
      </header>

      <section className="kampfberater-inhalt">
        {!aktivePaare.length ? (
          <div className="berater-leer">
            <strong>Noch kein aktives Team vorhanden</strong>
            <p>Lege im Teamplaner zuerst mindestens ein verbundenes Pokémon-Paar an.</p>
            <button onClick={teamplanerOeffnen}>Zum Teamplaner</button>
          </div>
        ) : (
          <>
            <section className="berater-schritt">
              <div className="berater-schritt__titel"><span>01</span><div><small>TEAMPLANER</small><h2>Welches Team kämpft?</h2></div></div>
              <div className="berater-teams">
                <TeamVorschau name={namen.rot || 'Team Rot'} farbe="rot" mitglieder={teamRot} aktiv={team === 'rot'} onAuswaehlen={() => { setTeam('rot'); setErgebnisse([]); setAttackenIds([]); setNachpruefung([]) }} />
                <TeamVorschau name={namen.blau || 'Team Blau'} farbe="blau" mitglieder={teamBlau} aktiv={team === 'blau'} onAuswaehlen={() => { setTeam('blau'); setErgebnisse([]); setAttackenIds([]); setNachpruefung([]) }} />
              </div>
            </section>

            <section className="berater-schritt">
              <div className="berater-schritt__titel"><span>02</span><div><small>AKTUELLER KAMPF</small><h2>Gegner festlegen</h2></div></div>
              <div className="gegner-eingabe">
                <PokemonSuche titel="Gegnerisches Pokémon" farbe="rot" ausgewaehlt={gegnerId} gesperrt={[]} onAuswaehlen={(id) => { setGegnerId(id); setErgebnisse([]); setAttackenIds([]); setNachpruefung([]) }} />
                <div className="gegner-level-feld"><span>Level des Gegners</span><LevelWaehler level={gegnerLevel} onAendern={(level) => { setGegnerLevel(level); setErgebnisse([]); setAttackenIds([]); setNachpruefung([]) }} /></div>
              </div>
              <button className="analyse-knopf" onClick={kampfAnalysieren} disabled={!gegnerId || laedt}>
                {laedt ? 'Kampf wird analysiert …' : `${ausgewaehlterName} analysieren`}
              </button>
              {fehler && <p className="berater-fehler">{fehler}</p>}
            </section>

            {empfehlung && (
              <section className="berater-ergebnis">
                <div className="berater-schritt__titel"><span>03</span><div><small>EMPFEHLUNG</small><h2>Das ist dein bester Zug</h2></div></div>
                <div className="beste-empfehlung">
                  <div className="beste-empfehlung__pokemon">
                    <span>Slot {empfehlung.slot + 1} · Level {empfehlung.level}</span>
                    <img src={BILD(empfehlung.pokemon.id)} alt={empfehlung.pokemon.name} />
                    <h3>{empfehlung.pokemon.name}</h3>
                    <div className="typen-liste">{empfehlung.pokemon.types.map((typ) => <TypMarke key={typ} typ={typ} />)}</div>
                  </div>
                  <div className="beste-empfehlung__zug">
                    <small>EMPFOHLENE ATTACKE</small>
                    <h3>{empfehlung.attacke?.name ?? 'Keine Schadensattacke verfügbar'}</h3>
                    {empfehlung.attacke && <TypMarke typ={empfehlung.attacke.type} />}
                    <dl>
                      <div><dt>Stärke</dt><dd>{empfehlung.attacke?.power ?? '—'}</dd></div>
                      <div><dt>Genauigkeit</dt><dd>{empfehlung.attacke?.accuracy ? `${empfehlung.attacke.accuracy} %` : '—'}</dd></div>
                      <div><dt>Typwirkung</dt><dd>×{empfehlung.effektivitaet}</dd></div>
                    </dl>
                    <p>{empfehlung.effektivitaet > 1 ? 'Die Attacke trifft sehr effektiv.' : empfehlung.effektivitaet < 1 ? 'Es gibt keine stärkere bereits erlernbare Alternative im Team.' : 'Die Attacke bietet den besten Gesamtwert aus Typ, Stärke und Basiswerten.'} {empfehlung.gefahr <= 1 ? `${empfehlung.pokemon.name} besitzt außerdem eine günstige defensive Typenlage.` : 'Achte trotzdem auf einen möglichen Typennachteil beim Gegenangriff.'}</p>
                  </div>
                </div>

                <div className="alternativen">
                  <h3>Weitere Möglichkeiten</h3>
                  {ergebnisse.slice(1, 4).map((ergebnis, index) => (
                    <div key={ergebnis.pokemon.id}>
                      <span>{index + 2}</span>
                      <img src={BILD(ergebnis.pokemon.id)} alt={ergebnis.pokemon.name} />
                      <strong>{ergebnis.pokemon.name}<small>Level {ergebnis.level} · Slot {ergebnis.slot + 1}</small></strong>
                      <b>{ergebnis.attacke?.name ?? 'Keine Schadensattacke'}</b>
                      <em>Typwirkung ×{ergebnis.effektivitaet}</em>
                    </div>
                  ))}
                </div>

                <p className="berater-hinweis">Gespeicherte Attackensets aus dem Teamplaner werden automatisch verwendet. Hat ein Pokémon dort noch kein Set, nutzt die erste Schätzung seine bis zum eingetragenen Level möglichen Level-Attacken.</p>

                <div className="attacken-pruefung">
                  <div className="berater-schritt__titel"><span>04</span><div><small>ECHTES ATTACKENSET</small><h2>Passt die Empfehlung wirklich?</h2></div></div>
                  <p className="attacken-pruefung__intro">Welche Attacken kennt <strong>{empfehlung.pokemon.name}</strong> tatsächlich? Wähle eine bis vier Attacken – auch nur zwei sind möglich.</p>
                  <AttackenAuswahl
                    pokemon={empfehlung.pokemon}
                    level={empfehlung.level}
                    ausgewaehlt={attackenIds}
                    onAendern={(ids) => { setAttackenIds(ids); setNachpruefung([]) }}
                  />
                  <p className="freie-attacken-hinweis">Freie Eingabe: Bei manuell gesuchten Attacken prüft die App nicht, ob dieses Pokémon die Attacke im Spiel wirklich erlernen kann.</p>
                  <button className="neu-pruefen" onClick={echteAttackenPruefen} disabled={!attackenIds.length || prueftAttacken}>
                    {prueftAttacken ? 'Attacken werden geprüft …' : `Mit ${attackenIds.length || 'diesen'} Attacke${attackenIds.length === 1 ? '' : 'n'} erneut prüfen`}
                  </button>

                  {nachpruefungBeste && (
                    <div className={`nachpruefung ${nachpruefungBeste.pokemon.id === empfehlung.pokemon.id ? 'nachpruefung--bestaetigt' : 'nachpruefung--wechseln'}`}>
                      <div className="nachpruefung__bild">
                        <img src={BILD(nachpruefungBeste.pokemon.id)} alt={nachpruefungBeste.pokemon.name} />
                      </div>
                      <div>
                        <small>{nachpruefungBeste.pokemon.id === empfehlung.pokemon.id ? 'EMPFEHLUNG BESTÄTIGT' : 'EMPFEHLUNG GEÄNDERT'}</small>
                        <h3>{nachpruefungBeste.pokemon.id === empfehlung.pokemon.id ? `${empfehlung.pokemon.name} bleibt die beste Wahl` : `Wechsle besser zu ${nachpruefungBeste.pokemon.name}`}</h3>
                        <p>
                          {nachpruefungBeste.pokemon.id === empfehlung.pokemon.id
                            ? `Mit deinem echten Attackenset ist ${nachpruefungBeste.attacke?.name ?? 'keine Schadensattacke'} die beste verfügbare Möglichkeit.`
                            : `Die ausgewählten Attacken von ${empfehlung.pokemon.name} reichen für diese Begegnung nicht aus. ${nachpruefungBeste.pokemon.name} in Slot ${nachpruefungBeste.slot + 1} ist voraussichtlich sinnvoller.`}
                        </p>
                        <dl>
                          <div><dt>Pokémon</dt><dd>{nachpruefungBeste.pokemon.name}</dd></div>
                          <div><dt>Beste Attacke</dt><dd>{nachpruefungBeste.attacke?.name ?? 'Keine Schadensattacke'}</dd></div>
                          <div><dt>Typwirkung</dt><dd>×{nachpruefungBeste.effektivitaet}</dd></div>
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  )
}

function Pokedex({ zurueck }: { zurueck: () => void }) {
  const [suche, setSuche] = useState('')
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null)

  const gefiltert = useMemo(() => {
    const begriff = suchText(suche.trim().replace(/^#/, ''))
    if (!begriff) return POKEMON
    return POKEMON.filter(
      (pokemon) =>
        suchText(pokemon.name).includes(begriff) ||
        String(pokemon.id).includes(begriff) ||
        suchText(pokemon.genus).includes(begriff),
    )
  }, [suche])

  return (
    <main className="pokedex-seite">
      <header className="pokedex-kopf">
        <button className="zurueck" onClick={zurueck}>← Startseite</button>
        <span className="edition">NATIONALER POKÉDEX · 001–386</span>
        <h1>Pokédex</h1>
        <p>Alle Pokémon der ersten drei Generationen – mit Daten aus Feuerrot und Blattgrün.</p>
      </header>

      <section className="pokedex-inhalt">
        <div className="suche">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={suche}
            onChange={(event) => setSuche(event.target.value)}
            placeholder="Nach Name, Nummer oder Gattung suchen …"
            aria-label="Pokémon suchen"
          />
          {suche && <button onClick={() => setSuche('')} aria-label="Suche löschen">×</button>}
        </div>

        <div className="listen-kopf">
          <p><strong>{gefiltert.length}</strong> Pokémon gefunden</p>
          <span>Nach Pokédex-Nummer sortiert</span>
        </div>

        {gefiltert.length ? (
          <div className="pokemon-raster">
            {gefiltert.map((pokemon) => (
              <PokedexKarte key={pokemon.id} pokemon={pokemon} oeffnen={() => setAusgewaehlt(pokemon.id)} />
            ))}
          </div>
        ) : (
          <div className="leere-suche">
            <strong>Kein Pokémon gefunden</strong>
            <p>Probiere einen anderen deutschen Namen oder eine Pokédex-Nummer.</p>
            <button onClick={() => setSuche('')}>Alle Pokémon anzeigen</button>
          </div>
        )}
      </section>

      {ausgewaehlt && <DetailFenster id={ausgewaehlt} schliessen={() => setAusgewaehlt(null)} />}
    </main>
  )
}

export default function App() {
  type Seite = 'start' | 'pokedex' | 'teamplaner' | 'kampfberater'

  function seiteAusHash(): Seite {
    if (window.location.hash === '#pokedex') return 'pokedex'
    if (window.location.hash === '#teamplaner') return 'teamplaner'
    if (window.location.hash === '#kampfberater') return 'kampfberater'
    return 'start'
  }

  const [seite, setSeite] = useState<Seite>(seiteAusHash)

  useEffect(() => {
    const wechsel = () => setSeite(seiteAusHash())
    window.addEventListener('hashchange', wechsel)
    return () => window.removeEventListener('hashchange', wechsel)
  }, [])

  function wechseln(ziel: Seite) {
    window.location.hash = ziel === 'start' ? '' : ziel
    setSeite(ziel)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <nav className="hauptnav">
        <button className="marke" onClick={() => wechseln('start')} aria-label="Zur Startseite">
          <span className="marke__ball"><i /></span>
          <span><strong>Feuerrot</strong><small>Abenteuer-Begleiter</small></span>
        </button>
        <span className="datenhinweis">Daten: PokéAPI · Fanprojekt</span>
      </nav>

      {seite === 'start' && (
        <Startseite
          pokedexOeffnen={() => wechseln('pokedex')}
          teamplanerOeffnen={() => wechseln('teamplaner')}
          kampfberaterOeffnen={() => wechseln('kampfberater')}
        />
      )}
      {seite === 'pokedex' && <Pokedex zurueck={() => wechseln('start')} />}
      {seite === 'teamplaner' && <Teamplaner zurueck={() => wechseln('start')} />}
      {seite === 'kampfberater' && <Kampfberater zurueck={() => wechseln('start')} teamplanerOeffnen={() => wechseln('teamplaner')} />}

      <footer>
        <p>Inoffizielles, nicht kommerzielles Fanprojekt. Pokémon und zugehörige Namen sind Marken ihrer jeweiligen Rechteinhaber.</p>
      </footer>
    </div>
  )
}
