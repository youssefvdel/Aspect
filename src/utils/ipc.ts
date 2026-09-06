import { invoke } from '@tauri-apps/api/core';
import type { DisplayInfo, ShortcutBinding, GpuInfo, GpuSettingsReport, WindowInfo, ConfigFileInfo, QuickShortcut, MonitorDevice } from '../types';

export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Mock fallbacks for preview mode
const mockDisplayInfo: DisplayInfo = {
  current_width: 2560,
  current_height: 1440,
  current_hz: 260,
  native_width: 2560,
  native_height: 1440,
  supported_refresh_rates: [260, 240, 165, 144, 120, 60],
  active_profile: 'native',
  device_name: '\\\\.\\DISPLAY1',
};

const mockShortcut: ShortcutBinding = {
  ctrl: false,
  shift: false,
  alt: false,
  win: false,
  vk: 0x73, // F4
};

const mockGpuInfo: GpuInfo = {
  vendor: 'Nvidia',
  name: 'NVIDIA GeForce RTX 3080',
  instructions: [
    "Set Scaling mode to: 'Full-screen'.",
    "Set 'Perform scaling on:' to: 'GPU'.",
    "Check 'Override the scaling mode set by games and programs'.",
    "Bypass DWM desktop letterbox buffers.",
    "Enable DirectFlip ultra-low latency hardware scanout.",
  ],
};

const mockGpuSettings: GpuSettingsReport = {
  vendor: 'Nvidia',
  name: 'NVIDIA GeForce RTX 3080',
  settings: [
    {
      id: 'full_screen_scaling',
      name: 'Full-Screen Hardware Scaling (0 Black Bars)',
      description: 'Forces RTX hardware display pipe to stretch custom 1.45:1 resolutions to panel borders with zero black bars.',
      enabled: true,
      badge: 'Win32 CCD • Full-Screen',
    },
    {
      id: 'gpu_scaling_engine',
      name: 'Perform Scaling on: GPU',
      description: 'Offloads image expansion to RTX hardware scanout pipeline instead of monitor display scalar.',
      enabled: true,
      badge: 'NVIDIA Hardware Scaler',
    },
    {
      id: 'override_game_scaling',
      name: 'Override Scaling Mode Set by Games & Programs',
      description: 'Forces driver-level stretched scanout over in-game letterbox enforcement (sets bShouldLetterbox=False).',
      enabled: true,
      badge: 'Driver Scanout Priority',
    },
    {
      id: 'low_latency_scanout',
      name: 'Ultra-Low Latency Direct Scanout Engine',
      description: 'Bypasses DWM windowed presentation buffer, enabling 0.0 ms DirectFlip scanout with zero delay.',
      enabled: true,
      badge: 'DirectFlip Scanout',
    },
    {
      id: 'integer_scaling_bypass',
      name: 'Bypass Integer Scaling Aspect Lock',
      description: 'Prevents fixed-pixel integer scaling clamps, allowing arbitrary golden-ratio custom resolutions.',
      enabled: true,
      badge: 'Uncapped Aspect Ratio',
    },
  ],
};

const mockWindows: WindowInfo[] = [
  { hwnd: 12345, title: 'VALORANT  ' },
  { hwnd: 23456, title: 'Counter-Strike 2' },
  { hwnd: 34567, title: 'Discord' },
  { hwnd: 45678, title: 'Google Chrome' },
];

const mockConfigs: ConfigFileInfo[] = [
  {
    path: 'C:\\Users\\Administrator\\AppData\\Local\\VALORANT\\Saved\\Config\\WindowsClient\\GameUserSettings.ini',
    display_name: 'Global Default Settings (WindowsClient)',
    is_read_only: false,
    fullscreen_mode: 2,
    should_letterbox: false,
    res_x: 2090,
    res_y: 1440,
  },
];

const mockShortcuts: QuickShortcut[] = [
  {
    id: 'valorant',
    name: 'VALORANT',
    window_match: 'VALORANT',
    icon: 'valorant',
    is_removable: false,
  },
  {
    id: 'cs2',
    name: 'Counter-Strike 2',
    window_match: 'Counter-Strike 2',
    icon: 'crosshair',
    is_removable: true,
  },
];

export async function fetchDisplayInfo(): Promise<DisplayInfo> {
  if (!isTauri()) return mockDisplayInfo;
  return await invoke<DisplayInfo>('get_display_info');
}

export async function applyResolution(width: number, height: number, hz: number): Promise<void> {
  if (!isTauri()) {
    mockDisplayInfo.current_width = width;
    mockDisplayInfo.current_height = height;
    mockDisplayInfo.current_hz = hz;
    mockDisplayInfo.active_profile = width === mockDisplayInfo.native_width ? 'native' : 'stretched';
    return;
  }
  await invoke('apply_resolution', { width, height, hz });
}

export async function toggleProfile(): Promise<DisplayInfo> {
  if (!isTauri()) {
    if (mockDisplayInfo.active_profile === 'native') {
      mockDisplayInfo.current_width = 2090;
      mockDisplayInfo.current_height = 1440;
      mockDisplayInfo.active_profile = 'stretched';
    } else {
      mockDisplayInfo.current_width = 2560;
      mockDisplayInfo.current_height = 1440;
      mockDisplayInfo.active_profile = 'native';
    }
    return { ...mockDisplayInfo };
  }
  return await invoke<DisplayInfo>('toggle_profile');
}

export async function fetchShortcut(): Promise<ShortcutBinding> {
  if (!isTauri()) return mockShortcut;
  return await invoke<ShortcutBinding>('get_shortcut_binding');
}

export async function saveShortcut(binding: ShortcutBinding): Promise<void> {
  if (!isTauri()) {
    Object.assign(mockShortcut, binding);
    return;
  }
  await invoke('save_shortcut_binding', { binding });
}

export async function fetchGpuInfo(): Promise<GpuInfo> {
  if (!isTauri()) return mockGpuInfo;
  return await invoke<GpuInfo>('get_gpu_info');
}

export async function fetchGpuSettings(): Promise<GpuSettingsReport> {
  if (!isTauri()) return mockGpuSettings;
  return await invoke<GpuSettingsReport>('get_gpu_settings');
}

export async function setGpuSetting(id: string, value: boolean): Promise<GpuSettingsReport> {
  if (!isTauri()) {
    const s = mockGpuSettings.settings.find((item) => item.id === id);
    if (s) s.enabled = value;
    return { ...mockGpuSettings };
  }
  return await invoke<GpuSettingsReport>('set_gpu_setting', { id, value });
}

export async function openGpuControlPanel(vendor: string): Promise<void> {
  if (!isTauri()) {
    alert(`Launched GPU Control Panel for ${vendor}`);
    return;
  }
  await invoke('open_gpu_panel', { vendor });
}

export async function autoConfigureGpuScaling(): Promise<string> {
  if (!isTauri()) {
    return 'Applied Full-Screen GPU hardware scaling and configured driver registry profiles!';
  }
  return await invoke<string>('auto_configure_gpu_scaling');
}

export async function fetchWindows(): Promise<WindowInfo[]> {
  if (!isTauri()) return mockWindows;
  return await invoke<WindowInfo[]>('get_windows');
}

export async function makeWindowBorderless(hwnd: number): Promise<string> {
  if (!isTauri()) return `Window ${hwnd} set to borderless (2560x1440)`;
  return await invoke<string>('make_window_borderless', { hwnd });
}

export async function restoreWindow(hwnd: number): Promise<string> {
  if (!isTauri()) return `Window ${hwnd} restored to windowed frame`;
  return await invoke<string>('restore_window_framed', { hwnd });
}

export async function fetchValorantConfigs(): Promise<ConfigFileInfo[]> {
  if (!isTauri()) return mockConfigs;
  return await invoke<ConfigFileInfo[]>('get_valorant_configs');
}

export async function updateValorantConfig(
  path: string,
  setWindowed: boolean,
  res?: [number, number],
  lockReadonly: boolean = false
): Promise<void> {
  if (!isTauri()) {
    const cfg = mockConfigs.find(c => c.path === path);
    if (cfg) {
      if (setWindowed) {
        cfg.fullscreen_mode = 2;
        cfg.should_letterbox = false;
      }
      if (res) {
        cfg.res_x = res[0];
        cfg.res_y = res[1];
      }
      cfg.is_read_only = lockReadonly;
    }
    return;
  }
  await invoke('update_valorant_config', {
    path,
    setWindowed,
    res: res ? { 0: res[0], 1: res[1] } : null,
    lockReadonly,
  });
}

export async function fetchQuickShortcuts(): Promise<QuickShortcut[]> {
  if (!isTauri()) return mockShortcuts;
  return await invoke<QuickShortcut[]>('get_quick_shortcuts');
}

let mockPreferredStretched: [number, number] = [2090, 1440];

export async function fetchPreferredStretchedRes(): Promise<[number, number]> {
  if (!isTauri()) return mockPreferredStretched;
  return await invoke<[number, number]>('get_preferred_stretched_res');
}

export async function savePreferredStretchedRes(width: number, height: number): Promise<[number, number]> {
  if (!isTauri()) {
    mockPreferredStretched = [width, height];
    return mockPreferredStretched;
  }
  return await invoke<[number, number]>('set_preferred_stretched_res', { width, height });
}

export async function applyCustomResToAllConfigs(
  width: number,
  height: number,
  lockReadonly: boolean
): Promise<string> {
  if (!isTauri()) {
    mockConfigs.forEach(c => {
      c.fullscreen_mode = 2;
      c.should_letterbox = false;
      c.res_x = width;
      c.res_y = height;
      c.is_read_only = lockReadonly;
    });
    return `Successfully applied ${width}×${height} and bypassed letterbox across ${mockConfigs.length} game config(s)!`;
  }
  return await invoke<string>('apply_custom_res_to_all_configs', {
    width,
    height,
    lockReadonly,
  });
}

export async function checkRequestedTab(): Promise<string | null> {
  if (!isTauri()) return null;
  return await invoke<string | null>('check_requested_tab');
}

export function vkToName(vk: number): string {
  if (vk >= 0x70 && vk <= 0x87) return `F${vk - 0x70 + 1}`;
  if (vk >= 0x41 && vk <= 0x5A) return String.fromCharCode(vk);
  if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk);
  if (vk >= 0x60 && vk <= 0x69) return `Num ${vk - 0x60}`;
  
  switch (vk) {
    case 0x2D: return 'Insert';
    case 0x2E: return 'Delete';
    case 0x24: return 'Home';
    case 0x23: return 'End';
    case 0x21: return 'Page Up';
    case 0x22: return 'Page Down';
    case 0x20: return 'Space';
    case 0x09: return 'Tab';
    case 0x0D: return 'Enter';
    case 0x1B: return 'Esc';
    case 0x14: return 'Caps';
    case 0x2C: return 'PrintScreen';
    case 0x90: return 'NumLock';
    case 0x04: return 'Mouse 3';
    case 0x05: return 'Mouse 4';
    case 0x06: return 'Mouse 5';
    default: return `Key 0x${vk.toString(16).toUpperCase()}`;
  }
}

export function formatShortcut(binding: ShortcutBinding): string {
  if (!binding.vk) return 'Unbound';
  const parts: string[] = [];
  if (binding.ctrl) parts.push('CTRL');
  if (binding.alt) parts.push('ALT');
  if (binding.shift) parts.push('SHIFT');
  if (binding.win) parts.push('WIN');
  parts.push(vkToName(binding.vk));
  return parts.join(' + ');
}

export const trimMemory = async (): Promise<void> => {
  if (!isTauri()) return;
  try {
    await invoke('trim_memory');
  } catch (_) {}
};

let mockMonitors: MonitorDevice[] = [
  {
    device_name: '\\\\.\\DISPLAY1',
    adapter_name: 'NVIDIA GeForce RTX 3080',
    monitor_name: 'Secondary Portrait Monitor',
    is_attached: true,
    is_primary: false,
    width: 1080,
    height: 1920,
    refresh_rate: 60,
    position_x: -1080,
    position_y: -477,
    orientation: 'Portrait (90°)',
  },
  {
    device_name: '\\\\.\\DISPLAY2',
    adapter_name: 'NVIDIA GeForce RTX 3080',
    monitor_name: 'Philips 27" 260Hz Gaming Display',
    is_attached: true,
    is_primary: true,
    width: 2560,
    height: 1440,
    refresh_rate: 260,
    position_x: 0,
    position_y: 0,
    orientation: 'Landscape',
  },
  {
    device_name: '\\\\.\\DISPLAY3',
    adapter_name: 'NVIDIA GeForce RTX 3080',
    monitor_name: 'Auxiliary Overhead Monitor',
    is_attached: true,
    is_primary: false,
    width: 1920,
    height: 1080,
    refresh_rate: 60,
    position_x: 0,
    position_y: -1080,
    orientation: 'Landscape',
  },
];

export async function fetchAllMonitors(): Promise<MonitorDevice[]> {
  if (!isTauri()) return mockMonitors;
  return await invoke<MonitorDevice[]>('get_all_monitors');
}

export async function setMonitorAttached(
  deviceName: string,
  attached: boolean
): Promise<MonitorDevice[]> {
  if (!isTauri()) {
    mockMonitors = mockMonitors.map((m) =>
      m.device_name === deviceName ? { ...m, is_attached: attached } : m
    );
    return mockMonitors;
  }
  return await invoke<MonitorDevice[]>('set_monitor_attached', {
    deviceName,
    attached,
  });
}

export async function setMonitorPrimary(
  deviceName: string
): Promise<MonitorDevice[]> {
  if (!isTauri()) {
    mockMonitors = mockMonitors.map((m) => ({
      ...m,
      is_primary: m.device_name === deviceName,
    }));
    return mockMonitors;
  }
  return await invoke<MonitorDevice[]>('set_monitor_primary', { deviceName });
}

export async function launchCru(): Promise<void> {
  if (!isTauri()) {
    alert('Custom Resolution Utility (CRU) launched (Mock)');
    return;
  }
  await invoke('launch_cru');
}

export async function restartGraphicsDriver(): Promise<string> {
  if (!isTauri()) {
    return 'Mock: Graphics driver restarted successfully!';
  }
  return await invoke<string>('restart_graphics_driver');
}

export async function resetAllCruOverrides(): Promise<string> {
  if (!isTauri()) {
    return 'Mock: All EDID overrides reset successfully!';
  }
  return await invoke<string>('reset_all_cru_overrides');
}

