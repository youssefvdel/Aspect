#![allow(dead_code)]
use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum AspectRatioChoice {
    TrueStretch145, // 1.45:1
    FourThree,      // 4:3 (1.333)
    FiveFour,       // 5:4 (1.25)
    SixteenTen,     // 16:10 (1.6)
    FourFive,       // 4:5 (0.8)
    FiveThree,      // 5:3 (1.667)
    Custom,
}

impl AspectRatioChoice {
    pub fn all() -> &'static [AspectRatioChoice] {
        &[
            AspectRatioChoice::TrueStretch145,
            AspectRatioChoice::FourThree,
            AspectRatioChoice::FiveFour,
            AspectRatioChoice::SixteenTen,
            AspectRatioChoice::FourFive,
            AspectRatioChoice::FiveThree,
            AspectRatioChoice::Custom,
        ]
    }

    pub fn label(&self) -> &'static str {
        match self {
            AspectRatioChoice::TrueStretch145 => "1.45:1 (True Stretch)",
            AspectRatioChoice::FourThree => "4:3 (Classic)",
            AspectRatioChoice::FiveFour => "5:4 (Ultra)",
            AspectRatioChoice::SixteenTen => "16:10 (Balanced)",
            AspectRatioChoice::FourFive => "4:5 (Hyper)",
            AspectRatioChoice::FiveThree => "5:3 (Wide)",
            AspectRatioChoice::Custom => "Custom Ratio",
        }
    }

    pub fn short_name(&self) -> &'static str {
        match self {
            AspectRatioChoice::TrueStretch145 => "1.45:1",
            AspectRatioChoice::FourThree => "4:3",
            AspectRatioChoice::FiveFour => "5:4",
            AspectRatioChoice::SixteenTen => "16:10",
            AspectRatioChoice::FourFive => "4:5",
            AspectRatioChoice::FiveThree => "5:3",
            AspectRatioChoice::Custom => "Custom",
        }
    }

    pub fn calculate_width(&self, height: u32, custom_ratio: f32) -> u32 {
        let raw_w = match self {
            AspectRatioChoice::TrueStretch145 => {
                let raw = ((height as f64) * 1.45).round() as u32;
                return ((raw + 4) / 8) * 8;
            }
            AspectRatioChoice::FourThree => (height as f64 * (4.0 / 3.0)).round() as u32,
            AspectRatioChoice::FiveFour => (height as f64 * (5.0 / 4.0)).round() as u32,
            AspectRatioChoice::SixteenTen => (height as f64 * (16.0 / 10.0)).round() as u32,
            AspectRatioChoice::FourFive => (height as f64 * (4.0 / 5.0)).round() as u32,
            AspectRatioChoice::FiveThree => (height as f64 * (5.0 / 3.0)).round() as u32,
            AspectRatioChoice::Custom => (height as f64 * (custom_ratio.max(0.1) as f64)).round() as u32,
        };

        let mut even_w = raw_w;
        if even_w % 2 != 0 {
            even_w += 1;
        }
        even_w
    }

    pub fn presets_for_ratio(&self) -> Vec<(u32, u32, &'static str)> {
        match self {
            AspectRatioChoice::TrueStretch145 => vec![
                (2088, 1440, "2088×1440 (Gold Standard)"),
                (1568, 1080, "1568×1080"),
                (1048, 720, "1048×720"),
                (3136, 2160, "3136×2160"),
            ],
            AspectRatioChoice::FourThree => vec![
                (1920, 1440, "1920×1440"),
                (1440, 1080, "1440×1080"),
                (1280, 960, "1280×960"),
                (1024, 768, "1024×768"),
            ],
            AspectRatioChoice::FiveFour => vec![
                (1800, 1440, "1800×1440"),
                (1350, 1080, "1350×1080"),
                (1280, 1024, "1280×1024"),
                (960, 768, "960×768"),
            ],
            AspectRatioChoice::SixteenTen => vec![
                (2304, 1440, "2304×1440"),
                (1728, 1080, "1728×1080"),
                (1680, 1050, "1680×1050"),
                (1440, 900, "1440×900"),
            ],
            AspectRatioChoice::FourFive => vec![
                (1152, 1440, "1152×1440"),
                (864, 1080, "864×1080"),
                (576, 720, "576×720"),
                (1728, 2160, "1728×2160"),
            ],
            AspectRatioChoice::FiveThree => vec![
                (2400, 1440, "2400×1440"),
                (1800, 1080, "1800×1080"),
                (1200, 720, "1200×720"),
            ],
            AspectRatioChoice::Custom => vec![
                (2090, 1440, "1440p Base"),
                (1569, 1080, "1080p Base"),
                (1044, 720, "720p Base"),
            ],
        }
    }
}

#[allow(dead_code)]
#[derive(Clone, Debug)]
pub struct ResolutionPreset {
    pub name: &'static str,
    pub native_w: u32,
    pub native_h: u32,
    pub true_stretch_w: u32,
    pub true_stretch_h: u32,
    pub true_stretch_ratio: f32,
    pub classic_4_3_w: u32,
    pub classic_4_3_h: u32,
    pub description: &'static str,
}

pub fn get_presets() -> Vec<ResolutionPreset> {
    vec![
        ResolutionPreset {
            name: "2K / QHD (1440p)",
            native_w: 2560,
            native_h: 1440,
            true_stretch_w: 2088,
            true_stretch_h: 1440,
            true_stretch_ratio: 2088.0 / 1440.0,
            classic_4_3_w: 1920,
            classic_4_3_h: 1440,
            description: "Gold standard for 27\" 1440p gaming monitors. 2088×1440 is 8-pixel aligned and works universally on all GPUs (AMD, NVIDIA, Intel).",
        },
        ResolutionPreset {
            name: "FHD (1080p)",
            native_w: 1920,
            native_h: 1080,
            true_stretch_w: 1568,
            true_stretch_h: 1080,
            true_stretch_ratio: 1568.0 / 1080.0,
            classic_4_3_w: 1440,
            classic_4_3_h: 1080,
            description: "Standard for 1080p gaming monitors. 1568×1080 is 8-pixel aligned for all GPUs.",
        },
        ResolutionPreset {
            name: "HD (720p)",
            native_w: 1280,
            native_h: 720,
            true_stretch_w: 1048,
            true_stretch_h: 720,
            true_stretch_ratio: 1048.0 / 720.0,
            classic_4_3_w: 960,
            classic_4_3_h: 720,
            description: "Low-end / laptop preset for maximum FPS.",
        },
        ResolutionPreset {
            name: "4K / UHD (2160p)",
            native_w: 3840,
            native_h: 2160,
            true_stretch_w: 3136,
            true_stretch_h: 2160,
            true_stretch_ratio: 3136.0 / 2160.0,
            classic_4_3_w: 2880,
            classic_4_3_h: 2160,
            description: "High-resolution 4K stretch.",
        },
    ]
}

pub fn calculate_1_45_for_height(height: u32) -> u32 {
    let raw = ((height as f64) * 1.45).round() as u32;
    ((raw + 4) / 8) * 8
}

#[allow(dead_code)]
pub fn calculate_1_45_for_width(width: u32) -> u32 {
    ((width as f32) / 1.4514).round() as u32
}

pub fn get_primary_screen_size() -> (u32, u32) {
    unsafe {
        let w = GetSystemMetrics(SM_CXSCREEN);
        let h = GetSystemMetrics(SM_CYSCREEN);
        (w as u32, h as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_1_45_resolution_calculations() {
        assert_eq!(calculate_1_45_for_height(720), 1048);
        assert_eq!(calculate_1_45_for_height(1080), 1568);
        assert_eq!(calculate_1_45_for_height(1440), 2088);
        assert_eq!(calculate_1_45_for_height(2160), 3136);

        // Verify all computed resolutions satisfy the 1.45 threshold and are 8-pixel aligned
        for h in [720, 1080, 1440, 2160] {
            let w = calculate_1_45_for_height(h);
            let ratio = (w as f64) / (h as f64);
            assert!(ratio >= 1.45, "Height {} produced ratio {} which is < 1.45", h, ratio);
            assert_eq!(w % 8, 0, "Width {} must be 8-pixel aligned for GPU hardware compatibility", w);
        }
    }

    #[test]
    fn test_presets_exist() {
        let presets = get_presets();
        assert_eq!(presets.len(), 4);
        for p in presets {
            let ratio = (p.true_stretch_w as f32) / (p.true_stretch_h as f32);
            assert!(ratio >= 1.45, "Preset {} ratio {} must be >= 1.45", p.name, ratio);
        }
    }
}
