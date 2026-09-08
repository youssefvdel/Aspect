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
  | 'settings'
  | 'valorant';

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
