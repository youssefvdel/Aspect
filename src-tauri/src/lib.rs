mod calculator;
mod custom_res;
mod display;
mod game_config;
mod gpu;
mod shortcuts;
mod tracker;
mod window_manager;
mod updater;

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DisplayInfo {
    pub current_width: u32,
    pub current_height: u32,
    pub current_hz: u32,
    pub native_width: u32,
    pub native_height: u32,
    pub supported_refresh_rates: Vec<u32>,
    pub active_profile: String,
    pub device_name: String,
}

pub struct AppState {
    pub hotkey_controller: display::HotkeyController,
    pub preferred_stretched: std::sync::Arc<Mutex<(u32, u32)>>,
}

fn build_display_info() -> DisplayInfo {
    let (native_w, native_h) = display::get_native_resolution();
    let cur = display::get_current_display_mode().unwrap_or(display::DisplayMode {
        width: native_w,
        height: native_h,
        refresh_rate: 260,
    });
    let rates = display::get_supported_refresh_rates_for(cur.width, cur.height);
    let active_profile = if cur.width == native_w && cur.height == native_h {
        "native".to_string()
    } else {
        "stretched".to_string()
    };
    let dev_name = display::get_primary_device_name();

    DisplayInfo {
        current_width: cur.width,
        current_height: cur.height,
        current_hz: cur.refresh_rate,
        native_width: native_w,
        native_height: native_h,
        supported_refresh_rates: rates,
        active_profile,
        device_name: dev_name,
    }
}

#[tauri::command]
fn get_display_info() -> Result<DisplayInfo, String> {
    Ok(build_display_info())
}

#[tauri::command]
fn apply_resolution(width: u32, height: u32, hz: u32) -> Result<(), String> {
    display::apply_display_mode(width, height, hz)
}

#[tauri::command]
fn toggle_profile(state: State<'_, AppState>, app: tauri::AppHandle) -> Result<DisplayInfo, String> {
    let cur = display::get_current_display_mode().ok_or("Failed to query display mode")?;
    let (native_w, native_h) = display::get_native_resolution();

    let (target_w, target_h) = if cur.width == native_w {
        let pref = state.preferred_stretched.lock().unwrap();
        *pref
    } else {
        (native_w, native_h)
    };

    display::apply_display_mode(target_w, target_h, cur.refresh_rate)?;
    let info = build_display_info();
    let _ = app.emit("display-mode-changed", &info);
    Ok(info)
}

#[tauri::command]
fn get_preferred_stretched_res(state: State<'_, AppState>) -> Result<[u32; 2], String> {
    let pref = state.preferred_stretched.lock().unwrap();
    Ok([pref.0, pref.1])
}

#[tauri::command]
fn set_preferred_stretched_res(
    state: State<'_, AppState>,
    width: u32,
    height: u32,
) -> Result<[u32; 2], String> {
    if width == 0 || height == 0 {
        return Err("Invalid resolution dimensions".to_string());
    }
    display::save_saved_stretched_res(width, height);
    let mut pref = state.preferred_stretched.lock().unwrap();
    *pref = (width, height);
    Ok([width, height])
}

#[tauri::command]
fn apply_custom_res_to_all_configs(
    width: u32,
    height: u32,
    lock_readonly: bool,
) -> Result<String, String> {
    let count = game_config::apply_to_all_configs(width, height, lock_readonly)?;
    let lock_text = if lock_readonly {
        "and write-protected (Read-Only) against game updates"
    } else {
        "unlocked for manual in-game edits"
    };
    Ok(format!(
        "Successfully applied {}×{} {} across {} game config file(s)!",
        width, height, lock_text, count
    ))
}

#[tauri::command]
fn get_shortcut_binding() -> Result<display::ShortcutBinding, String> {
    Ok(display::load_saved_hotkey())
}

#[tauri::command]
fn save_shortcut_binding(
    state: State<'_, AppState>,
    binding: display::ShortcutBinding,
) -> Result<(), String> {
    display::save_saved_hotkey(&binding);
    state.hotkey_controller.set_shortcut(binding);
    Ok(())
}

#[tauri::command]
fn get_gpu_info() -> Result<gpu::GpuInfo, String> {
    Ok(gpu::detect_gpu())
}

#[tauri::command]
fn get_gpu_settings() -> Result<gpu::GpuSettingsReport, String> {
    Ok(gpu::get_gpu_settings_report())
}

#[tauri::command]
fn set_gpu_setting(id: String, value: bool) -> Result<gpu::GpuSettingsReport, String> {
    gpu::apply_single_gpu_setting(&id, value)
}

#[tauri::command]
fn open_gpu_panel(vendor: String) -> Result<(), String> {
    let v = match vendor.to_lowercase().as_str() {
        "nvidia" => gpu::GpuVendor::Nvidia,
        "amd" => gpu::GpuVendor::Amd,
        "intel" => gpu::GpuVendor::Intel,
        _ => gpu::GpuVendor::Unknown,
    };
    gpu::launch_control_panel(&v)
}

#[tauri::command]
fn auto_configure_gpu_scaling(state: State<'_, AppState>) -> Result<String, String> {
    let (msg, _report) = gpu::auto_configure_all_gpu_settings()?;

    let (pref_w, pref_h) = {
        let pref = state.preferred_stretched.lock().unwrap();
        *pref
    };

    let configs = game_config::find_valorant_configs();
    let mut config_count = 0;
    for cfg in configs {
        let p = std::path::Path::new(&cfg.path);
        if game_config::update_config(p, true, Some((pref_w, pref_h)), true).is_ok() {
            config_count += 1;
        }
    }

    let extra = if config_count > 0 {
        format!(" • Synchronized 1.45:1 ({}×{}) in {} game config(s)", pref_w, pref_h, config_count)
    } else {
        String::new()
    };

    Ok(format!("{}{}", msg, extra))
}

#[tauri::command]
fn get_windows() -> Result<Vec<window_manager::WindowInfo>, String> {
    Ok(window_manager::list_visible_windows())
}

#[tauri::command]
fn make_window_borderless(hwnd: isize) -> Result<String, String> {
    window_manager::make_borderless(hwnd)
}

#[tauri::command]
fn restore_window_framed(hwnd: isize) -> Result<String, String> {
    window_manager::restore_window(hwnd)
}

#[tauri::command]
fn get_valorant_configs() -> Result<Vec<game_config::ConfigFileInfo>, String> {
    Ok(game_config::find_valorant_configs())
}

#[tauri::command]
fn update_valorant_config(
    path: String,
    set_windowed: bool,
    res: Option<[u32; 2]>,
    lock_readonly: bool,
) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    let res_tuple = res.map(|r| (r[0], r[1]));
    game_config::update_config(p, set_windowed, res_tuple, lock_readonly)
}

#[tauri::command]
fn update_valorant_config_custom(
    path: String,
    options: game_config::CustomOptions,
) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    game_config::update_config_custom(p, &options)
}

#[tauri::command]
fn verify_valorant_configs(width: u32, height: u32) -> Result<Vec<game_config::VerifyResult>, String> {
    Ok(game_config::verify_all_configs(width, height))
}

#[tauri::command]
fn apply_custom_res_verbose(
    width: u32,
    height: u32,
    lock_readonly: bool,
) -> Result<Vec<game_config::ApplyResult>, String> {
    let results = game_config::apply_to_all_configs_verbose(width, height, lock_readonly);
    if results.is_empty() {
        return Err("No VALORANT GameUserSettings.ini files found. Please launch VALORANT once to generate configuration files.".to_string());
    }
    Ok(results)
}

#[tauri::command]
fn get_valorant_config_raw(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    game_config::read_config_raw(p)
}

#[tauri::command]
fn get_valorant_config_sections(path: String) -> Result<Vec<game_config::SectionInfo>, String> {
    let p = std::path::Path::new(&path);
    game_config::get_all_sections(p)
}

#[tauri::command]
fn set_valorant_config_value(
    path: String,
    section: String,
    key: String,
    value: String,
    lock_readonly: bool,
) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    game_config::set_config_value(p, &section, &key, &value, lock_readonly)
}

#[tauri::command]
fn get_quick_shortcuts() -> Result<Vec<shortcuts::QuickShortcut>, String> {
    Ok(shortcuts::load_shortcuts())
}

#[tauri::command]
fn check_requested_tab() -> Option<String> {
    if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
        let p = std::path::PathBuf::from(app_data)
            .join("TrueStretchStudio")
            .join("requested_tab.txt");
        if p.exists() {
            if let Ok(content) = std::fs::read_to_string(&p) {
                let _ = std::fs::remove_file(&p);
                return Some(content.trim().to_lowercase());
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct PROCESSENTRY32W {
    dw_size: u32,
    cnt_usage: u32,
    th32_process_id: u32,
    th32_default_heap_id: usize,
    th32_module_id: u32,
    cnt_threads: u32,
    th32_parent_process_id: u32,
    pc_pri_class_base: i32,
    dw_flags: u32,
    sz_exe_file: [u16; 260],
}

#[cfg(target_os = "windows")]
extern "system" {
    fn SetProcessWorkingSetSize(h_process: *mut std::ffi::c_void, dw_min: usize, dw_max: usize) -> i32;
    fn GetCurrentProcess() -> *mut std::ffi::c_void;
    fn GetCurrentProcessId() -> u32;
    fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut std::ffi::c_void;
    fn Process32FirstW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    fn Process32NextW(h_snapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut std::ffi::c_void;
    fn CloseHandle(h_object: *mut std::ffi::c_void) -> i32;
}

pub fn trim_working_set() {
    #[cfg(target_os = "windows")]
    unsafe {
        // 1. Trim host process itself (TrueStretchStudio)
        let handle = GetCurrentProcess();
        SetProcessWorkingSetSize(handle, usize::MAX, usize::MAX);

        // 2. Discover and trim all descendant WebView2 processes (Manager, GPU process, Renderer, Utility)
        let our_pid = GetCurrentProcessId();
        let snapshot = CreateToolhelp32Snapshot(0x00000002 /* TH32CS_SNAPPROCESS */, 0);
        if snapshot as isize != -1 && !snapshot.is_null() {
            let mut entries: Vec<(u32, u32)> = Vec::new();
            let mut entry = PROCESSENTRY32W {
                dw_size: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                cnt_usage: 0,
                th32_process_id: 0,
                th32_default_heap_id: 0,
                th32_module_id: 0,
                cnt_threads: 0,
                th32_parent_process_id: 0,
                pc_pri_class_base: 0,
                dw_flags: 0,
                sz_exe_file: [0u16; 260],
            };

            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    entries.push((entry.th32_process_id, entry.th32_parent_process_id));
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);

            // Collect all descendants (children, grandchildren)
            let mut descendant_pids = std::collections::HashSet::new();
            let mut current_parents = std::collections::HashSet::new();
            current_parents.insert(our_pid);

            for _ in 0..4 {
                let mut next_parents = std::collections::HashSet::new();
                for &(pid, parent_pid) in &entries {
                    if current_parents.contains(&parent_pid) && !descendant_pids.contains(&pid) {
                        descendant_pids.insert(pid);
                        next_parents.insert(pid);
                    }
                }
                if next_parents.is_empty() {
                    break;
                }
                current_parents = next_parents;
            }

            // Flush physical working set for all WebView2 child processes
            for pid in descendant_pids {
                // PROCESS_SET_QUOTA (0x0100) | PROCESS_QUERY_LIMITED_INFORMATION (0x1000)
                let h_proc = OpenProcess(0x0100 | 0x1000, 0, pid);
                if !h_proc.is_null() {
                    SetProcessWorkingSetSize(h_proc, usize::MAX, usize::MAX);
                    CloseHandle(h_proc);
                }
            }
        }
    }
}

#[tauri::command]
fn check_app_updates() -> Result<updater::UpdateInfo, String> {
    updater::check_for_updates()
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    updater::open_url(&url)
}

#[tauri::command]
fn trim_memory() -> Result<(), String> {
    trim_working_set();
    Ok(())
}

#[tauri::command]
fn get_all_monitors() -> Result<Vec<display::MonitorDevice>, String> {
    Ok(display::get_all_monitors())
}

/// Kept for backend compat only. The Display Manager UI no longer exposes CCD
/// Attached/Detached — only Device Manager Enable/Disable remains. Retained so
/// existing invokes / restore paths don't break.
#[tauri::command]
fn set_monitor_attached(device_name: String, attached: bool) -> Result<Vec<display::MonitorDevice>, String> {
    display::set_monitor_topology_attached(&device_name, attached)
}

#[tauri::command]
fn set_monitor_device_enabled(monitor_id: String, enabled: bool) -> Result<Vec<display::MonitorDevice>, String> {
    display::set_monitor_device_enabled(&monitor_id, enabled)
}

#[tauri::command]
fn set_monitor_primary(device_name: String) -> Result<Vec<display::MonitorDevice>, String> {
    display::set_monitor_primary(&device_name)
}

#[tauri::command]
fn launch_cru() -> Result<(), String> {
    display::launch_cru()
}

#[tauri::command]
fn restart_graphics_driver() -> Result<String, String> {
    Ok(custom_res::restart_driver_stack())
}

#[tauri::command]
fn reset_all_cru_overrides() -> Result<String, String> {
    custom_res::reset_all_edid_overrides()
}

#[tauri::command]
fn reset_all_edid_overrides() -> Result<String, String> {
    custom_res::reset_all_edid_overrides()
}

#[tauri::command]
fn test_custom_mode(width: u32, height: u32, hz: u32) -> Result<custom_res::CustomModeTest, String> {
    custom_res::validate_custom_resolution(width, height, hz)?;
    Ok(custom_res::test_display_mode(None, width, height, hz))
}

#[tauri::command]
fn add_custom_resolution(monitor_id: String, width: u32, height: u32, hz: u32) -> Result<String, String> {
    custom_res::add_custom_resolution(&monitor_id, width, height, hz)
}

#[tauri::command]
fn remove_custom_override(monitor_id: String) -> Result<String, String> {
    custom_res::remove_custom_override(&monitor_id)
}

#[tauri::command]
fn list_supported_modes() -> Result<Vec<display::DisplayMode>, String> {
    Ok(display::get_all_supported_modes())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_shortcut = display::load_saved_hotkey();
    let (hotkey_controller, rx) = display::start_hotkey_listener(initial_shortcut);

    let (_native_w, native_h) = display::get_native_resolution();
    let default_stretched_w = {
        let calc = ((native_h as f64) * 1.45).round() as u32 + 2;
        if calc % 2 != 0 {
            calc + 1
        } else {
            calc
        }
    };

    let (saved_w, saved_h) = display::load_saved_stretched_res(default_stretched_w, native_h);
    let preferred_stretched = std::sync::Arc::new(Mutex::new((saved_w, saved_h)));
    let pref_clone = std::sync::Arc::clone(&preferred_stretched);

    let app_state = AppState {
        hotkey_controller,
        preferred_stretched,
    };

    // MCP Bridge plugin enabled for automation and live MCP verification
    let builder = tauri::Builder::default().plugin(tauri_plugin_mcp_bridge::init());

    builder
        .manage(app_state)
        .setup(move |app| {
            // Pre-register Golden Ratio stretched modes into the GPU driver scaling table
            let _ = custom_res::inject_gpu_custom_mode(2090, 1440);
            let _ = custom_res::inject_gpu_custom_mode(2078, 1440);
            let _ = custom_res::inject_gpu_custom_mode(1568, 1080);
            gpu::enforce_all_gpu_scaling();

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Ok(()) = rx.recv() {
                    let cur_opt = display::get_current_display_mode();
                    let (nw, nh) = display::get_native_resolution();
                    if let Some(cur) = cur_opt {
                        let (target_w, target_h) = if cur.width == nw {
                            let pref = pref_clone.lock().unwrap();
                            *pref
                        } else {
                            (nw, nh)
                        };
                        let _ = display::apply_display_mode(target_w, target_h, cur.refresh_rate);
                        let info = build_display_info();
                        let _ = handle.emit("display-mode-changed", &info);
                    }
                }
            });

            // Automated working set trimmer to keep RAM consumption minimal across host and WebView2 child tree
            std::thread::spawn(|| {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(12));
                    trim_working_set();
                }
            });

            // Explicitly set high-res icon on the main window for crystal clear Windows taskbar & titlebar rendering
            if let Some(window) = app.get_webview_window("main") {
                let img = tauri::include_image!("icons/icon.png");
                let _ = window.set_icon(img);
            }

            // Create System Tray Menu
            let show_i = MenuItem::with_id(app, "show", "Show Aspect", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Aspect", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .tooltip("Aspect • Stretched Resolution & Utility")
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let _ = window.hide();
                    api.prevent_close();
                    trim_working_set();
                    std::thread::spawn(|| {
                        std::thread::sleep(std::time::Duration::from_millis(300));
                        trim_working_set();
                    });
                }
                tauri::WindowEvent::Focused(false) => {
                    trim_working_set();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_display_info,
            apply_resolution,
            toggle_profile,
            get_preferred_stretched_res,
            set_preferred_stretched_res,
            apply_custom_res_to_all_configs,
            get_shortcut_binding,
            save_shortcut_binding,
            get_gpu_info,
            get_gpu_settings,
            set_gpu_setting,
            open_gpu_panel,
            auto_configure_gpu_scaling,
            get_windows,
            make_window_borderless,
            restore_window_framed,
            get_valorant_configs,
            update_valorant_config,
            update_valorant_config_custom,
            verify_valorant_configs,
            apply_custom_res_verbose,
            get_valorant_config_raw,
            get_valorant_config_sections,
            set_valorant_config_value,
            tracker::detect_local_account,
            tracker::local_entitlements,
            tracker::local_client_version,
            tracker::riot_direct_get,
            tracker::trn_get,
            get_quick_shortcuts,
            check_requested_tab,
            trim_memory,
            get_all_monitors,
            set_monitor_attached,
            set_monitor_device_enabled,
            set_monitor_primary,
            launch_cru,
            restart_graphics_driver,
            reset_all_cru_overrides,
            reset_all_edid_overrides,
            test_custom_mode,
            add_custom_resolution,
            remove_custom_override,
            list_supported_modes,
            check_app_updates,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
