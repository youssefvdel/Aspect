export interface DisplayMode {
  width: number;
  height: number;
  refresh_rate: number;
}

export interface DisplayInfo {
  current_width: number;
  current_height: number;
  current_hz: number;
  native_width: number;
  native_height: number;
  supported_refresh_rates: number[];
  active_profile: 'native' | 'stretched' | 'custom';
  device_name: string;
}

export interface ShortcutBinding {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  win: boolean;
  vk: number;
}

export interface GpuInfo {
  vendor: 'Nvidia' | 'Amd' | 'Intel' | 'Unknown';
  name: string;
  instructions: string[];
}

export interface GpuSettingItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  badge: string;
}

export interface GpuSettingsReport {
  vendor: 'Nvidia' | 'Amd' | 'Intel' | 'Unknown';
  name: string;
  settings: GpuSettingItem[];
}

export interface WindowInfo {
  hwnd: number;
  title: string;
  class_name?: string;
  is_game?: boolean;
}

export interface ConfigFileInfo {
  path: string;
  display_name: string;
  is_read_only: boolean;
  fullscreen_mode: number | null;
  last_confirmed_fullscreen?: number | null;
  preferred_fullscreen?: number | null;
  should_letterbox: boolean | null;
  last_letterbox?: boolean | null;
  res_x: number | null;
  res_y: number | null;
  last_confirmed_res_x?: number | null;
  last_confirmed_res_y?: number | null;
  desired_w?: number | null;
  desired_h?: number | null;
  last_confirmed_desired_w?: number | null;
  last_confirmed_desired_h?: number | null;
}

export interface ValorantApplyResult {
  path: string;
  display_name: string;
  ok: boolean;
  verified: boolean;
  message: string;
}

export interface ValorantVerifyResult {
  path: string;
  display_name: string;
  matches: boolean;
  details: string;
  health_score?: number;
  is_healthy?: boolean;
  issues?: string[];
}

export interface ValorantCustomOptions {
  fullscreen_mode?: number | null;
  letterbox?: boolean | null;
  res?: [number, number] | null;
  desired?: [number, number] | null;
  lock_readonly: boolean;
}

export interface ValorantSettingRow {
  key: string;
  value: string;
}

export interface ValorantSection {
  name: string;
  rows: ValorantSettingRow[];
}

export interface TrackerProfile {
  name: string;
  tag: string;
  region: string;
  puuid: string;
  rank: string;
  tier: number;
  rr: number;
  peak: string;
  wins: number;
  games: number;
  currentSeasonId: string;
  seasons: { id: string; games: number; wins: number; tier: number }[];
}

export interface TrackerMatch {
  id: string;
  map: string;
  mode: string;
  agent: string;
  result: 'win' | 'loss' | 'draw';
  scoreUs: number;
  scoreThem: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  hsPct: number;
  damage: number;
  startedAt: string;
}

export interface TrackerPlayer {
  puuid: string;
  name: string;
  tag: string;
  team: string;
  agent: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  damageTaken: number;
  score: number;
  rounds: number;
  playtimeMs: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  accountLevel?: number;
  tier?: number;
}

export interface TrackerMatchDetail {
  rounds: { winningTeam: string; roundResult?: string; ceremony?: string }[];
  players: TrackerPlayer[];
  kills: TrackerDuel[];
  mapId: string;
  teamScore: Record<string, number>;
  queue: string;
  when: number;
  durationMs?: number;
}

export interface TrackerDuel {
  round: number;
  killerPuuid: string;
  victimPuuid: string;
  killerTeam: string;
  victimTeam: string;
  timeInRound: number;
  weapon: string;
  assists: string[];
}

export interface TrackerMmrPoint {
  tier: string;
  rr: number;
  change: number;
  matchId: string;
  mapId: string;
  when: number;
}

export interface LocalRiotAccount {
  game_name: string;
  tagline: string;
  puuid: string;
}

export interface QuickShortcut {
  id: string;
  name: string;
  window_match: string;
  icon: 'valorant' | 'gamepad' | 'crosshair' | 'zap' | 'star' | 'maximize';
  is_removable: boolean;
}

export interface MonitorDevice {
  device_name: string;
  adapter_name: string;
  monitor_name: string;
  is_attached: boolean;
  is_primary: boolean;
  width: number;
  height: number;
  refresh_rate: number;
  position_x: number;
  position_y: number;
  orientation: string;
  /** PnP instance path, e.g. MONITOR\...\... Empty when unresolvable. */
  device_id?: string;
  /** True when disabled in Device Manager (SetupDi), distinct from CCD detach. */
  is_device_disabled?: boolean;
}

export type TabType =
  | 'switcher'
  | 'visualizer'
  | 'sens'
  | 'custom_res'
  | 'gpu'
  | 'borderless'
  | 'game_config'
  | 'settings'
  | 'valorant'
  | 'overview'
  | 'matches'
  | 'dev';

export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_title: string;
  release_notes: string;
  published_at: string;
  html_url: string;
  download_url: string | null;
}

export interface LiveMatchPlayer {
  puuid: string;
  name: string;
  tag: string;
  team: 'Blue' | 'Red';
  agentId: string;
  agentName: string;
  agentIcon: string;
  agentRole: string;
  tier: number;
  rank: string;
  rr: number;
  peakTier: number;
  peakRank: string;
  accountLevel: number;
  cardId: string;
  isMe: boolean;
  selectionState?: string;
  region?: string;
  country?: string;
  kd?: number | string;
  winPct?: number;
  hsPct?: number;
  recentWon?: number;
  recentLost?: number;
  streak?: number;
}

export interface LiveMatchState {
  phase: 'idle' | 'pregame' | 'coregame';
  matchId: string;
  mapId: string;
  mapName: string;
  mode: string;
  isDeathmatch: boolean;
  startingSide?: 'Attack' | 'Defense';
  blueTeam: LiveMatchPlayer[];
  redTeam: LiveMatchPlayer[];
  updatedAt: number;
  error?: string;
}
