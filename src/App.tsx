import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { POKEMON, type PokedexEntry } from './pokemonData'
import { ATTACKEN } from './moveData'
import { ITEMS } from './itemData'

const API = 'https://pokeapi.co/api/v2'
const OFFLINE_DATEN = import.meta.env.VITE_OFFLINE_DATA === 'true'
const offlineApiPfad = (url: string) => {
  const pfad = new URL(url).pathname.replace(/^\/api\/v2\//, '').replace(/\/$/, '')
  return `${import.meta.env.BASE_URL}offline-data/api/${pfad}.json`
}
const BILD = (id: number) =>
  OFFLINE_DATEN ? `${import.meta.env.BASE_URL}offline-data/pokemon/${id}.png` : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
const ITEM_BILD = (identifier: string) =>
  OFFLINE_DATEN ? `${import.meta.env.BASE_URL}offline-data/items/${identifier}.png` : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${identifier}.png`

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
  const ziel = OFFLINE_DATEN && url.startsWith(API) ? offlineApiPfad(url) : url
  if (!apiCache.has(ziel)) {
    apiCache.set(
      ziel,
      fetch(ziel).then((antwort) => {
        if (!antwort.ok) throw new Error('Die Pokédex-Daten konnten nicht geladen werden.')
        return antwort.json()
      }),
    )
  }
  return apiCache.get(ziel) as Promise<T>
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
  menueOeffnen,
  menueOffen,
  logoAuswahlOeffnen,
  pokedexOeffnen,
  teamplanerOeffnen,
  kampfberaterOeffnen,
  regelnOeffnen,
  encounterOeffnen,
  abenteuerplanOeffnen,
  challengeZuruecksetzen,
}: {
  menueOeffnen: () => void
  menueOffen: boolean
  logoAuswahlOeffnen: () => void
  pokedexOeffnen: () => void
  teamplanerOeffnen: () => void
  kampfberaterOeffnen: () => void
  regelnOeffnen: () => void
  encounterOeffnen: () => void
  abenteuerplanOeffnen: () => void
  challengeZuruecksetzen: () => void
}) {
  const [fortschritt, setFortschritt] = useState<number | null>(() => {
    const gespeichert = localStorage.getItem('feuerrot-arenen-fortschritt')
    if (gespeichert === null) return null
    const wert = Number(gespeichert)
    return Number.isInteger(wert) && wert >= 0 && wert < ARENEN_FORTSCHRITT.length ? wert : null
  })
  const [notizenOffen, setNotizenOffen] = useState(false)
  const [notizen, setNotizen] = useState(() => localStorage.getItem('feuerrot-notizen') ?? '')

  useEffect(() => {
    if (fortschritt === null) localStorage.removeItem('feuerrot-arenen-fortschritt')
    else localStorage.setItem('feuerrot-arenen-fortschritt', String(fortschritt))
  }, [fortschritt])
  useEffect(() => { localStorage.setItem('feuerrot-notizen', notizen) }, [notizen])

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
    { titel: 'Encounter-Liste', text: 'Fanggebiete in Spielreihenfolge mit Leveln', symbol: '✓', aktiv: true, aktion: encounterOeffnen },
    { titel: 'Regeln', text: 'Das vollständige SoulLink-Regelwerk', symbol: '§', aktiv: true, aktion: regelnOeffnen },
    { titel: 'Abenteuerplan', text: 'Schritt für Schritt von Arena zu Arena', symbol: '⌖', aktiv: true, aktion: abenteuerplanOeffnen },
  ]

  return (
    <main className="startseite">
      <section className="held">
        <div className="held__inhalt">
          <span className="edition">GENERATION III · FEUERROT</span>
          <h1>Dein Begleiter für Kanto</h1>
        </div>
        <p className="held__fussnote">Plane dein Abenteuer, durchsuche den Nationalen Pokédex und behalte deinen Fortschritt an einem Ort.</p>
        <div className="held__ball" aria-hidden="true">
          <span />
        </div>
      </section>

      <nav className="start-werkzeugleiste" aria-label="Hauptnavigation">
        <div className="hauptnav__links">
          <button className="menue-knopf" onClick={menueOeffnen} aria-label="Einstellungen öffnen" aria-expanded={menueOffen}>
            <i /><i /><i />
          </button>
          <button className="marke" onClick={() => window.location.hash = ''} aria-label="Zur Startseite">
            <span className="marke__ball" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); logoAuswahlOeffnen() }}><i /></span>
            <span><strong>Feuerrot</strong><small>Abenteuer-Begleiter</small></span>
          </button>
          <span className="werkzeugleiste__trenner" aria-hidden="true" />
          <span className="ueberzeile">ABENTEUER-WERKZEUGE</span>
        </div>
        <span className="status"><i /> 6 von 6 verfügbar</span>
      </nav>

      <section className="bereich-auswahl" aria-label="Abenteuer-Werkzeuge">
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
          <div className="arena-steuerung"><div className="arena-auswahl">
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
          </div><button className="notizbuch-knopf" onClick={() => setNotizenOffen(true)}><span>▤</span><strong>Notizbuch</strong><small>{notizen.trim() ? 'Notizen vorhanden' : 'Bemerkungen festhalten'}</small></button></div>
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
      <button className="challenge-reset" onClick={challengeZuruecksetzen}><span>↻</span><strong>Challenge zurücksetzen</strong><small>Aktuellen Run vorher archivieren</small></button>
      {notizenOffen && <div className="notiz-dialog-hintergrund" onMouseDown={() => setNotizenOffen(false)}><section className="notiz-dialog" role="dialog" aria-modal="true" aria-labelledby="notiz-dialog-titel" onMouseDown={(event) => event.stopPropagation()}><header><div><span>SOULLINK-NOTIZBUCH</span><h2 id="notiz-dialog-titel">Bemerkungen</h2></div><button onClick={() => setNotizenOffen(false)} aria-label="Notizbuch schließen">×</button></header><textarea value={notizen} onChange={(event) => setNotizen(event.target.value)} placeholder="Schreibe hier Routenhinweise, Randomizer-Funde oder Absprachen mit deinen Partnern …" autoFocus /><footer><span>Wird automatisch gespeichert</span><button onClick={() => setNotizenOffen(false)}>Fertig</button></footer></section></div>}
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

type GrabPaar = PokemonPaar & { gestorbenAm: string }

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
  onGrabbox,
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
  onGrabbox: (id: string) => void
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
        <button className="paar-in-grabbox" onClick={() => onGrabbox(paar.id)}>† Grabbox</button>
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
  const [grabbox, setGrabbox] = useState<GrabPaar[]>(() => {
    try { return JSON.parse(localStorage.getItem('feuerrot-grabbox') ?? '[]') as GrabPaar[] }
    catch { return [] }
  })
  const [deathCounter, setDeathCounter] = useState<{ rot: number; blau: number }>(() => {
    try { return JSON.parse(localStorage.getItem('feuerrot-death-counter') ?? '{"rot":0,"blau":0}') as { rot: number; blau: number } }
    catch { return { rot: 0, blau: 0 } }
  })
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

  useEffect(() => { localStorage.setItem('feuerrot-grabbox', JSON.stringify(grabbox)) }, [grabbox])
  useEffect(() => { localStorage.setItem('feuerrot-death-counter', JSON.stringify(deathCounter)) }, [deathCounter])

  const teamRot = [...paare, ...grabbox].map((paar) => paar.links)
  const teamBlau = [...paare, ...grabbox].map((paar) => paar.rechts)
  const aktivePaare = paare.filter((paar) => paar.aktiv).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  const weiterePaare = paare.filter((paar) => !paar.aktiv)
  const freieSlots = Array.from({ length: 6 }, (_, index) => index).filter(
    (slot) => !aktivePaare.some((paar) => paar.slot === slot),
  )
  const nameRot = teamNamen.rot.trim() || 'Team Rot'
  const nameBlau = teamNamen.blau.trim() || 'Team Blau'
  const hatAenderungen = paare.length > 0 || grabbox.length > 0 || deathCounter.rot > 0 || deathCounter.blau > 0 || nameRot !== 'Team Rot' || nameBlau !== 'Team Blau'

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

  function inGrabbox(id: string) {
    const paar = paare.find((eintrag) => eintrag.id === id)
    if (!paar) return
    setGrabbox((aktuell) => [...aktuell, { ...paar, aktiv: false, slot: null, gestorbenAm: new Date().toISOString() }])
    setPaare((aktuell) => aktuell.filter((eintrag) => eintrag.id !== id))
    if (offen?.paarId === id) setOffen(null)
  }

  function wiederherstellen(id: string) {
    const paar = grabbox.find((eintrag) => eintrag.id === id)
    if (!paar) return
    const { gestorbenAm: _gestorbenAm, ...lebendesPaar } = paar
    setPaare((aktuell) => [...aktuell, { ...lebendesPaar, aktiv: false, slot: null }])
    setGrabbox((aktuell) => aktuell.filter((eintrag) => eintrag.id !== id))
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
      setGrabbox([])
      setDeathCounter({ rot: 0, blau: 0 })
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
            <div className="death-counter death-counter--rot"><span>Tode</span><button onClick={() => setDeathCounter((aktuell) => ({ ...aktuell, rot: Math.max(0, aktuell.rot - 1) }))} aria-label="Death Counter Team Rot verringern">−</button><strong>{deathCounter.rot}</strong><button onClick={() => setDeathCounter((aktuell) => ({ ...aktuell, rot: aktuell.rot + 1 }))} aria-label="Death Counter Team Rot erhöhen">+</button></div>
          </div>
          <span>VERBUNDENE SLOTS</span>
          <div>
            <div className="death-counter death-counter--blau"><span>Tode</span><button onClick={() => setDeathCounter((aktuell) => ({ ...aktuell, blau: Math.max(0, aktuell.blau - 1) }))} aria-label="Death Counter Team Blau verringern">−</button><strong>{deathCounter.blau}</strong><button onClick={() => setDeathCounter((aktuell) => ({ ...aktuell, blau: aktuell.blau + 1 }))} aria-label="Death Counter Team Blau erhöhen">+</button></div>
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
            <PaarZeile key={paar?.id ?? `leer-${index}`} paar={paar} index={index} offen={offen} onOeffnen={kurzinfoOeffnen} onEntfernen={entfernen} onBank={aufBank} onGrabbox={inGrabbox} onSlotWechseln={slotWechseln} onLevelAendern={levelAendern} onItemAendern={itemAendern} onAttackenAendern={attackenAendern} />
          ))}
        </div>

        <div className="team-unterbereiche">
        {weiterePaare.length > 0 ? (
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
                  <button className="bank-grabbox" onClick={() => inGrabbox(paar.id)}>† In Grabbox verschieben</button>
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
        ) : <section className="weitere-paare weitere-paare--leer"><div><span className="ueberzeile">ERSATZBANK</span><h2>Weitere Pokémon-Paare</h2><p>Noch keine lebenden Ersatzpaare vorhanden.</p></div></section>}
        <section className="grabbox">
          <div className="grabbox__kopf"><div><span className="ueberzeile">GRABBOX</span><h2>Verstorbene Seelenpaare</h2><p>Beide Partner bleiben gemeinsam dokumentiert.</p></div><strong>{grabbox.length}</strong></div>
          {grabbox.length ? <div className="grabbox__raster">{grabbox.map((paar) => <article className="grab-paar" key={paar.id}><div><img src={BILD(paar.links)} alt={POKEMON[paar.links - 1].name} /><span><small>{nameRot}</small><strong>{POKEMON[paar.links - 1].name}</strong><em>Lv. {paar.levelLinks}</em></span></div><b>†</b><div><span><small>{nameBlau}</small><strong>{POKEMON[paar.rechts - 1].name}</strong><em>Lv. {paar.levelRechts}</em></span><img src={BILD(paar.rechts)} alt={POKEMON[paar.rechts - 1].name} /></div><footer><span>Verstorben am {new Date(paar.gestorbenAm).toLocaleDateString('de-DE')}</span><button onClick={() => wiederherstellen(paar.id)}>Wiederherstellen</button></footer></article>)}</div> : <p className="grabbox__leer">Noch kein Seelenpaar liegt in der Grabbox.</p>}
        </section>
        </div>
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

            <section className="berater-schritt berater-schritt--gegner">
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

type AbenteuerEtappe = {
  name: string
  ziel: string
  cap: string
  fokus: string
  punkte: string[]
}

const ABENTEUER_ETAPPEN: AbenteuerEtappe[] = [
  { name: 'Arena 1', ziel: 'Rocko', cap: '14 / 12', fokus: 'Von Alabastia nach Marmoria City', punkte: [
    'Randomisierten Starter wählen, benennen und mit den Startern der Partner verbinden.',
    'Die ersten Pokébälle erhalten – ab diesem Moment beginnt die Challenge.',
    'Erstbegegnungen auf Route 1, Route 2, Route 22 und im Vertania-Wald gemeinsam klären.',
    'Ein Cap-Pokémon bis Level 14 bestimmen; alle anderen höchstens bis Level 12 trainieren.',
    'Team heilen, getragene Items prüfen und Rocko gemeinsam besiegen.',
  ] },
  { name: 'Arena 2', ziel: 'Misty', cap: '21 / 19', fokus: 'Mondberg und Azuria City', punkte: [
    'Erstbegegnungen auf Route 3 und im Mondberg durchführen und sofort verbinden.',
    'Im Mondberg ein Fossil wählen; benutzen dürft ihr es später nur gemeinsam mit Partner-Fossilien.',
    'Den Rivalen in Azuria City besiegen und die Begegnungen auf Route 24 und 25 prüfen.',
    'Ein Cap-Pokémon bis Level 21 bestimmen; alle anderen höchstens bis Level 19 trainieren.',
    'Wasser-Schwächen absichern und Misty besiegen.',
  ] },
  { name: 'Arena 3', ziel: 'Major Bob', cap: '24 / 22', fokus: 'Orania City und die M.S. Anne', punkte: [
    'Neue Erstbegegnungen auf Route 5, Route 6 und Route 11 eintragen.',
    'Die M.S. Anne vollständig vorbereiten, den Rivalen besiegen und Zerschneider erhalten.',
    'Die Digda-Höhle nur betreten, wenn alle Partner für ihre Begegnung bereit sind.',
    'Ein Cap-Pokémon bis Level 24 bestimmen; alle anderen höchstens bis Level 22 trainieren.',
    'Boden-Attacken oder eine Elektro-Resistenz vorbereiten und Major Bob besiegen.',
  ] },
  { name: 'Arena 4', ziel: 'Erika', cap: '29 / 27', fokus: 'Felstunnel, Lavandia und Prismania City', punkte: [
    'Erstbegegnungen auf Route 9, Route 10 und im Felstunnel gemeinsam durchführen.',
    'In Lavandia den Rivalen beachten; den Pokémon-Turm erst mit dem Silph Scope abschließen.',
    'Über Route 8 nach Prismania City reisen und den Rocket-Unterschlupf abschließen.',
    'Ein Cap-Pokémon bis Level 29 bestimmen; alle anderen höchstens bis Level 27 trainieren.',
    'Feuer-, Flug-, Käfer- oder Eis-Attacken vorbereiten und Erika besiegen.',
  ] },
  { name: 'Arena 5', ziel: 'Koga', cap: '43 / 41', fokus: 'Pokémon-Turm, Fuchsania City und Safari-Zone', punkte: [
    'Mit dem Silph Scope zum Pokémon-Turm zurückkehren und die Pokéflöte erhalten.',
    'Den Weg über Route 12–15 oder den Radweg Route 16–18 samt Erstbegegnungen abstimmen.',
    'In der Safari-Zone Surfer und die Goldzähne holen; Fangregeln vorher gemeinsam festlegen.',
    'Ein Cap-Pokémon bis Level 43 bestimmen; alle anderen höchstens bis Level 41 trainieren.',
    'Psycho- oder Boden-Attacken und Schutz vor Gift vorbereiten und Koga besiegen.',
  ] },
  { name: 'Arena 6', ziel: 'Sabrina', cap: '43 / 41', fokus: 'Saffronia City und Silph Co.', punkte: [
    'Saffronia City öffnen und die Silph Co. nur mit einem vollständig erlaubten Team betreten.',
    'Den Rivalen in der Silph Co. einplanen und Lapras als geschenktes Pokémon abstimmen.',
    'Giovanni besiegen, den Meisterball sichern und keine Cap-Verstöße beim Umbau des Teams erzeugen.',
    'Ein Cap-Pokémon bis Level 43 bestimmen; alle anderen höchstens bis Level 41 lassen.',
    'Starke physische Angreifer sowie Käfer-, Geist- oder Unlicht-Attacken vorbereiten und Sabrina besiegen.',
  ] },
  { name: 'Arena 7', ziel: 'Pyro', cap: '47 / 45', fokus: 'Seeschauminseln und Zinnoberinsel', punkte: [
    'Surfer-Strecken und Erstbegegnungen auf Route 19, Route 20 und Route 21 abstimmen.',
    'Die Seeschauminseln optional gemeinsam erkunden und statische Begegnungen vorher klären.',
    'Fossilien nur wiederbeleben, wenn alle Partner ein erlaubtes Fossil verwenden können.',
    'Den Geheimschlüssel im Pokémon-Haus finden und auf Level 47 / 45 trainieren.',
    'Wasser-, Boden- oder Gesteins-Attacken vorbereiten und Pyro besiegen.',
  ] },
  { name: 'Arena 8', ziel: 'Giovanni', cap: '50 / 48', fokus: 'Eiland-Abstecher und Vertania City', punkte: [
    'Den Eiland-Abstecher mit Bill abschließen und neue Gebiete getrennt dokumentieren.',
    'Alle sieben bisherigen Seelenverbindungen, Grab-Boxen und erlaubten PC-Tausche kontrollieren.',
    'Die Arena von Vertania City öffnen und ein stabiles Team gegen Boden-Pokémon zusammenstellen.',
    'Ein Cap-Pokémon bis Level 50 bestimmen; alle anderen höchstens bis Level 48 trainieren.',
    'Giovanni besiegen und anschließend den Rivalenkampf auf Route 22 vorbereiten.',
  ] },
  { name: 'Top 4 · Kampf 1', ziel: 'Lorelei', cap: '54 / 52', fokus: 'Siegesstraße und Indigo-Plateau', punkte: [
    'Route 23 und die Siegesstraße samt letzter regulärer Erstbegegnung abschließen.',
    'Das endgültige Team bilden; jedes Seelenpaar muss auf beiden Seiten einsatzfähig sein.',
    'Ein Cap-Pokémon bis Level 54 bestimmen; alle anderen höchstens bis Level 52 trainieren.',
    'Die höchstens 15 außerhalb von Kämpfen erlaubten Top-4-Items gemeinsam festlegen.',
    'Elektro-, Kampf- oder Gesteins-Antworten vorbereiten und Lorelei besiegen.',
  ] },
  { name: 'Top 4 · Kampf 2', ziel: 'Bruno', cap: '56 / 54', fokus: 'Kampf- und Gesteins-Pokémon', punkte: [
    'Verluste aus Kampf 1 sofort auf alle verbundenen Seelenpartner anwenden.',
    'Nur erlaubte Heilung außerhalb des Kampfes verwenden und den 15-Item-Zähler beachten.',
    'Ein Cap-Pokémon bis Level 56 bestimmen; alle anderen höchstens bis Level 54 halten.',
    'Psycho-, Flug-, Wasser- oder Pflanzen-Attacken sinnvoll verteilen.',
    'Bruno besiegen, ohne gesperrte oder verstorbene Seelenpartner einzusetzen.',
  ] },
  { name: 'Top 4 · Kampf 3', ziel: 'Agathe', cap: '58 / 56', fokus: 'Geist- und Gift-Pokémon', punkte: [
    'Teamstatus und verbleibende erlaubte Items nach Bruno gemeinsam prüfen.',
    'Ein Cap-Pokémon bis Level 58 bestimmen; alle anderen höchstens bis Level 56 halten.',
    'Schnelle Psycho-, Geist- oder starke neutrale physische Attacken vorbereiten.',
    'Schlaf, Verwirrung und Gift bei der Planung berücksichtigen.',
    'Agathe besiegen und alle möglichen Verluste sofort für beide Teams notieren.',
  ] },
  { name: 'Top 4 · Kampf 4', ziel: 'Siegfried', cap: '60 / 58', fokus: 'Drachen- und Flug-Pokémon', punkte: [
    'Verbleibende vollständige Seelenpaare und Item-Anzahl vor dem Kampf prüfen.',
    'Ein Cap-Pokémon bis Level 60 bestimmen; alle anderen höchstens bis Level 58 halten.',
    'Eis-Attacken als wichtigste Antwort auf Drachen-Pokémon absichern.',
    'Elektro- oder Gesteins-Antworten für Flug- und Wasser-Pokémon bereithalten.',
    'Siegfried besiegen und das Team ohne unerlaubte Heilung für den Champ vorbereiten.',
  ] },
  { name: 'Champ', ziel: 'Rivale', cap: '63 / 61', fokus: 'Der letzte gemeinsame Kampf', punkte: [
    'Alle Verluste aus der Top 4 endgültig anwenden und nur vollständige Seelenpaare einsetzen.',
    'Ein Cap-Pokémon bis Level 63 bestimmen; alle anderen höchstens bis Level 61 halten.',
    'Für das gemischte Team des Rivalen mehrere Typenabdeckungen statt nur einer Konterstrategie wählen.',
    'Verbleibende Items ausschließlich nach euren Kampfregeln benutzen.',
    'Den Champ besiegen – damit ist die SoulLink-Challenge gemeinsam bestanden.',
  ] },
]

type AbenteuerInfo = {
  titel: string
  ort: string
  x: number
  y: number
  beschreibung: string
  weg: string[]
  voraussetzung?: string
}

const ABENTEUER_INFOS: Record<string, AbenteuerInfo> = {
  '0-1': { titel: 'Die ersten Pokébälle erhalten', ort: 'Alabastia · Labor von Professor Eich', x: 250, y: 420, beschreibung: 'Mit dem Erhalt der fünf Pokébälle beginnt eure Challenge.', weg: ['Gehe von Alabastia über Route 1 nach Vertania City.', 'Hole im Markt das Paket für Professor Eich ab und bringe es zurück in sein Labor.', 'Nach der Übergabe erhaltet ihr Pokédex und Pokébälle.'], voraussetzung: 'Vorher noch keine Erstbegegnung werten – die Challenge startet erst mit den Pokébällen.' },
  '0-4': { titel: 'Rocko finden', ort: 'Marmoria City · Pokémon-Arena', x: 240, y: 210, beschreibung: 'Rocko wartet in der Arena von Marmoria City.', weg: ['Durchquere von Vertania City aus Route 2 und den Vertania-Wald.', 'Verlasse den Wald im Norden und folge Route 2 bis Marmoria City.', 'Heile im Pokémon-Center und betrete anschließend die Arena.'] },
  '1-1': { titel: 'Fossil im Mondberg', ort: 'Mondberg · 2. Untergeschoss', x: 320, y: 165, beschreibung: 'Am Ende des Hauptwegs müsst ihr euch zwischen zwei Fossilien entscheiden.', weg: ['Gehe von Marmoria über Route 3 zum Mondberg.', 'Folge den Leitern immer weiter hinab und besiege die Team-Rocket-Rüpel.', 'Nach dem Kampf gegen den Streber liegen Domfossil links und Helixfossil rechts.'], voraussetzung: 'Das Fossil darf nach euren Regeln nur benutzt werden, wenn die Partner ebenfalls ein Fossil besitzen.' },
  '1-2': { titel: 'Rivale, Nugget-Brücke und Bill', ort: 'Azuria City · Route 24 und 25', x: 410, y: 180, beschreibung: 'Der Rivale wartet am nördlichen Ausgang von Azuria City.', weg: ['Gehe in Azuria City nach Norden zur Brücke.', 'Besiege zuerst den Rivalen und danach die Trainer der Nugget-Brücke auf Route 24.', 'Biege hinter der Brücke nach Osten auf Route 25 ab und folge dem Weg bis zu Bills Küstenhaus.'] },
  '1-4': { titel: 'Misty finden', ort: 'Azuria City · Pokémon-Arena', x: 410, y: 180, beschreibung: 'Mistys Wasser-Arena steht im Zentrum von Azuria City.', weg: ['Kehre nach dem Besuch bei Bill nach Azuria City zurück.', 'Heile dein Team im Pokémon-Center.', 'Betrete die Arena in der Stadtmitte und gehe über die Stege zu Misty.'] },
  '2-1': { titel: 'Zerschneider auf der M.S. Anne', ort: 'Orania City · Hafen', x: 405, y: 350, beschreibung: 'Der Kapitän der M.S. Anne gibt dir VM01 Zerschneider.', weg: ['Zeige am Hafen von Orania City das Bootsticket von Bill.', 'Gehe im Schiff nach oben und folge dem Gang zur Treppe des Kapitäns.', 'Besiege dort den Rivalen und gehe anschließend in die Kapitänskajüte.', 'Sprich mit dem seekranken Kapitän, um VM01 zu erhalten.'], voraussetzung: 'Erledige gewünschte Kämpfe und Items auf dem Schiff vorher – nach dem Verlassen fährt es ab.' },
  '2-4': { titel: 'Major Bob finden', ort: 'Orania City · Pokémon-Arena', x: 405, y: 350, beschreibung: 'Die Arena liegt im südwestlichen Teil von Orania City.', weg: ['Bringe Zerschneider einem geeigneten Pokémon bei.', 'Zerschneide den kleinen Baum vor der Arena.', 'Finde im Inneren erst den ersten Schalter in einem Mülleimer; der zweite liegt direkt daneben.', 'Nach beiden Schaltern öffnet sich der Weg zu Major Bob.'] },
  '3-0': { titel: 'Weg durch den Felstunnel', ort: 'Route 10 · Felstunnel', x: 520, y: 195, beschreibung: 'Der Felstunnel verbindet Route 10 mit der Gegend nördlich von Lavandia.', weg: ['Gehe von Azuria nach Osten über Route 9.', 'Folge Route 10 nach Süden bis zum Höhleneingang beim Pokémon-Center.', 'Nutze Blitz für bessere Sicht und folge den Leitern durch die Höhle.', 'Der südliche Ausgang führt weiter nach Lavandia.'], voraussetzung: 'Blitz ist optional, macht die Orientierung aber wesentlich leichter.' },
  '3-1': { titel: 'Pokémon-Turm vorbereiten', ort: 'Lavandia · Pokémon-Turm', x: 545, y: 255, beschreibung: 'Beim ersten Besuch kannst du den Turm noch nicht vollständig abschließen.', weg: ['Betrete den großen Turm im Osten von Lavandia.', 'Der Rivale wartet auf einer der ersten Etagen.', 'Verlasse den Turm, sobald das unbekannte Geist-Pokémon den Weg blockiert.', 'Hole zuerst das Silph Scope im Rocket-Unterschlupf von Prismania City.'] },
  '3-2': { titel: 'Rocket-Unterschlupf und Giovanni', ort: 'Prismania City · Rocket-Spielhalle', x: 350, y: 255, beschreibung: 'Der geheime Eingang befindet sich hinter einem Poster in der Spielhalle.', weg: ['Betrete die Rocket-Spielhalle in Prismania City und besiege den Rüpel beim Poster.', 'Untersuche das Poster und drücke den versteckten Schalter.', 'Gehe im Unterschlupf bis U4 und besiege dort den Rüpel für den Aufzugsschlüssel.', 'Fahre mit dem Aufzug zurück nach U4, besiege Giovanni und nimm das Silph Scope.'] },
  '3-4': { titel: 'Erika finden', ort: 'Prismania City · Pokémon-Arena', x: 350, y: 255, beschreibung: 'Erikas Pflanzen-Arena liegt im Südwesten von Prismania City.', weg: ['Gehe im Süden der Stadt nach Westen.', 'Nutze Zerschneider am kleinen Baum, der den Weg versperrt.', 'Betrete die Arena und folge den Wegen zwischen den Pflanzen zu Erika.'], voraussetzung: 'VM01 Zerschneider von der M.S. Anne wird benötigt.' },
  '4-0': { titel: 'Pokéflöte im Pokémon-Turm', ort: 'Lavandia · Pokémon-Turm', x: 545, y: 255, beschreibung: 'Mit dem Silph Scope kannst du den Turm jetzt bis zur Spitze abschließen.', weg: ['Kehre mit dem Silph Scope nach Lavandia zurück.', 'Steige durch den Turm und besiege das enttarnte Knogga.', 'Besiege oben die Team-Rocket-Rüpel und rette Mr. Fuji.', 'Folge ihm in sein Haus und sprich mit ihm, um die Pokéflöte zu erhalten.'] },
  '4-1': { titel: 'Weg nach Fuchsania City', ort: 'Route 12–15 oder Route 16–18', x: 430, y: 385, beschreibung: 'Nach Fuchsania führen zwei verschiedene Wege.', weg: ['Ostweg: Wecke Relaxo südlich von Lavandia auf Route 12 und folge Route 12, 13, 14 und 15.', 'Westweg: Wecke Relaxo westlich von Prismania auf Route 16 und fahre über den Radweg auf Route 17 und 18.', 'Beide Wege enden in Fuchsania City.'], voraussetzung: 'Für beide Wege brauchst du die Pokéflöte. Begegnungen je Route vorher mit den Partnern abstimmen.' },
  '4-2': { titel: 'Surfer und Goldzähne', ort: 'Fuchsania City · Safari-Zone', x: 400, y: 420, beschreibung: 'Beide wichtigen Gegenstände liegen tief in der Safari-Zone.', weg: ['Betrete die Safari-Zone im Norden von Fuchsania City und gehe zunächst nach Osten.', 'Folge dem langen Außenweg über die nördlichen Bereiche bis in das weit westlich gelegene letzte Gebiet.', 'Gehe dort nach Süden: Die Goldzähne liegen auf dem Boden nahe dem Geheimen Haus.', 'Betrete das Geheime Haus und sprich mit dem Mann für VM03 Surfer.', 'Bringe die Goldzähne anschließend dem Wärter im südöstlichen Fuchsania; er gibt dir VM04 Stärke.'] },
  '4-4': { titel: 'Koga finden', ort: 'Fuchsania City · Pokémon-Arena', x: 400, y: 420, beschreibung: 'Kogas Arena steht im südwestlichen Teil von Fuchsania City.', weg: ['Heile im Pokémon-Center und gehe zur Arena im Südwesten.', 'Die scheinbar offenen Wege sind durch unsichtbare Wände blockiert.', 'Orientiere dich an den hellen Punkten am Boden und arbeite dich am Rand entlang zu Koga vor.'] },
  '5-0': { titel: 'Saffronia City öffnen', ort: 'Prismania City → Saffronia City', x: 440, y: 270, beschreibung: 'Die Wächter an den vier Stadttoren lassen dich erst mit Tee passieren.', weg: ['Betrete in Prismania City die große Prismania-Villa.', 'Sprich im Erdgeschoss mit der alten Dame und nimm den Tee an.', 'Gehe durch eines der Wärterhäuser auf Route 5, 6, 7 oder 8.', 'Der Wächter nimmt den Tee an; danach sind alle vier Zugänge zu Saffronia geöffnet.'] },
  '5-1': { titel: 'Rivale und Lapras in Silph Co.', ort: 'Saffronia City · Silph Co.', x: 440, y: 270, beschreibung: 'Der Rivalenkampf und das geschenkte Lapras liegen auf dem Story-Weg zu Giovanni.', weg: ['Hole zuerst den Türöffner im 4. Obergeschoss.', 'Öffne im 2. Obergeschoss die verschlossene Tür zum Ziel-Teleporter.', 'Der Teleporter bringt dich in das 6. Obergeschoss zum Rivalen.', 'Nach dem Sieg schenkt dir der Mitarbeiter im selben Raum ein Lapras.'] },
  '5-2': { titel: 'Giovanni in Silph Co. finden', ort: 'Saffronia City · Silph Co., oberste Etage', x: 440, y: 270, beschreibung: 'Giovanni hält sich im abgeschlossenen Raum beim Präsidenten auf.', weg: ['Hole den Türöffner im 4. Obergeschoss der Silph Co.', 'Öffne im 2. Obergeschoss die Tür zum Teleporter und besiege im 6. Obergeschoss den Rivalen.', 'Nimm danach den unteren rechten Teleporter im Rivalenraum.', 'Besiege den letzten Rocket-Rüpel und anschließend Giovanni.', 'Sprich danach mit dem Präsidenten, um den Meisterball zu erhalten.'] },
  '5-4': { titel: 'Sabrina finden', ort: 'Saffronia City · Pokémon-Arena', x: 440, y: 270, beschreibung: 'Nach der Befreiung der Silph Co. ist Sabrinas Arena zugänglich.', weg: ['Gehe in den nördlichen Teil von Saffronia City.', 'Die richtige Pokémon-Arena liegt direkt neben der Kampfarena.', 'Nutze die Teleporter im Inneren; arbeite dich von Raum zu Raum bis zur mittleren Plattform vor.'] },
  '6-1': { titel: 'Seeschauminseln', ort: 'Route 20 · zwischen Fuchsania und Zinnoberinsel', x: 315, y: 450, beschreibung: 'Die Inselhöhlen liegen auf der Surfstrecke westlich von Fuchsania City.', weg: ['Surfe von Fuchsania über Route 19 nach Süden und dann auf Route 20 nach Westen.', 'Betrete die östliche Höhle der Seeschauminseln.', 'Schiebe Felsen mit Stärke durch die Löcher, um die Strömung im Untergeschoss zu bremsen.', 'Verlasse die Höhle im Westen und surfe weiter zur Zinnoberinsel.'], voraussetzung: 'Alternativ kannst du später von Alabastia direkt über Route 21 zur Zinnoberinsel surfen.' },
  '6-3': { titel: 'Geheimschlüssel finden', ort: 'Zinnoberinsel · Pokémon-Haus, U1', x: 240, y: 455, beschreibung: 'Der Geheimschlüssel öffnet die verschlossene Arena der Zinnoberinsel.', weg: ['Betrete das verlassene Pokémon-Haus im Nordwesten der Insel.', 'Betätige die versteckten Schalter in den Mewtu-Statuen, um Türen umzuschalten.', 'Gehe bis in die 3. Etage und springe vom größeren linken Balkon hinunter.', 'Nimm die Treppe ins Untergeschoss und folge dem Gang in den nordwestlichen Raum.', 'Der Geheimschlüssel liegt dort auf einem Tisch.'] },
  '6-4': { titel: 'Pyro finden', ort: 'Zinnoberinsel · Pokémon-Arena', x: 240, y: 455, beschreibung: 'Pyros Arena befindet sich im Nordosten der Zinnoberinsel.', weg: ['Hole zuerst den Geheimschlüssel im Pokémon-Haus.', 'Öffne damit die zuvor verschlossene Arenatür.', 'Beantworte die Fragen an den Maschinen richtig oder kämpfe gegen die Trainer.', 'Folge den geöffneten Türen bis zu Pyro.'] },
  '7-0': { titel: 'Eiland-Abstecher abschließen', ort: 'Eiland Eins bis Drei', x: 125, y: 390, beschreibung: 'Bill wartet nach Pyro vor der Arena und nimmt dich mit zu den Sevii-Eilanden.', weg: ['Sprich nach dem Arenasieg vor der Arena mit Bill und fahre nach Eiland Eins.', 'Bringe den Meteoriten-Auftrag nach Eiland Zwei und suche anschließend Irrma auf Eiland Drei.', 'Gehe über die Bundbrücke zum Beerenforst und rette Irrma.', 'Kehre zu Bill auf Eiland Eins zurück, um wieder zur Zinnoberinsel zu fahren.'] },
  '7-2': { titel: 'Arena von Vertania öffnen', ort: 'Vertania City · Pokémon-Arena', x: 245, y: 355, beschreibung: 'Nach sieben Orden ist die lange geschlossene Arena endlich geöffnet.', weg: ['Kehre nach dem Eiland-Abstecher zur Zinnoberinsel zurück.', 'Surfe über Route 21 nach Norden bis Alabastia oder nutze Fliegen.', 'Reise weiter nach Vertania City und betrete die Arena im Nordosten.', 'Die Pfeilfelder führen dich durch die Arena zu Giovanni.'] },
  '7-4': { titel: 'Giovanni und der letzte Rivalenkampf', ort: 'Vertania City · danach Route 22', x: 245, y: 355, beschreibung: 'Nach Giovanni führt der Weg zur Pokémon-Liga westlich aus Vertania City.', weg: ['Besiege Giovanni in der Arena und erhalte den Erdorden.', 'Heile dein Team und verlasse Vertania City nach Westen auf Route 22.', 'Der Rivale fordert dich auf dem Weg zum Liga-Tor noch einmal heraus.', 'Gehe danach weiter nach Westen und anschließend nach Norden zu Route 23.'] },
  '8-0': { titel: 'Route 23 und Siegesstraße', ort: 'Pokémon-Liga-Tor · Siegesstraße', x: 145, y: 150, beschreibung: 'Der letzte Weg zur Liga beginnt westlich von Vertania City.', weg: ['Gehe über Route 22 zum großen Liga-Tor.', 'Zeige an den Kontrollpunkten nacheinander alle acht Orden vor.', 'Nutze Surfer auf Route 23 und betrete im Norden die Siegesstraße.', 'Schiebe die großen Felsen mit Stärke auf die Bodenschalter, um die Sperren zu öffnen.', 'Der Ausgang führt zum Indigo-Plateau.'], voraussetzung: 'Alle acht Orden sowie Surfer und Stärke werden benötigt.' },
  '8-4': { titel: 'Lorelei finden', ort: 'Indigo-Plateau · erster Top-4-Raum', x: 120, y: 120, beschreibung: 'Lorelei ist das erste Mitglied der Top 4.', weg: ['Heile und bereite dein endgültiges Team im Indigo-Plateau vor.', 'Kaufe alles Nötige, bevor du die große Tür betrittst.', 'Nach dem Betreten führt der Weg direkt in Loreleis Raum.'], voraussetzung: 'Nach Beginn der Top 4 kannst du nicht mehr zum Pokémon-Center zurück, ohne zu gewinnen oder zu verlieren.' },
  '9-4': { titel: 'Bruno finden', ort: 'Indigo-Plateau · zweiter Top-4-Raum', x: 120, y: 120, beschreibung: 'Bruno wartet direkt hinter Loreleis Raum.', weg: ['Wende Verluste und eure Heilregeln nach Lorelei an.', 'Gehe durch die hintere Tür ihres Raumes.', 'Folge dem kurzen Gang bis zu Bruno.'] },
  '10-4': { titel: 'Agathe finden', ort: 'Indigo-Plateau · dritter Top-4-Raum', x: 120, y: 120, beschreibung: 'Agathe ist das dritte Mitglied der Top 4.', weg: ['Prüfe nach Bruno sofort Teamstatus und Item-Zähler.', 'Gehe durch die hintere Tür in den nächsten Raum.', 'Agathe wartet am Ende des kurzen Weges.'] },
  '11-4': { titel: 'Siegfried finden', ort: 'Indigo-Plateau · vierter Top-4-Raum', x: 120, y: 120, beschreibung: 'Siegfried ist das letzte Mitglied vor dem Champ.', weg: ['Gehe nach Agathe durch die hintere Tür.', 'Folge dem Gang in den Drachen-Raum.', 'Sprich mit Siegfried, wenn beide Teams bereit sind.'] },
  '12-4': { titel: 'Zum Champ', ort: 'Indigo-Plateau · Champ-Raum', x: 120, y: 120, beschreibung: 'Nach Siegfried wartet dein Rivale als amtierender Champ.', weg: ['Wende mögliche Verluste aus dem Siegfried-Kampf endgültig an.', 'Gehe durch die letzte Tür hinter Siegfried.', 'Bereite vor dem Ansprechen des Rivalen alle erlaubten Items und Start-Pokémon vor.', 'Besiege den Rivalen, um die Challenge abzuschließen.'] },
}

function KantoKarte({ info, nurLeuchten = false, markerAnzeigen = true }: { info: AbenteuerInfo; nurLeuchten?: boolean; markerAnzeigen?: boolean }) {
  const orte = [
    { name: 'Indigo', x: 120, y: 120, farbe: '#d8d8cf' },
    { name: 'Marmoria', x: 240, y: 210, farbe: '#9ca7a5' },
    { name: 'Azuria', x: 410, y: 180, farbe: '#68b6dc' },
    { name: 'Prismania', x: 350, y: 255, farbe: '#78b75d' },
    { name: 'Saffronia', x: 440, y: 270, farbe: '#e3bb48' },
    { name: 'Lavandia', x: 545, y: 255, farbe: '#a47abb' },
    { name: 'Vertania', x: 245, y: 355, farbe: '#70a96a' },
    { name: 'Orania', x: 405, y: 350, farbe: '#df9e49' },
    { name: 'Fuchsania', x: 400, y: 420, farbe: '#d783a8' },
    { name: 'Alabastia', x: 250, y: 420, farbe: '#e8e3d5' },
    { name: 'Zinnober', x: 240, y: 455, farbe: '#d75850' },
  ] as const
  const baeume = [
    [205, 238], [218, 248], [229, 235], [216, 225], [255, 165], [270, 153], [286, 164],
    [472, 178], [488, 185], [500, 198], [505, 318], [520, 326], [535, 337], [335, 383], [350, 392],
  ] as const
  const berge = [
    [145, 165], [165, 150], [185, 160], [275, 125], [295, 135], [315, 126], [505, 145], [525, 155], [565, 185],
  ] as const
  const routenNummern = [
    ['1', 247, 389], ['2', 240, 283], ['3', 280, 193], ['4', 365, 172], ['5', 425, 224], ['6', 423, 315],
    ['7', 392, 258], ['8', 500, 261], ['9', 466, 177], ['10', 526, 210], ['11', 474, 348], ['12–15', 561, 343],
    ['16–18', 330, 337], ['19', 397, 454], ['20', 315, 462], ['21', 247, 443], ['22', 205, 348], ['23', 145, 245],
    ['24–25', 438, 127],
  ] as const
  return (
    <div className="kanto-karte">
      <svg viewBox="0 0 700 500" role="img" aria-label={`Detaillierte Kanto-Karte im Feuerrot-Stil mit markiertem Ort: ${info.ort}`} shapeRendering="crispEdges">
        <defs>
          <pattern id="wasser-muster" width="32" height="24" patternUnits="userSpaceOnUse">
            <rect width="32" height="24" fill="#4e9db9" />
            <path d="M0 7h10v3h12V7h10M7 18h9v-3h10" fill="none" stroke="#78bdd0" strokeWidth="2" opacity=".7" />
          </pattern>
          <pattern id="gras-muster" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#cfe59a" />
            <path d="M3 15h3v-3m8-5h3V4" fill="none" stroke="#a9cc79" strokeWidth="2" opacity=".65" />
          </pattern>
          <filter id="karten-schatten"><feDropShadow dx="0" dy="5" stdDeviation="2" floodColor="#245d6f" floodOpacity=".38" /></filter>
        </defs>

        <rect width="700" height="500" fill="url(#wasser-muster)" />
        <path d="M86 68h112v24h54v25h82v22h72v-15h62v22h70v25h61v46h34v84h-29v46h-52v39h-52v37h-69v-19h-63v27h-54v-18h-57v-41h-34v-55h-31v-73h16v-69h-22v-64H86Z" fill="url(#gras-muster)" stroke="#397b65" strokeWidth="7" filter="url(#karten-schatten)" />
        <path d="M215 405h69v39h-17v25h-55v-20h-15v-28h18ZM296 437h42v22h-42ZM365 413h68v28h-68Z" fill="url(#gras-muster)" stroke="#397b65" strokeWidth="6" />
        <path d="M91 367h68v48H91Z" fill="#b9d781" stroke="#397b65" strokeWidth="6" />

        <g className="karten-routen" fill="none" strokeLinecap="square" strokeLinejoin="miter">
          <g stroke="#6e724d" strokeWidth="16">
            <path d="M250 420V355H240V210h80v-45h90v15M410 180v-45h58" />
            <path d="M410 180h30v90H350M440 270h105v-15M440 270l-35 80-5 70M405 350h75M545 255v90h-55l-90 75" />
            <path d="M350 255v75h-25v70l75 20M245 355h-35v-30h-45V210h75M165 210v-60h-45v-30" />
          </g>
          <g stroke="#e2c36f" strokeWidth="10">
            <path d="M250 420V355H240V210h80v-45h90v15M410 180v-45h58" />
            <path d="M410 180h30v90H350M440 270h105v-15M440 270l-35 80-5 70M405 350h75M545 255v90h-55l-90 75" />
            <path d="M350 255v75h-25v70l75 20M245 355h-35v-30h-45V210h75M165 210v-60h-45v-30" />
          </g>
        </g>

        <g className="wasser-routen" fill="none" stroke="#d9eff1" strokeWidth="4" strokeDasharray="7 6" opacity=".9">
          <path d="M250 420v35M240 455h75M315 455h85v-35M400 420v40" />
          <path d="M120 390h65" />
        </g>
        <g className="karten-tunnel" fill="none" stroke="#76624d" strokeWidth="4" strokeDasharray="3 5" opacity=".78">
          <path d="M255 220 390 338" />
        </g>

        <g className="karten-berge">
          {berge.map(([x, y], index) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}><path d="M-13 12 0-12l13 24Z" fill={index % 2 ? '#9a8362' : '#a89068'} stroke="#665a49" strokeWidth="3" /><path d="m-5-2 5-10 5 10-5-3Z" fill="#e7e0c8" /></g>)}
        </g>
        <g className="karten-baeume">
          {baeume.map(([x, y]) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}><rect x="-2" y="5" width="5" height="7" fill="#745b39" /><path d="M0-12 11 5H5l7 7h-24l7-7h-6Z" fill="#4f9455" stroke="#347243" strokeWidth="2" /></g>)}
        </g>

        <g className="karten-landmarken">
          <g transform="translate(320 165)"><rect x="-11" y="-9" width="22" height="18" fill="#816e5d" stroke="#514a42" strokeWidth="3" /><path d="m-8-2 8-9 8 9Z" fill="#b5a18b" /><text x="0" y="-17">Mondberg</text></g>
          <g transform="translate(520 195)"><rect x="-10" y="-8" width="20" height="16" fill="#756a60" stroke="#4e4944" strokeWidth="3" /><circle cx="0" cy="3" r="4" fill="#322f2d" /><text x="0" y="-15">Felstunnel</text></g>
          <g transform="translate(580 205)"><path d="M-10 9h20V-7H3v-7h-6v7h-7Z" fill="#c8c5b4" stroke="#575d58" strokeWidth="3" /><path d="m-2-9 5-9 2 7 7-2-7 10" fill="none" stroke="#e4bd38" strokeWidth="3" /><text x="0" y="18">Kraftwerk</text></g>
          <g transform="translate(386 390)"><rect x="-15" y="-10" width="30" height="20" fill="#70a659" stroke="#3a7142" strokeWidth="3" /><path d="M-10 5V-5h7V5m6 0V-5h7V5" fill="#b9dd84" /><text x="0" y="-17">Safari-Zone</text></g>
          <g transform="translate(215 258)"><text x="0" y="0">Vertania-Wald</text></g>
          <g transform="translate(326 293)"><text x="0" y="0">Digda-Höhle</text></g>
          <g transform="translate(315 455)"><path d="M-20 8-8-8 0 3 9-10 21 8Z" fill="#87aa8b" stroke="#3e766d" strokeWidth="4" /><text x="0" y="22">Seeschaum</text></g>
          <g transform="translate(125 390)"><path d="M-24 5h14l6-18L4 5h20v15h-48Z" fill="#cfe59a" stroke="#397b65" strokeWidth="4" /><text x="0" y="34">Sevii-Eilande</text></g>
        </g>

        <g className="routen-nummern">{routenNummern.map(([name, x, y]) => <text x={x} y={y} key={name}>{name}</text>)}</g>
        <g className="karten-orte">{orte.map(({ name, x, y, farbe }) => <g key={name}><rect x={x - 9} y={y - 9} width="18" height="18" fill="#f7f0cf" stroke="#304d43" strokeWidth="4" /><rect x={x - 5} y={y - 5} width="10" height="10" fill={farbe} /><text x={x} y={y - 16} textAnchor="middle">{name}</text></g>)}</g>
        {markerAnzeigen && <g className={`karten-marker ${nurLeuchten ? 'karten-marker--nur-leuchten' : ''}`}><circle cx={info.x} cy={info.y} r="24" />{!nurLeuchten && <><circle cx={info.x} cy={info.y} r="9" /><path d={`M${info.x} ${info.y + 25}l-10 18h20Z`} /></>}</g>}
      </svg>
      <div><span>MARKIERTER ORT</span><strong>{info.ort}</strong><small>Detailkarte im Feuerrot-Stil – die genaue Schrittfolge steht weiterhin beim Info-Knopf.</small></div>
    </div>
  )
}

function AbenteuerPlan({ zurueck }: { zurueck: () => void }) {
  const startIndex = (() => {
    const eigener = localStorage.getItem('feuerrot-abenteuer-etappe')
    const arena = localStorage.getItem('feuerrot-arenen-fortschritt')
    const wert = Number(eigener ?? arena ?? 0)
    return Number.isInteger(wert) && wert >= 0 && wert < ABENTEUER_ETAPPEN.length ? wert : 0
  })()
  const [etappeIndex, setEtappeIndex] = useState(startIndex)
  const [erledigt, setErledigt] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('feuerrot-abenteuer-checkliste') ?? '{}') as Record<string, boolean> }
    catch { return {} }
  })
  const [popup, setPopup] = useState<{ schluessel: string; ansicht: 'info' | 'karte' } | null>(null)
  const etappe = ABENTEUER_ETAPPEN[etappeIndex]
  const schluessel = (punktIndex: number) => `${etappeIndex}-${punktIndex}`
  const fertigInEtappe = etappe.punkte.filter((_, index) => erledigt[schluessel(index)]).length
  const allePunkte = ABENTEUER_ETAPPEN.reduce((summe, eintrag) => summe + eintrag.punkte.length, 0)
  const gesamtFertig = Object.entries(erledigt).filter(([key, wert]) => wert && /^\d+-\d+$/.test(key)).length

  useEffect(() => { localStorage.setItem('feuerrot-abenteuer-etappe', String(etappeIndex)) }, [etappeIndex])
  useEffect(() => { localStorage.setItem('feuerrot-abenteuer-checkliste', JSON.stringify(erledigt)) }, [erledigt])
  useEffect(() => {
    if (!popup) return
    const schliessen = (event: KeyboardEvent) => { if (event.key === 'Escape') setPopup(null) }
    window.addEventListener('keydown', schliessen)
    return () => window.removeEventListener('keydown', schliessen)
  }, [popup])

  function wechseln(index: number) {
    setEtappeIndex(index)
    window.scrollTo({ top: 300, behavior: 'smooth' })
  }

  function alsFortschrittSetzen() {
    localStorage.setItem('feuerrot-arenen-fortschritt', String(etappeIndex))
  }

  return (
    <main className="abenteuer-seite">
      <header className="abenteuer-kopf"><button className="zurueck" onClick={zurueck}>← Startseite</button><span className="edition">FEUERROT · SOULLINK-ABENTEUERPLAN</span><h1>Von Arena zu Arena.</h1><p>Ein überschaubarer roter Faden durch Kanto. Hake die wichtigsten Schritte ab und behalte Regeln, Begegnungen und Level-Caps im Blick.</p></header>
      <section className="abenteuer-inhalt">
        <div className="abenteuer-gesamt"><div><small>GESAMTFORTSCHRITT</small><strong>{gesamtFertig} von {allePunkte} Schritten</strong></div><span><i style={{ width: `${(gesamtFertig / allePunkte) * 100}%` }} /></span></div>
        <nav className="etappen-leiste" aria-label="Abenteuerabschnitt auswählen">{ABENTEUER_ETAPPEN.map((eintrag, index) => { const fertig = eintrag.punkte.every((_, punkt) => erledigt[`${index}-${punkt}`]); return <button className={`${etappeIndex === index ? 'aktiv' : ''} ${fertig ? 'fertig' : ''}`} key={eintrag.name} onClick={() => wechseln(index)}>{index < 8 ? <OrdenSymbol index={index} /> : <LigaSymbol index={index - 8} />}<small>{eintrag.name}</small></button> })}</nav>
        <article className="etappe-karte">
          <header><div><span>ABSCHNITT {String(etappeIndex + 1).padStart(2, '0')}</span><h2>{etappe.name}: {etappe.ziel}</h2><p>{etappe.fokus}</p></div><div className="etappe-cap"><small>LEVEL-CAP</small><strong>{etappe.cap}</strong><button onClick={alsFortschrittSetzen}>Als aktuellen Fortschritt übernehmen</button></div></header>
          <div className="etappe-fortschritt"><span><i style={{ width: `${(fertigInEtappe / etappe.punkte.length) * 100}%` }} /></span><strong>{fertigInEtappe} / {etappe.punkte.length} erledigt</strong></div>
          <div className="etappe-checkliste">{etappe.punkte.map((punkt, index) => { const key = schluessel(index); const info = ABENTEUER_INFOS[key]; return <div className={`etappe-punkt ${erledigt[key] ? 'erledigt' : ''}`} key={punkt}><label><input type="checkbox" checked={Boolean(erledigt[key])} onChange={() => setErledigt((aktuell) => ({ ...aktuell, [key]: !aktuell[key] }))} /><span><i>✓</i><b>{String(index + 1).padStart(2, '0')}</b></span><p>{punkt}</p></label>{info && <div className="etappe-punkt__hilfen"><button className="etappe-info-knopf" onClick={() => setPopup({ schluessel: key, ansicht: 'info' })} title="Wegbeschreibung öffnen" aria-label={`Wegbeschreibung zu ${info.titel} öffnen`}>i</button><button className="etappe-karte-knopf" onClick={() => setPopup({ schluessel: key, ansicht: 'karte' })} title="Ort auf der Karte zeigen" aria-label={`${info.ort} auf der Karte zeigen`}>⌖</button></div>}</div> })}</div>
          <div className="etappe-navigation"><button onClick={() => wechseln(Math.max(0, etappeIndex - 1))} disabled={etappeIndex === 0}>← Vorheriger Abschnitt</button><button onClick={() => wechseln(Math.min(ABENTEUER_ETAPPEN.length - 1, etappeIndex + 1))} disabled={etappeIndex === ABENTEUER_ETAPPEN.length - 1}>Nächster Abschnitt →</button></div>
        </article>
      </section>
      {popup && ABENTEUER_INFOS[popup.schluessel] && (() => { const info = ABENTEUER_INFOS[popup.schluessel]; return <div className="abenteuer-popup" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPopup(null) }}><section role="dialog" aria-modal="true" aria-labelledby="abenteuer-popup-titel"><button className="abenteuer-popup__schliessen" onClick={() => setPopup(null)} aria-label="Fenster schließen">×</button><header><span>{popup.ansicht === 'info' ? 'WEGBESCHREIBUNG' : 'KANTO-KARTE'}</span><h2 id="abenteuer-popup-titel">{info.titel}</h2><p>{info.ort}</p></header><div className="abenteuer-popup__wechsel"><button className={popup.ansicht === 'info' ? 'aktiv' : ''} onClick={() => setPopup({ ...popup, ansicht: 'info' })}>i&nbsp; Info</button><button className={popup.ansicht === 'karte' ? 'aktiv' : ''} onClick={() => setPopup({ ...popup, ansicht: 'karte' })}>⌖&nbsp; Karte</button></div>{popup.ansicht === 'info' ? <div className="abenteuer-popup__info"><p>{info.beschreibung}</p><ol>{info.weg.map((schritt) => <li key={schritt}>{schritt}</li>)}</ol>{info.voraussetzung && <aside><strong>Wichtig</strong><span>{info.voraussetzung}</span></aside>}</div> : <KantoKarte info={info} />}</section></div> })()}
    </main>
  )
}

type EncounterGebiet = { id: string; name: string; level: string; hinweis?: string }
type EncounterAbschnitt = { titel: string; untertitel: string; gebiete: EncounterGebiet[] }

const ENCOUNTER_ABSCHNITTE: EncounterAbschnitt[] = [
  { titel: 'Der erste Orden', untertitel: 'Alabastia bis Marmoria City', gebiete: [
    { id: 'route-1', name: 'Route 1', level: '2–5' }, { id: 'route-22-frueh', name: 'Route 22', level: '2–5', hinweis: 'Optional vor dem ersten Orden' },
    { id: 'route-2-sued', name: 'Route 2', level: '2–5' }, { id: 'vertania-wald', name: 'Vertania-Wald', level: '3–6' },
  ]},
  { titel: 'Zum zweiten Orden', untertitel: 'Marmoria City bis Azuria City', gebiete: [
    { id: 'route-3', name: 'Route 3', level: '6–8' }, { id: 'mondberg', name: 'Mondberg', level: '6–12' },
    { id: 'route-4', name: 'Route 4', level: '6–12' },
  ]},
  { titel: 'Zum dritten Orden', untertitel: 'Azuria City bis Orania City', gebiete: [
    { id: 'route-24', name: 'Route 24', level: '7–13' }, { id: 'route-25', name: 'Route 25', level: '7–13' },
    { id: 'route-5', name: 'Route 5', level: '13–16' }, { id: 'route-6', name: 'Route 6', level: '13–16' },
    { id: 'ms-anne', name: 'M.S. Anne', level: '15–25', hinweis: 'Nur Angeln; vor dem Ablegen erledigen' },
    { id: 'digda-hoehle', name: 'Digda-Höhle', level: '15–31' }, { id: 'route-11', name: 'Route 11', level: '13–15' },
  ]},
  { titel: 'Zum vierten Orden', untertitel: 'Orania City bis Prismania City', gebiete: [
    { id: 'route-9', name: 'Route 9', level: '11–17' }, { id: 'route-10-nord', name: 'Route 10 (Nord)', level: '11–17' },
    { id: 'felstunnel', name: 'Felstunnel', level: '15–18' }, { id: 'route-10-sued', name: 'Route 10 (Süd)', level: '11–17', hinweis: 'Gleiches Routengebiet wie Route 10 Nord' },
    { id: 'route-8', name: 'Route 8', level: '18–22' }, { id: 'route-7', name: 'Route 7', level: '19–22' },
  ]},
  { titel: 'Pokéflöte und Fuchsania', untertitel: 'Lavandia, Küstenrouten und Safari-Zone', gebiete: [
    { id: 'pokemon-turm', name: 'Pokémon-Turm', level: '13–19' }, { id: 'route-12', name: 'Route 12', level: '22–27' },
    { id: 'route-13', name: 'Route 13', level: '22–27' }, { id: 'route-14', name: 'Route 14', level: '22–30' },
    { id: 'route-15', name: 'Route 15', level: '22–30' }, { id: 'route-16', name: 'Route 16', level: '18–25' },
    { id: 'route-17', name: 'Route 17', level: '20–29' }, { id: 'route-18', name: 'Route 18', level: '22–29' },
    { id: 'safari-mitte', name: 'Safari-Zone: Eingang/Mitte', level: '22–25' }, { id: 'safari-ost', name: 'Safari-Zone: Gebiet 1 (Ost)', level: '22–26' },
    { id: 'safari-nord', name: 'Safari-Zone: Gebiet 2 (Nord)', level: '22–30' }, { id: 'safari-west', name: 'Safari-Zone: Gebiet 3 (West)', level: '23–30' },
  ]},
  { titel: 'Surfer-Gebiete', untertitel: 'Nach Erhalt von VM03 Surfer', gebiete: [
    { id: 'route-19', name: 'Route 19', level: '5–40' }, { id: 'route-20', name: 'Route 20', level: '5–40' },
    { id: 'seeschauminseln', name: 'Seeschauminseln', level: '22–36' }, { id: 'route-21', name: 'Route 21', level: '5–40' },
    { id: 'kraftwerk', name: 'Kraftwerk', level: '21–35' }, { id: 'alabastia-wasser', name: 'Alabastia (Wasser)', level: '5–40', hinweis: 'Angeln/Surfen zählt nur separat, wenn eure Regeln das erlauben' },
  ]},
  { titel: 'Siebter und achter Orden', untertitel: 'Zinnoberinsel bis Vertania City', gebiete: [
    { id: 'pokemon-haus', name: 'Pokémon-Haus', level: '28–35' }, { id: 'schatzstrand', name: 'Schatzgestade', level: '5–40' },
    { id: 'gluehweg', name: 'Glühweg', level: '30–40' }, { id: 'glutberg', name: 'Glutberg', level: '30–40' },
    { id: 'kap-kante', name: 'Kap Kante', level: '5–40' }, { id: 'dreierinsel-hafen', name: 'Dreierinsel-Hafen', level: '5–40' },
    { id: 'bundbruecke', name: 'Bundbrücke', level: '29–35' }, { id: 'beerenforst', name: 'Beerenforst', level: '30–40' },
  ]},
  { titel: 'Pokémon-Liga', untertitel: 'Vom Erdorden bis zum Champ', gebiete: [
    { id: 'route-22-spaet', name: 'Route 22 (Rückkehr)', level: '2–5', hinweis: 'Gleiches Routengebiet wie Route 22 früh' },
    { id: 'route-23', name: 'Route 23', level: '26–43' }, { id: 'siegesstrasse', name: 'Siegesstraße', level: '32–46' },
  ]},
  { titel: 'Nach dem Champ', untertitel: 'Optionale und Sevii-Nachspiel-Gebiete', gebiete: [
    { id: 'azuria-hoehle', name: 'Azuria-Höhle', level: '46–67' }, { id: 'viererinsel', name: 'Viererinsel', level: '5–40' },
    { id: 'eiskaskadenhoehle', name: 'Eiskaskadenhöhle', level: '38–52' }, { id: 'fuenferinsel', name: 'Fünferinsel', level: '5–40' },
    { id: 'gedenksaeule', name: 'Gedenksäule', level: '44–50' }, { id: 'wasserweg', name: 'Wasserweg', level: '44–50' },
    { id: 'verlorene-hoehle', name: 'Verlorene Höhle', level: '49–55' }, { id: 'sechserinsel', name: 'Sechserinsel', level: '5–40' },
    { id: 'gruenpfad', name: 'Grünpfad', level: '44–50' }, { id: 'musterbuschwald', name: 'Musterbuschwald', level: '49–52' },
    { id: 'ruinental', name: 'Ruinental', level: '49–52' }, { id: 'siebenerinsel', name: 'Siebenerinsel', level: '5–40' },
    { id: 'trainerschlucht', name: 'Trainerschlucht', level: '50–55' }, { id: 'schatzschlucht', name: '7-Schatzschlucht', level: '50–55' },
  ]},
]

type EncounterKartenOrt = { id: string; name: string; x: number; y: number; gebiete: string[]; art: 'stadt' | 'route' | 'gebiet' | 'hoehle' }

const ENCOUNTER_KARTEN_ORTE: EncounterKartenOrt[] = [
  { id: 'stadt-alabastia', name: 'Alabastia', x: 250, y: 420, gebiete: ['route-1', 'route-21', 'alabastia-wasser'], art: 'stadt' },
  { id: 'stadt-vertania', name: 'Vertania', x: 245, y: 355, gebiete: ['route-1', 'route-2-sued', 'route-22-frueh'], art: 'stadt' },
  { id: 'stadt-marmoria', name: 'Marmoria', x: 240, y: 210, gebiete: ['route-2-sued', 'vertania-wald', 'route-3'], art: 'stadt' },
  { id: 'stadt-azuria', name: 'Azuria', x: 410, y: 180, gebiete: ['route-4', 'route-5', 'route-24', 'route-25', 'azuria-hoehle'], art: 'stadt' },
  { id: 'stadt-prismania', name: 'Prismania', x: 350, y: 255, gebiete: ['route-7', 'route-16'], art: 'stadt' },
  { id: 'stadt-saffronia', name: 'Saffronia', x: 440, y: 270, gebiete: ['route-5', 'route-6', 'route-7', 'route-8'], art: 'stadt' },
  { id: 'stadt-lavandia', name: 'Lavandia', x: 545, y: 255, gebiete: ['route-8', 'route-10-sued', 'route-12', 'pokemon-turm'], art: 'stadt' },
  { id: 'stadt-orania', name: 'Orania', x: 405, y: 350, gebiete: ['route-6', 'route-11', 'ms-anne', 'digda-hoehle'], art: 'stadt' },
  { id: 'stadt-fuchsania', name: 'Fuchsania', x: 400, y: 420, gebiete: ['route-15', 'route-18', 'route-19', 'safari-mitte'], art: 'stadt' },
  { id: 'stadt-zinnober', name: 'Zinnober', x: 240, y: 455, gebiete: ['route-20', 'route-21', 'pokemon-haus'], art: 'stadt' },
  { id: 'route-1-punkt', name: 'Route 1', x: 248, y: 389, gebiete: ['route-1', 'route-2-sued', 'route-22-frueh'], art: 'route' },
  { id: 'route-2-punkt', name: 'Route 2', x: 240, y: 283, gebiete: ['route-2-sued', 'vertania-wald', 'route-1', 'route-3'], art: 'route' },
  { id: 'route-3-punkt', name: 'Route 3', x: 280, y: 193, gebiete: ['route-3', 'mondberg', 'route-4'], art: 'route' },
  { id: 'route-4-punkt', name: 'Route 4', x: 365, y: 172, gebiete: ['route-4', 'mondberg', 'route-24', 'route-25'], art: 'route' },
  { id: 'route-5-punkt', name: 'Route 5', x: 425, y: 224, gebiete: ['route-5', 'route-24', 'route-25', 'route-6', 'route-7', 'route-8'], art: 'route' },
  { id: 'route-6-punkt', name: 'Route 6', x: 423, y: 315, gebiete: ['route-6', 'route-5', 'route-11', 'ms-anne'], art: 'route' },
  { id: 'route-7-punkt', name: 'Route 7', x: 392, y: 258, gebiete: ['route-7', 'route-8', 'route-16'], art: 'route' },
  { id: 'route-8-punkt', name: 'Route 8', x: 500, y: 261, gebiete: ['route-8', 'route-7', 'pokemon-turm', 'route-12'], art: 'route' },
  { id: 'route-9-punkt', name: 'Route 9', x: 466, y: 177, gebiete: ['route-9', 'route-10-nord', 'felstunnel', 'kraftwerk'], art: 'route' },
  { id: 'route-10-punkt', name: 'Route 10', x: 526, y: 210, gebiete: ['route-10-nord', 'felstunnel', 'route-10-sued', 'kraftwerk'], art: 'route' },
  { id: 'route-11-punkt', name: 'Route 11', x: 474, y: 348, gebiete: ['route-11', 'digda-hoehle', 'route-12', 'ms-anne'], art: 'route' },
  { id: 'route-12-punkt', name: 'Route 12', x: 552, y: 300, gebiete: ['route-12', 'route-11', 'route-13', 'pokemon-turm'], art: 'route' },
  { id: 'route-13-punkt', name: 'Route 13', x: 548, y: 340, gebiete: ['route-13', 'route-12', 'route-14'], art: 'route' },
  { id: 'route-14-punkt', name: 'Route 14', x: 510, y: 365, gebiete: ['route-14', 'route-13', 'route-15'], art: 'route' },
  { id: 'route-15-punkt', name: 'Route 15', x: 465, y: 392, gebiete: ['route-15', 'route-14', 'safari-ost', 'safari-mitte'], art: 'route' },
  { id: 'route-16-punkt', name: 'Route 16', x: 330, y: 300, gebiete: ['route-16', 'route-7', 'route-17'], art: 'route' },
  { id: 'route-17-punkt', name: 'Route 17', x: 325, y: 350, gebiete: ['route-17', 'route-16', 'route-18'], art: 'route' },
  { id: 'route-18-punkt', name: 'Route 18', x: 355, y: 405, gebiete: ['route-18', 'route-17', 'safari-west', 'safari-mitte'], art: 'route' },
  { id: 'route-19-punkt', name: 'Route 19', x: 397, y: 454, gebiete: ['route-19', 'route-20', 'safari-mitte'], art: 'route' },
  { id: 'route-20-punkt', name: 'Route 20', x: 315, y: 462, gebiete: ['route-20', 'route-19', 'seeschauminseln', 'pokemon-haus'], art: 'route' },
  { id: 'route-21-punkt', name: 'Route 21', x: 247, y: 443, gebiete: ['route-21', 'alabastia-wasser', 'pokemon-haus'], art: 'route' },
  { id: 'route-22-punkt', name: 'Route 22', x: 205, y: 348, gebiete: ['route-22-frueh', 'route-22-spaet', 'route-23'], art: 'route' },
  { id: 'route-23-punkt', name: 'Route 23', x: 145, y: 245, gebiete: ['route-23', 'route-22-spaet', 'siegesstrasse'], art: 'route' },
  { id: 'route-24-punkt', name: 'Route 24', x: 410, y: 145, gebiete: ['route-24', 'route-25', 'route-4'], art: 'route' },
  { id: 'route-25-punkt', name: 'Route 25', x: 468, y: 127, gebiete: ['route-25', 'route-24', 'route-4'], art: 'route' },
  { id: 'gebiet-mondberg', name: 'Mondberg', x: 320, y: 165, gebiete: ['mondberg', 'route-3', 'route-4'], art: 'hoehle' },
  { id: 'gebiet-felstunnel', name: 'Felstunnel', x: 520, y: 195, gebiete: ['felstunnel', 'route-10-nord', 'route-10-sued'], art: 'hoehle' },
  { id: 'gebiet-kraftwerk', name: 'Kraftwerk', x: 580, y: 205, gebiete: ['kraftwerk', 'route-9', 'route-10-nord'], art: 'gebiet' },
  { id: 'gebiet-safari', name: 'Safari-Zone', x: 386, y: 390, gebiete: ['safari-mitte', 'safari-ost', 'safari-nord', 'safari-west'], art: 'gebiet' },
  { id: 'gebiet-seeschaum', name: 'Seeschauminseln', x: 315, y: 450, gebiete: ['seeschauminseln', 'route-19', 'route-20'], art: 'hoehle' },
  { id: 'gebiet-indigo', name: 'Indigo-Plateau', x: 120, y: 120, gebiete: ['route-23', 'siegesstrasse'], art: 'gebiet' },
  { id: 'gebiet-sevii', name: 'Sevii-Eilande', x: 125, y: 390, gebiete: ['schatzstrand', 'gluehweg', 'glutberg', 'kap-kante', 'dreierinsel-hafen', 'bundbruecke', 'beerenforst'], art: 'gebiet' },
]

function BegegnungsTracker({ zurueck }: { zurueck: () => void }) {
  const [erledigt, setErledigt] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('feuerrot-encounter-checkliste') ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const [aktiverAbschnitt, setAktiverAbschnitt] = useState(0)
  const [kartenOrt, setKartenOrt] = useState<EncounterKartenOrt | null>(null)

  useEffect(() => {
    localStorage.setItem('feuerrot-encounter-checkliste', JSON.stringify(erledigt))
  }, [erledigt])

  const alleGebiete = ENCOUNTER_ABSCHNITTE.flatMap((abschnitt) => abschnitt.gebiete)
  const anzahlErledigt = alleGebiete.filter((gebiet) => erledigt[gebiet.id]).length
  const prozent = Math.round((anzahlErledigt / alleGebiete.length) * 100)
  const gebietNachId = new Map(alleGebiete.map((gebiet) => [gebiet.id, gebiet]))
  const naheGebiete = kartenOrt?.gebiete.map((id) => gebietNachId.get(id)).filter((gebiet): gebiet is EncounterGebiet => Boolean(gebiet)) ?? []
  const kartenInfo: AbenteuerInfo = { titel: kartenOrt?.name ?? 'Kanto', ort: kartenOrt?.name ?? 'Wähle einen Ort oder eine Route', x: kartenOrt?.x ?? 350, y: kartenOrt?.y ?? 255, beschreibung: '', weg: [] }

  function ortWaehlen(ort: EncounterKartenOrt) {
    setKartenOrt(ort)
    const erstesGebiet = ort.gebiete.find((id) => gebietNachId.has(id))
    const abschnitt = ENCOUNTER_ABSCHNITTE.findIndex((eintrag) => eintrag.gebiete.some((gebiet) => gebiet.id === erstesGebiet))
    if (abschnitt >= 0) setAktiverAbschnitt(abschnitt)
  }

  return (
    <main className="begegnungen-seite">
      <header className="begegnungen-kopf">
        <button className="zurueck" onClick={zurueck}>← Startseite</button>
        <span className="edition">FEUERROT · ENCOUNTER-CHECKLISTE</span>
        <h1>Jedes Fanggebiet. In richtiger Reihenfolge.</h1>
        <p>Hake ein Gebiet ab, sobald euer Erstbegegnungs-Versuch abgeschlossen ist. Die Level zeigen die Spanne der regulären Feuerrot-Begegnungen vor dem Randomisieren.</p>
      </header>

      <section className="begegnungen-inhalt">
        <div className="encounter-fortschritt">
          <div><strong>{anzahlErledigt} / {alleGebiete.length}</strong><span>Gebiete erledigt</span></div>
          <div className="encounter-balken"><i style={{ width: `${prozent}%` }} /></div>
          <b>{prozent}%</b>
        </div>
        <section className="encounter-karte">
          <header><div><span>INTERAKTIVE KARTE</span><h2>Wo bist du gerade?</h2><p>Klicke auf den nächstgelegenen Ort. Die passenden Fanggebiete erscheinen direkt daneben.</p></div><b>{kartenOrt?.name ?? 'Ort wählen'}</b></header>
          <div className="encounter-karte__layout">
            <div className="encounter-feuerrot-karte" role="group" aria-label="Anklickbare Feuerrot-Karte von Kanto mit Städten und Routen">
              <KantoKarte info={kartenInfo} nurLeuchten markerAnzeigen={Boolean(kartenOrt)} />
              <div className="encounter-kartenpunkte">{ENCOUNTER_KARTEN_ORTE.map((ort) => <button key={ort.id} className={`${ort.art} ${kartenOrt?.id === ort.id ? 'aktiv' : ''} ${ort.gebiete.every((id) => erledigt[id]) ? 'fertig' : ''}`} style={{ left: `${(ort.x / 700) * 100}%`, top: `${(ort.y / 500) * 100}%` }} onClick={() => ortWaehlen(ort)} title={`${ort.name} auswählen`} aria-label={`${ort.name}: Begegnungen in der Nähe anzeigen`}><span>{ort.name}</span></button>)}</div>
            </div>
            <div className="encounter-naehe">
              <div className="encounter-naehe__kopf"><span>ENCOUNTER IN DER NÄHE</span><strong>{kartenOrt ? `${naheGebiete.length} Gebiete bei ${kartenOrt.name}` : 'Wähle einen Ort auf der Karte'}</strong></div>
              {kartenOrt ? <div>{naheGebiete.map((gebiet) => <label className={`encounter-naehe__zeile ${erledigt[gebiet.id] ? 'erledigt' : ''}`} key={gebiet.id}><input type="checkbox" checked={Boolean(erledigt[gebiet.id])} onChange={() => setErledigt((aktuell) => ({ ...aktuell, [gebiet.id]: !aktuell[gebiet.id] }))} /><i>{erledigt[gebiet.id] ? '✓' : ''}</i><span><strong>{gebiet.name}</strong><small>Lv. {gebiet.level}</small></span><b>{erledigt[gebiet.id] ? 'ERLEDIGT' : 'OFFEN'}</b></label>)}</div> : <p className="encounter-naehe__leer">Klicke direkt auf eine Stadt, eine Route oder ein besonderes Gebiet. Grüne Punkte sind vollständig erledigt.</p>}
            </div>
          </div>
        </section>
        <div className="encounter-auswahl">
          <label htmlFor="encounter-abschnitt">Orden oder Storyabschnitt</label>
          <select id="encounter-abschnitt" value={aktiverAbschnitt} onChange={(event) => setAktiverAbschnitt(Number(event.target.value))}>
            {ENCOUNTER_ABSCHNITTE.map((abschnitt, index) => {
              const erledigteGebiete = abschnitt.gebiete.filter((gebiet) => erledigt[gebiet.id]).length
              return <option value={index} key={abschnitt.titel}>{abschnitt.titel} · {erledigteGebiete}/{abschnitt.gebiete.length}</option>
            })}
          </select>
        </div>
        {(() => {
          const abschnitt = ENCOUNTER_ABSCHNITTE[aktiverAbschnitt]
          return <div className="encounter-abschnitte"><section className="encounter-abschnitt" key={abschnitt.titel}><header><span className="encounter-abschnitt__symbol">{aktiverAbschnitt < 8 ? <OrdenSymbol index={aktiverAbschnitt} /> : <LigaSymbol index={4} />}</span><div><h2>{abschnitt.titel}</h2><p>{abschnitt.untertitel}</p></div></header><div>{abschnitt.gebiete.map((gebiet) => <label className={`encounter-zeile ${erledigt[gebiet.id] ? 'erledigt' : ''}`} key={gebiet.id}><input type="checkbox" checked={Boolean(erledigt[gebiet.id])} onChange={() => setErledigt((aktuell) => ({ ...aktuell, [gebiet.id]: !aktuell[gebiet.id] }))} /><i aria-hidden="true">✓</i><span><strong>{gebiet.name}</strong>{gebiet.hinweis && <small>{gebiet.hinweis}</small>}</span><b>Lv. {gebiet.level}</b></label>)}</div></section></div>
        })()}
        <p className="encounter-hinweis">Hinweis: Bereiche mit Angeln und Surfen können eine große Levelspanne haben. Ob Wasser und Gras als getrennte Begegnungen zählen, richtet sich nach eurem SoulLink-Regelwerk.</p>
      </section>
    </main>
  )
}

type CapMitglied = {
  token: string
  id: number
  level: number
  slot: number
  limit: number
  capPokemon: boolean
  eigeneUeberschreitung: boolean
  gesperrt: boolean
  partnerName: string
}

function CapTeam({ name, farbe, mitglieder, auswahl, onAuswahl }: { name: string; farbe: 'rot' | 'blau'; mitglieder: CapMitglied[]; auswahl: string; onAuswahl: (token: string) => void }) {
  return (
    <section className={`cap-team cap-team--${farbe}`}>
      <header><span className={`team-punkt team-punkt--${farbe}`} /><div><small>CAP-PRÜFUNG</small><h2>{name}</h2></div></header>
      <label className="cap-kandidat"><span>Dieses eine Pokémon darf bis zum hohen Cap</span><select value={auswahl} onChange={(event) => onAuswahl(event.target.value)}><option value="">Noch nicht festgelegt</option>{mitglieder.map((mitglied) => <option value={mitglied.token} key={mitglied.token}>Slot {mitglied.slot + 1}: {POKEMON[mitglied.id - 1].name}</option>)}</select></label>
      <div className="cap-mitglieder">
        {mitglieder.map((mitglied) => (
          <article className={`${mitglied.gesperrt ? 'cap-mitglied--gesperrt' : 'cap-mitglied--bereit'}`} key={mitglied.token}>
            <img src={BILD(mitglied.id)} alt={POKEMON[mitglied.id - 1].name} />
            <div><small>Slot {mitglied.slot + 1}{mitglied.capPokemon ? ' · Cap-Pokémon' : ''}</small><strong>{POKEMON[mitglied.id - 1].name}</strong><span>Seelenpartner: {mitglied.partnerName}</span></div>
            <dl><div><dt>Level</dt><dd>{mitglied.level}</dd></div><div><dt>Limit</dt><dd>{mitglied.limit}</dd></div></dl>
            <em>{mitglied.gesperrt ? (mitglied.eigeneUeberschreitung ? 'Über dem erlaubten Limit' : 'Seelenpartner über Limit') : 'Einsatzbereit'}</em>
          </article>
        ))}
      </div>
    </section>
  )
}

function CapWaechter({ zurueck, teamplanerOeffnen }: { zurueck: () => void; teamplanerOeffnen: () => void }) {
  const [paare] = useState<PokemonPaar[]>(gespeichertePaareLesen)
  const [namen] = useState(gespeicherteNamenLesen)
  const [capPokemon, setCapPokemon] = useState<{ rot: string; blau: string }>(() => {
    try { return JSON.parse(localStorage.getItem('feuerrot-cap-pokemon') ?? '{"rot":"","blau":""}') as { rot: string; blau: string } }
    catch { return { rot: '', blau: '' } }
  })
  const fortschrittText = localStorage.getItem('feuerrot-arenen-fortschritt')
  const fortschritt = fortschrittText === null ? null : Number(fortschrittText)
  const abschnitt = fortschritt !== null && ARENEN_FORTSCHRITT[fortschritt] ? ARENEN_FORTSCHRITT[fortschritt] : null

  useEffect(() => { localStorage.setItem('feuerrot-cap-pokemon', JSON.stringify(capPokemon)) }, [capPokemon])

  const aktiv = paare.filter((paar) => paar.aktiv && paar.slot !== null).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  const [hohesCap, niedrigesCap] = abschnitt ? abschnitt.cap.split(' / ').map(Number) : [0, 0]
  const paarPruefung = aktiv.map((paar) => {
    const tokenRot = `${paar.id}:links`
    const tokenBlau = `${paar.id}:rechts`
    const limitRot = capPokemon.rot === tokenRot ? hohesCap : niedrigesCap
    const limitBlau = capPokemon.blau === tokenBlau ? hohesCap : niedrigesCap
    const rotDrueber = paar.levelLinks > limitRot
    const blauDrueber = paar.levelRechts > limitBlau
    return { paar, tokenRot, tokenBlau, limitRot, limitBlau, rotDrueber, blauDrueber, gesperrt: rotDrueber || blauDrueber }
  })
  const blockiert = paarPruefung.filter((eintrag) => eintrag.gesperrt).length
  const rot: CapMitglied[] = paarPruefung.map(({ paar, tokenRot, limitRot, rotDrueber, gesperrt }) => ({ token: tokenRot, id: paar.links, level: paar.levelLinks, slot: paar.slot ?? 0, limit: limitRot, capPokemon: capPokemon.rot === tokenRot, eigeneUeberschreitung: rotDrueber, gesperrt, partnerName: POKEMON[paar.rechts - 1].name }))
  const blau: CapMitglied[] = paarPruefung.map(({ paar, tokenBlau, limitBlau, blauDrueber, gesperrt }) => ({ token: tokenBlau, id: paar.rechts, level: paar.levelRechts, slot: paar.slot ?? 0, limit: limitBlau, capPokemon: capPokemon.blau === tokenBlau, eigeneUeberschreitung: blauDrueber, gesperrt, partnerName: POKEMON[paar.links - 1].name }))

  return (
    <main className="cap-seite">
      <header className="cap-kopf"><button className="zurueck" onClick={zurueck}>← Startseite</button><span className="edition">REGEL 09 · LEVEL-CAP-WÄCHTER</span><h1>Trainieren, ohne zu überleveln.</h1><p>Der Wächter verbindet euren Arenenfortschritt mit den Leveln im Teamplaner und sperrt bei einem Verstoß automatisch das gesamte Seelenpaar.</p></header>
      <section className="cap-inhalt">
        {!abschnitt ? <div className="cap-leer"><strong>Noch kein Arenenfortschritt ausgewählt</strong><p>Wähle auf der Startseite zuerst die nächste Arena oder den nächsten Liga-Kampf.</p><button onClick={zurueck}>Zur Startseite</button></div>
        : !aktiv.length ? <div className="cap-leer"><strong>Noch kein aktives Team vorhanden</strong><p>Lege im Teamplaner zuerst mindestens ein aktives Seelenpaar an.</p><button onClick={teamplanerOeffnen}>Zum Teamplaner</button></div>
        : <>
          <div className="cap-uebersicht"><div><small>NÄCHSTER ABSCHNITT</small><strong>{abschnitt.name}</strong></div><div><small>MAXIMAL EIN POKÉMON</small><strong>Level {hohesCap}</strong></div><div><small>ÜBRIGES TEAM</small><strong>Level {niedrigesCap}</strong></div><div className={blockiert ? 'warnung' : 'bereit'}><small>SEELENPAARE</small><strong>{blockiert ? `${blockiert} gesperrt` : 'Alle bereit'}</strong></div></div>
          <p className="cap-hinweis">Wähle für jedes Team genau ein Cap-Pokémon. Alle anderen dürfen nur das niedrigere Level erreichen. Überschreitet eine Seite ihr Limit, wird das verbundene Paar auf beiden Seiten gesperrt.</p>
          <div className="cap-teams"><CapTeam name={namen.rot || 'Team Rot'} farbe="rot" mitglieder={rot} auswahl={capPokemon.rot} onAuswahl={(token) => setCapPokemon((aktuell) => ({ ...aktuell, rot: token }))} /><CapTeam name={namen.blau || 'Team Blau'} farbe="blau" mitglieder={blau} auswahl={capPokemon.blau} onAuswahl={(token) => setCapPokemon((aktuell) => ({ ...aktuell, blau: token }))} /></div>
        </>}
      </section>
    </main>
  )
}

type SoulLinkRegel = {
  titel: string
  symbol: string
  kurz: string
  details: string[]
  wichtig?: boolean
}

const SOULLINK_REGELN: SoulLinkRegel[] = [
  {
    titel: 'Erster Fang und Seelenpartner',
    symbol: '◎',
    wichtig: true,
    kurz: 'Pro Route oder Gebiet darf nur das erste Pokémon gefangen werden. Dieses Pokémon wird mit den Pokémon der Partner verbunden und ist deren Seelenpartner.',
    details: [
      'Pokémon, die bereits gefangen wurden – oder deren Evolutionsreihe – zählen nicht als Routen-Pokémon und dürfen neu ausgewürfelt werden.',
      'Der Fangpool wird individuell verkleinert. Ein Pikachu darf beispielsweise gefangen werden, obwohl ein Partner diesem Pokémon bereits begegnet ist.',
      'Geschenkte Pokémon, statische Pokémon und Fossilien gelten nicht als Gebiets-Pokémon und dürfen verwendet werden – auch wenn sie zuvor bereits gefangen wurden.',
      'Fossilien dürfen nur benutzt werden, wenn die Partner ebenfalls ein Fossil besitzen.',
    ],
  },
  {
    titel: 'Fehlgeschlagener Fangversuch',
    symbol: '×',
    wichtig: true,
    kurz: 'Flieht das Pokémon, stirbt es beim Fangversuch oder sind keine Pokébälle mehr vorhanden, darf in diesem Gebiet kein weiterer Fangversuch gestartet werden.',
    details: ['Haben die Partner währenddessen Pokémon gefangen, müssen diese wieder freigelassen werden.'],
  },
  {
    titel: 'Austausch mit dem PC',
    symbol: '↔',
    kurz: 'Seelenpartner dürfen beliebig oft gemeinsam gegen eine andere vollständige Seelenverbindung vom PC ausgetauscht werden.',
    details: [],
  },
  {
    titel: 'Tod und Grab-Box',
    symbol: '†',
    wichtig: true,
    kurz: 'Besiegte Pokémon gelten als verstorben und müssen in eine Grab-Box auf dem PC gelegt werden. Das gilt ebenfalls für alle zugehörigen Seelenpartner.',
    details: ['Befinden sich die Seelenpartner noch im Kampf, dürfen sie nur bis zum Ende dieses Kampfes benutzt werden. Bei der nächsten Gelegenheit müssen sie in die Grab-Box transferiert werden.'],
  },
  {
    titel: 'Spitznamen',
    symbol: '✎',
    kurz: 'Jedes Pokémon erhält einen Spitznamen, den der jeweilige Nachbar auswählt.',
    details: ['Reihenfolge: Try → Chef → Ruth → Try.'],
  },
  {
    titel: 'Randomisierte Pokémon',
    symbol: '↻',
    kurz: 'Die Pokémon der Challenge werden randomisiert.',
    details: ['Das gilt für Starter, wilde Pokémon, Tausch-Pokémon, geschenkte Pokémon, Fossilien, statische Pokémon und Trainer-Pokémon.'],
  },
  {
    titel: 'Randomisierte Items',
    symbol: '◇',
    kurz: 'Items werden ebenfalls randomisiert.',
    details: ['Das gilt für Feld-Items und getragene Items.'],
  },
  {
    titel: 'Bonus-Shop',
    symbol: '₽',
    kurz: 'Der Bonus-Shop im Pokémarkt ist randomisiert und kann beispielsweise Meisterbälle, Evolutionssteine oder starke TMs enthalten.',
    details: ['Jedes Item aus dem Bonus-Shop darf höchstens einmal gekauft werden.'],
  },
  {
    titel: 'Level-Cap',
    symbol: '▲',
    wichtig: true,
    kurz: 'Kein Team-Pokémon darf das Level des stärksten Pokémon des nächsten Arenaleiters überschreiten. Andernfalls dürfen dieses Pokémon und sein Seelenpartner nicht kämpfen, bis das Level-Cap wieder erhöht wurde.',
    details: [
      'Sonderregel: Höchstens ein Pokémon im Team darf das Level-Cap erreichen. Alle anderen dürfen nur bis zwei Level unter dem Cap trainiert werden.',
      'Sind zwei oder mehr Pokémon überlevelt, darf nur eines davon benutzt werden.',
    ],
  },
  {
    titel: 'Sonderbonbons',
    symbol: '◆',
    kurz: 'Sonderbonbons dürfen zum Erreichen des aktuellen Caps erst unmittelbar vor einem Arenaleiter, der Top 4 oder dem Champ benutzt werden.',
    details: ['Sie dürfen jederzeit benutzt werden, um Pokémon bis zum Level-Cap der zuletzt besiegten Arena nachzuziehen.'],
  },
  {
    titel: 'Kampffolge',
    symbol: '»',
    kurz: 'Die Kampffolge wird in den Spieleinstellungen auf „Folgen“ gestellt.',
    details: [],
  },
  {
    titel: 'Gegenstände im Kampf',
    symbol: '+',
    wichtig: true,
    kurz: 'Gegenstände dürfen in Kämpfen nur verwendet werden, wenn der Gegner ebenfalls einen Gegenstand verwendet.',
    details: ['Während der gesamten Top 4 dürfen außerhalb von Kämpfen höchstens 15 Items benutzt werden.'],
  },
  {
    titel: 'Emote-only',
    symbol: '☻',
    kurz: 'Während Arenaleiter-, Top-4- und Rivalen-Kämpfen gilt Emote-only.',
    details: [],
  },
  {
    titel: 'Shiny-Klausel',
    symbol: '✦',
    kurz: 'Shiny-Pokémon dürfen jederzeit gefangen werden.',
    details: ['Ein Shiny darf mit einem beliebigen Pokémon aus einer bestehenden Seelenverbindung ausgetauscht werden.'],
  },
  {
    titel: 'Sieg und Niederlage',
    symbol: '♛',
    wichtig: true,
    kurz: 'Die Challenge ist bestanden, sobald der Champ der Region besiegt wurde.',
    details: ['Die Challenge ist verloren, wenn das komplette Team eines Spielers besiegt wurde.'],
  },
  {
    titel: 'Beginn der Challenge',
    symbol: '●',
    kurz: 'Die Challenge beginnt, sobald die ersten Pokébälle erhalten wurden.',
    details: [],
  },
]

function Regeln({ zurueck }: { zurueck: () => void }) {
  function zuRegel(index: number) {
    document.getElementById(`regel-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="regeln-seite">
      <header className="regeln-kopf">
        <button className="zurueck" onClick={zurueck}>← Startseite</button>
        <span className="edition">SOULLINK · RANDOMIZER · REGELWERK</span>
        <h1>Gemeinsam verbunden.<br />Gemeinsam überleben.</h1>
        <p>16 Regeln für eure Feuerrot-SoulLink-Challenge – von der ersten Begegnung bis zum Champ.</p>
        <div className="regeln-kopf__werte">
          <div><strong>16</strong><span>Regeln</span></div>
          <div><strong>1</strong><span>Seelenverbindung</span></div>
          <div><strong>∞</strong><span>Teamgeist</span></div>
        </div>
      </header>

      <section className="regeln-inhalt">
        <nav className="regeln-sprungmarken" aria-label="Direkt zu einer Regel">
          <span>Schnellwahl</span>
          <div>{SOULLINK_REGELN.map((regel, index) => <button key={regel.titel} onClick={() => zuRegel(index)} aria-label={`Zu Regel ${index + 1}: ${regel.titel}`}>{String(index + 1).padStart(2, '0')}</button>)}</div>
        </nav>

        <div className="regeln-einleitung">
          <span>VOR DEM START</span>
          <p>Alle Teilnehmer sollten diese Regeln gemeinsam lesen und offene Sonderfälle klären. Eine vollständige Seelenverbindung gewinnt und verliert immer zusammen.</p>
        </div>

        <div className="regeln-raster">
          {SOULLINK_REGELN.map((regel, index) => (
            <article className={`regel-karte ${regel.wichtig ? 'regel-karte--wichtig' : ''}`} id={`regel-${index + 1}`} key={regel.titel}>
              <header>
                <span className="regel-nummer">{String(index + 1).padStart(2, '0')}</span>
                <span className="regel-symbol" aria-hidden="true">{regel.symbol}</span>
                <div><small>{regel.wichtig ? 'KERNREGEL' : 'SOULLINK-REGEL'}</small><h2>{regel.titel}</h2></div>
              </header>
              <p>{regel.kurz}</p>
              {regel.details.length > 0 && <ul>{regel.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
            </article>
          ))}
        </div>

        <div className="regeln-abschluss"><span>♛</span><div><small>DAS GEMEINSAME ZIEL</small><strong>Besiegt den Champ – ohne eure Seelenpartner zurückzulassen.</strong></div></div>
      </section>
    </main>
  )
}

function Pokedex({ zurueck }: { zurueck: () => void }) {
  const [suche, setSuche] = useState('')
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null)
  const [umfang, setUmfang] = useState<'kanto' | 'national'>('kanto')

  const gefiltert = useMemo(() => {
    const begriff = suchText(suche.trim().replace(/^#/, ''))
    const pool = umfang === 'kanto' ? POKEMON.slice(0, 151) : POKEMON
    if (!begriff) return pool
    return pool.filter(
      (pokemon) =>
        suchText(pokemon.name).includes(begriff) ||
        String(pokemon.id).includes(begriff) ||
        suchText(pokemon.genus).includes(begriff),
    )
  }, [suche, umfang])

  return (
    <main className="pokedex-seite">
      <header className="pokedex-kopf">
        <button className="zurueck" onClick={zurueck}>← Startseite</button>
        <span className="edition">{umfang === 'kanto' ? 'KANTO-POKÉDEX · 001–151' : 'NATIONALER POKÉDEX · 001–386'}</span>
        <h1>Pokédex</h1>
        <p>{umfang === 'kanto' ? 'Die ursprünglichen 151 Pokémon aus Kanto.' : 'Alle Pokémon der ersten drei Generationen – mit Daten aus Feuerrot und Blattgrün.'}</p>
      </header>

      <section className="pokedex-inhalt">
        <div className="pokedex-umfang" role="group" aria-label="Pokédex auswählen"><button className={umfang === 'kanto' ? 'aktiv' : ''} onClick={() => setUmfang('kanto')}><span>151</span><strong>Kanto-Pokédex</strong><small>Generation I</small></button><button className={umfang === 'national' ? 'aktiv' : ''} onClick={() => setUmfang('national')}><span>386</span><strong>Nationaler Pokédex</strong><small>Generation I–III</small></button></div>
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

type DesignModus = 'hell' | 'dunkel'
type BallLogo = 'poke' | 'super' | 'hyper' | 'meister' | 'premier'
type DesignEinstellungen = {
  modus: DesignModus
  akzent: string
  banner: string
  ball: BallLogo
}

const EINSTELLUNGEN_SCHLUESSEL = 'feuerrot-einstellungen'
const SPEICHER_PREFIX = 'feuerrot-'
const RUN_ARCHIV_SCHLUESSEL = 'feuerrot-run-archiv'

type RunArchiv = { id: string; archiviertAm: string; daten: Record<string, string> }

function runArchiveLesen(): RunArchiv[] {
  try { return JSON.parse(localStorage.getItem(RUN_ARCHIV_SCHLUESSEL) ?? '[]') as RunArchiv[] }
  catch { return [] }
}
const AKZENTFARBEN = [
  { name: 'Feuerrot', wert: '#d83b35', dunkel: '#a92323', weich: '#f9ded8' },
  { name: 'Glutorange', wert: '#d76a24', dunkel: '#9e4718', weich: '#f8e3d4' },
  { name: 'Ozeanblau', wert: '#2874a7', dunkel: '#1d547a', weich: '#d8e8f2' },
  { name: 'Blattgrün', wert: '#378b61', dunkel: '#276647', weich: '#dcece4' },
  { name: 'Lavendel', wert: '#7856a6', dunkel: '#573c7d', weich: '#e7dff0' },
] as const
const BANNERFARBEN = [
  { name: 'Kantogrün', wert: '#1f5a45' },
  { name: 'Feuerrot', wert: '#8f2f2c' },
  { name: 'Nachtblau', wert: '#263f66' },
  { name: 'Indigo', wert: '#493f73' },
  { name: 'Aubergine', wert: '#633f55' },
  { name: 'Anthrazit', wert: '#303a38' },
] as const

function einstellungenLesen(): DesignEinstellungen {
  try {
    const gespeichert = JSON.parse(localStorage.getItem(EINSTELLUNGEN_SCHLUESSEL) ?? '{}') as Partial<DesignEinstellungen>
    const modus: DesignModus = gespeichert.modus === 'dunkel' ? 'dunkel' : 'hell'
    const akzent = AKZENTFARBEN.some((farbe) => farbe.wert === gespeichert.akzent)
      ? gespeichert.akzent as string
      : AKZENTFARBEN[0].wert
    const banner = BANNERFARBEN.some((farbe) => farbe.wert === gespeichert.banner)
      ? gespeichert.banner as string
      : BANNERFARBEN[0].wert
    const ball: BallLogo = ['poke', 'super', 'hyper', 'meister', 'premier'].includes(gespeichert.ball ?? '') ? gespeichert.ball as BallLogo : 'poke'
    return { modus, akzent, banner, ball }
  } catch {
    return { modus: 'hell', akzent: AKZENTFARBEN[0].wert, banner: BANNERFARBEN[0].wert, ball: 'poke' }
  }
}

function RunArchivKarte({ run, nummer, standardOffen }: { run: RunArchiv; nummer: number; standardOffen: boolean }) {
  const [register, setRegister] = useState<'lebend' | 'grabbox'>('lebend')
  const [seite, setSeite] = useState(0)
  let namen = { rot: 'Team Rot', blau: 'Team Blau' }
  let counter = { rot: 0, blau: 0 }
  let grabbox: GrabPaar[] = []
  let lebendePaare: PokemonPaar[] = []
  try { namen = JSON.parse(run.daten['feuerrot-teamplaner-namen'] ?? '{}') as typeof namen } catch { /* alte Daten */ }
  try { counter = JSON.parse(run.daten['feuerrot-death-counter'] ?? '{}') as typeof counter } catch { /* alte Daten */ }
  try { grabbox = JSON.parse(run.daten['feuerrot-grabbox'] ?? '[]') as GrabPaar[] } catch { /* alte Daten */ }
  try { lebendePaare = JSON.parse(run.daten['feuerrot-teamplaner-paare'] ?? '[]') as PokemonPaar[] } catch { /* alte Daten */ }
  const fortschritt = Number(run.daten['feuerrot-arenen-fortschritt'])
  const fortschrittName = Number.isInteger(fortschritt) && ARENEN_FORTSCHRITT[fortschritt] ? ARENEN_FORTSCHRITT[fortschritt].name : 'Noch kein Orden gewählt'
  const liste = register === 'lebend' ? lebendePaare : grabbox
  const seiten = Math.max(1, Math.ceil(liste.length / 6))
  const sichtbar = liste.slice(seite * 6, seite * 6 + 6)

  function registerWaehlen(ziel: 'lebend' | 'grabbox') { setRegister(ziel); setSeite(0) }

  return <details open={standardOffen}><summary><span>RUN {nummer}</span><div><strong>{fortschrittName}</strong><small>{new Date(run.archiviertAm).toLocaleString('de-DE')}</small></div><b>{lebendePaare.length} lebend · {grabbox.length} Grabbox</b></summary><div className="run-details"><div className="run-details__werte"><p><span>{namen.rot || 'Team Rot'}</span><strong>{counter.rot || 0} Tode</strong></p><p><span>{namen.blau || 'Team Blau'}</span><strong>{counter.blau || 0} Tode</strong></p></div><div className="run-register"><button className={register === 'lebend' ? 'aktiv' : ''} onClick={() => registerWaehlen('lebend')}>Lebende Paare <b>{lebendePaare.length}</b></button><button className={register === 'grabbox' ? 'aktiv' : ''} onClick={() => registerWaehlen('grabbox')}>Grabbox <b>{grabbox.length}</b></button></div>{sichtbar.length ? <div className={`run-pokemonliste ${register === 'grabbox' ? 'run-pokemonliste--grab' : ''}`}>{sichtbar.map((paar) => <article key={paar.id}><div><img src={BILD(paar.links)} alt="" /><span><small>{namen.rot || 'Team Rot'} · Lv. {paar.levelLinks}</small><strong>{POKEMON[paar.links - 1]?.name ?? 'Unbekannt'}</strong></span></div><b>{register === 'grabbox' ? '†' : '↔'}</b><div><span><small>{namen.blau || 'Team Blau'} · Lv. {paar.levelRechts}</small><strong>{POKEMON[paar.rechts - 1]?.name ?? 'Unbekannt'}</strong></span><img src={BILD(paar.rechts)} alt="" /></div>{register === 'lebend' && <em>{paar.aktiv ? `Team · Slot ${(paar.slot ?? 0) + 1}` : 'Ersatzbank'}</em>}</article>)}</div> : <p className="run-details__leer">In diesem Bereich sind keine Seelenpaare gespeichert.</p>}{seiten > 1 && <nav className="run-seiten" aria-label="Seite auswählen"><button onClick={() => setSeite((aktuell) => Math.max(0, aktuell - 1))} disabled={seite === 0}>←</button><span>Seite {seite + 1} von {seiten}</span><button onClick={() => setSeite((aktuell) => Math.min(seiten - 1, aktuell + 1))} disabled={seite === seiten - 1}>→</button></nav>}</div></details>
}

function EinstellungsMenue({
  offen,
  schliessen,
  design,
  designAendern,
}: {
  offen: boolean
  schliessen: () => void
  design: DesignEinstellungen
  designAendern: (design: DesignEinstellungen) => void
}) {
  const dateiEingabe = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState(false)
  const [archivOffen, setArchivOffen] = useState(false)
  const [archive, setArchive] = useState<RunArchiv[]>(runArchiveLesen)

  function archivLeeren() {
    if (!archive.length || !window.confirm('Alle archivierten Runs und Statistiken endgültig löschen? Der aktuelle Spielstand bleibt erhalten.')) return
    localStorage.removeItem(RUN_ARCHIV_SCHLUESSEL)
    setArchive([])
  }

  useEffect(() => {
    if (!offen) return
    const taste = (event: KeyboardEvent) => { if (event.key === 'Escape') archivOffen ? setArchivOffen(false) : schliessen() }
    window.addEventListener('keydown', taste)
    document.body.classList.add('menue-offen')
    return () => {
      window.removeEventListener('keydown', taste)
      document.body.classList.remove('menue-offen')
    }
  }, [offen, schliessen, archivOffen])

  function exportieren() {
    const daten: Record<string, string> = {}
    for (let index = 0; index < localStorage.length; index += 1) {
      const schluessel = localStorage.key(index)
      if (schluessel?.startsWith(SPEICHER_PREFIX)) {
        daten[schluessel] = localStorage.getItem(schluessel) ?? ''
      }
    }

    const sicherung = {
      format: 'soullink-feuerrot-spielstand',
      version: 1,
      exportiertAm: new Date().toISOString(),
      daten,
    }
    const blob = new Blob([JSON.stringify(sicherung, null, 2)], { type: 'application/json' })
    const adresse = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = adresse
    link.download = `soullink-spielstand-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(adresse)
    setFehler(false)
    setMeldung(`${Object.keys(daten).length} Datenbereiche wurden gesichert.`)
  }

  async function importieren(datei: File) {
    try {
      const sicherung = JSON.parse(await datei.text()) as {
        format?: unknown
        version?: unknown
        daten?: unknown
      }
      if (
        sicherung.format !== 'soullink-feuerrot-spielstand'
        || sicherung.version !== 1
        || !sicherung.daten
        || typeof sicherung.daten !== 'object'
        || Array.isArray(sicherung.daten)
      ) {
        throw new Error('Diese Datei ist keine gültige SoulLink-Sicherung.')
      }

      const daten = Object.entries(sicherung.daten).filter(
        (eintrag): eintrag is [string, string] => eintrag[0].startsWith(SPEICHER_PREFIX) && typeof eintrag[1] === 'string',
      )
      if (!daten.length) throw new Error('Die Sicherung enthält keinen Spielstand.')
      if (!window.confirm('Der geladene Spielstand ersetzt die momentan gespeicherten App-Daten. Möchtest du fortfahren?')) {
        setFehler(false)
        setMeldung('Import abgebrochen. Dein aktueller Spielstand blieb unverändert.')
        return
      }

      const vorhandeneSchluessel = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((schluessel): schluessel is string => Boolean(schluessel?.startsWith(SPEICHER_PREFIX)))
      vorhandeneSchluessel.forEach((schluessel) => localStorage.removeItem(schluessel))
      daten.forEach(([schluessel, wert]) => localStorage.setItem(schluessel, wert))
      setFehler(false)
      setMeldung('Spielstand wiederhergestellt. Die App wird neu geladen …')
      window.setTimeout(() => window.location.reload(), 350)
    } catch (error) {
      setFehler(true)
      setMeldung(error instanceof Error ? error.message : 'Die Sicherung konnte nicht geladen werden.')
    } finally {
      if (dateiEingabe.current) dateiEingabe.current.value = ''
    }
  }

  if (!offen) return null

  return (
    <div className="menue-hintergrund" onMouseDown={schliessen} role="presentation">
      <aside className="seitenmenue" role="dialog" aria-modal="true" aria-labelledby="einstellungen-titel" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>EINSTELLUNGEN</span>
            <h2 id="einstellungen-titel">Deine App</h2>
          </div>
          <button className="seitenmenue__schliessen" onClick={schliessen} aria-label="Menü schließen">×</button>
        </header>

        <div className="seitenmenue__inhalt">
          <section className="einstellung-gruppe">
            <div className="einstellung-gruppe__kopf">
              <span className="einstellung-symbol" aria-hidden="true">↧</span>
              <div><h3>Spielstand</h3><p>Sichere alle Teams, Orden, Aufgaben und Einstellungen.</p></div>
            </div>
            <div className="sicherungs-aktionen">
              <button className="sicherung-knopf sicherung-knopf--primaer" onClick={exportieren}><span>↓</span><strong>Spielstand sichern</strong><small>JSON-Datei herunterladen</small></button>
              <button className="sicherung-knopf" onClick={() => dateiEingabe.current?.click()}><span>↑</span><strong>Spielstand laden</strong><small>Sicherung wiederherstellen</small></button>
              <input
                ref={dateiEingabe}
                className="datei-eingabe"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const datei = event.target.files?.[0]
                  if (datei) void importieren(datei)
                }}
              />
            </div>
            {meldung && <p className={`einstellung-meldung ${fehler ? 'einstellung-meldung--fehler' : ''}`} role="status">{meldung}</p>}
          </section>

          <section className="einstellung-gruppe run-archiv">
            <div className="einstellung-gruppe__kopf">
              <span className="einstellung-symbol" aria-hidden="true">◷</span>
              <div><h3>Alte Runs</h3><p>Sieh dir automatisch archivierte Challenges an.</p></div>
            </div>
            <button className="run-archiv-knopf" onClick={() => setArchivOffen(true)}><span>◷</span><strong>Alte Runs ansehen</strong><small>{archive.length ? `${archive.length} archivierte Challenge${archive.length === 1 ? '' : 's'}` : 'Noch kein Run archiviert'}</small><b>→</b></button>
          </section>

          <section className="einstellung-gruppe">
            <div className="einstellung-gruppe__kopf">
              <span className="einstellung-symbol" aria-hidden="true">◐</span>
              <div><h3>Darstellung</h3><p>Das Design gilt sofort in allen Bereichen.</p></div>
            </div>
            <span className="einstellung-label">MODUS</span>
            <div className="modus-auswahl">
              <button className={design.modus === 'hell' ? 'aktiv' : ''} onClick={() => designAendern({ ...design, modus: 'hell' })}><span>☀</span> Hell</button>
              <button className={design.modus === 'dunkel' ? 'aktiv' : ''} onClick={() => designAendern({ ...design, modus: 'dunkel' })}><span>☾</span> Dunkel</button>
            </div>
            <span className="einstellung-label">AKZENTFARBE</span>
            <div className="farb-auswahl">
              {AKZENTFARBEN.map((farbe) => (
                <button
                  className={design.akzent === farbe.wert ? 'aktiv' : ''}
                  key={farbe.wert}
                  onClick={() => designAendern({ ...design, akzent: farbe.wert })}
                  aria-label={`${farbe.name} auswählen`}
                  title={farbe.name}
                >
                  <i style={{ backgroundColor: farbe.wert }} />
                  <span>{farbe.name}</span>
                </button>
              ))}
            </div>
            <span className="einstellung-label">STARTSEITEN-BANNER</span>
            <div className="farb-auswahl banner-auswahl">
              {BANNERFARBEN.map((farbe) => (
                <button
                  className={design.banner === farbe.wert ? 'aktiv' : ''}
                  key={farbe.wert}
                  onClick={() => designAendern({ ...design, banner: farbe.wert })}
                  aria-label={`${farbe.name} als Bannerfarbe auswählen`}
                  title={farbe.name}
                >
                  <i style={{ backgroundColor: farbe.wert }} />
                  <span>{farbe.name}</span>
                </button>
              ))}
            </div>
          </section>

          <p className="speicher-hinweis"><strong>Automatische Speicherung aktiv</strong><span>Änderungen werden weiterhin direkt in diesem Browser gespeichert. Die Datei ist dein zusätzliches Backup.</span></p>
        </div>
      </aside>
      {archivOffen && <div className="run-dialog-hintergrund" onMouseDown={() => setArchivOffen(false)}><section className="run-dialog" role="dialog" aria-modal="true" aria-labelledby="run-dialog-titel" onMouseDown={(event) => event.stopPropagation()}><header><div><span>CHALLENGE-ARCHIV</span><h2 id="run-dialog-titel">Alte Runs</h2><p>Teams, Fortschritt und Verluste vergangener Versuche.</p></div><div className="run-dialog__aktionen"><button className="run-statistik-reset" onClick={archivLeeren} disabled={!archive.length}>Statistiken zurücksetzen</button><button onClick={() => setArchivOffen(false)} aria-label="Alte Runs schließen">×</button></div></header>{archive.length ? <div className="run-dialog__liste">{archive.map((run, index) => <RunArchivKarte key={run.id} run={run} nummer={archive.length - index} standardOffen={index === 0} />)}</div> : <div className="run-dialog__leer"><span>◷</span><h3>Noch keine alten Runs</h3><p>Beim Zurücksetzen einer Challenge wird der aktuelle Stand automatisch hier archiviert.</p></div>}</section></div>}
    </div>
  )
}

export default function App() {
  type Seite = 'start' | 'pokedex' | 'teamplaner' | 'kampfberater' | 'regeln' | 'begegnungen' | 'begegnungstracker' | 'capwaechter'

  function seiteAusHash(): Seite {
    if (window.location.hash === '#pokedex') return 'pokedex'
    if (window.location.hash === '#teamplaner') return 'teamplaner'
    if (window.location.hash === '#kampfberater') return 'kampfberater'
    if (window.location.hash === '#regeln') return 'regeln'
    if (window.location.hash === '#begegnungen') return 'begegnungen'
    if (window.location.hash === '#begegnungstracker') return 'begegnungstracker'
    if (window.location.hash === '#capwaechter') return 'capwaechter'
    return 'start'
  }

  const [seite, setSeite] = useState<Seite>(seiteAusHash)
  const [menueOffen, setMenueOffen] = useState(false)
  const [ballAuswahlOffen, setBallAuswahlOffen] = useState(false)
  const [design, setDesign] = useState<DesignEinstellungen>(einstellungenLesen)

  useEffect(() => {
    const farbe = AKZENTFARBEN.find((eintrag) => eintrag.wert === design.akzent) ?? AKZENTFARBEN[0]
    document.documentElement.dataset.theme = design.modus === 'dunkel' ? 'dark' : 'light'
    document.documentElement.dataset.ball = design.ball
    document.documentElement.style.setProperty('--rot', farbe.wert)
    document.documentElement.style.setProperty('--rot-dunkel', farbe.dunkel)
    document.documentElement.style.setProperty('--akzent-weich', farbe.weich)
    document.documentElement.style.setProperty('--banner', design.banner)
    localStorage.setItem(EINSTELLUNGEN_SCHLUESSEL, JSON.stringify(design))
  }, [design])

  useEffect(() => {
    const wechsel = () => setSeite(seiteAusHash())
    window.addEventListener('hashchange', wechsel)
    return () => window.removeEventListener('hashchange', wechsel)
  }, [])

  function wechseln(ziel: Seite) {
    setMenueOffen(false)
    window.location.hash = ziel === 'start' ? '' : ziel
    setSeite(ziel)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function challengeZuruecksetzen() {
    if (!window.confirm('Möchtest du die aktuelle Challenge wirklich zurücksetzen? Der jetzige Stand wird vorher unter „Alte Runs“ archiviert.')) return
    if (!window.confirm('Letzte Bestätigung: Teams, Orden, Aufgaben und Encounter werden auf einen neuen Run zurückgesetzt. Fortfahren?')) return

    const daten: Record<string, string> = {}
    const schluessel = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((eintrag): eintrag is string => Boolean(eintrag?.startsWith(SPEICHER_PREFIX)))
      .filter((eintrag) => eintrag !== RUN_ARCHIV_SCHLUESSEL && eintrag !== EINSTELLUNGEN_SCHLUESSEL)
    schluessel.forEach((eintrag) => { daten[eintrag] = localStorage.getItem(eintrag) ?? '' })

    const archive = runArchiveLesen()
    archive.unshift({ id: `${Date.now()}`, archiviertAm: new Date().toISOString(), daten })
    schluessel.forEach((eintrag) => localStorage.removeItem(eintrag))
    localStorage.setItem(RUN_ARCHIV_SCHLUESSEL, JSON.stringify(archive.slice(0, 10)))
    window.location.hash = ''
    window.location.reload()
  }

  return (
    <div className="app">
      {seite !== 'start' && <nav className="hauptnav">
        <div className="hauptnav__links">
          <button className="menue-knopf" onClick={() => setMenueOffen(true)} aria-label="Einstellungen öffnen" aria-expanded={menueOffen}>
            <i /><i /><i />
          </button>
          <button className="marke" onClick={() => wechseln('start')} aria-label="Zur Startseite">
            <span className="marke__ball" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); setBallAuswahlOffen(true) }}><i /></span>
            <span><strong>Feuerrot</strong><small>Abenteuer-Begleiter</small></span>
          </button>
        </div>
        <span className="datenhinweis">Daten: PokéAPI · Fanprojekt</span>
      </nav>}

      <EinstellungsMenue offen={menueOffen} schliessen={() => setMenueOffen(false)} design={design} designAendern={setDesign} />
      {ballAuswahlOffen && <div className="ball-dialog-hintergrund" onMouseDown={() => setBallAuswahlOffen(false)}><section className="ball-dialog" role="dialog" aria-modal="true" aria-labelledby="ball-dialog-titel" onMouseDown={(event) => event.stopPropagation()}><header><div><span>LOGO AUSWÄHLEN</span><h2 id="ball-dialog-titel">Dein Pokéball</h2></div><button onClick={() => setBallAuswahlOffen(false)} aria-label="Auswahl schließen">×</button></header><div>{([{ id: 'poke', name: 'Pokéball' }, { id: 'super', name: 'Superball' }, { id: 'hyper', name: 'Hyperball' }, { id: 'meister', name: 'Meisterball' }, { id: 'premier', name: 'Premierball' }] as { id: BallLogo; name: string }[]).map((ball) => <button className={design.ball === ball.id ? 'aktiv' : ''} data-vorschau-ball={ball.id} key={ball.id} onClick={() => { setDesign({ ...design, ball: ball.id }); setBallAuswahlOffen(false) }}><span className="ball-vorschau"><i /></span><strong>{ball.name}</strong></button>)}</div></section></div>}

      {seite === 'start' && (
        <Startseite
          menueOeffnen={() => setMenueOffen(true)}
          menueOffen={menueOffen}
          logoAuswahlOeffnen={() => setBallAuswahlOffen(true)}
          pokedexOeffnen={() => wechseln('pokedex')}
          teamplanerOeffnen={() => wechseln('teamplaner')}
          kampfberaterOeffnen={() => wechseln('kampfberater')}
          regelnOeffnen={() => wechseln('regeln')}
          encounterOeffnen={() => wechseln('begegnungstracker')}
          abenteuerplanOeffnen={() => wechseln('begegnungen')}
          challengeZuruecksetzen={challengeZuruecksetzen}
        />
      )}
      {seite === 'pokedex' && <Pokedex zurueck={() => wechseln('start')} />}
      {seite === 'teamplaner' && <Teamplaner zurueck={() => wechseln('start')} />}
      {seite === 'kampfberater' && <Kampfberater zurueck={() => wechseln('start')} teamplanerOeffnen={() => wechseln('teamplaner')} />}
      {seite === 'regeln' && <Regeln zurueck={() => wechseln('start')} />}
      {seite === 'begegnungen' && <AbenteuerPlan zurueck={() => wechseln('start')} />}
      {seite === 'begegnungstracker' && <BegegnungsTracker zurueck={() => wechseln('start')} />}
      {seite === 'capwaechter' && <CapWaechter zurueck={() => wechseln('start')} teamplanerOeffnen={() => wechseln('teamplaner')} />}

      <footer>
        <p>Inoffizielles, nicht kommerzielles Fanprojekt. Pokémon und zugehörige Namen sind Marken ihrer jeweiligen Rechteinhaber.</p>
      </footer>
    </div>
  )
}
