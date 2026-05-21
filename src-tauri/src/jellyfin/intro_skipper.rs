//! Intro Skipper plugin range parsing and skip decisions.

use serde::Deserialize;
use std::collections::HashMap;

const LOOKAHEAD_SECONDS: f64 = 1.0;

/// Intro Skipper segment kind supported by JMSR.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IntroSkipKind {
  Introduction,
}

/// Active Intro Skipper range for the current playback session.
#[derive(Debug, Clone, PartialEq)]
pub struct IntroSkipRange {
  pub kind: IntroSkipKind,
  pub start_seconds: f64,
  pub end_seconds: f64,
}

impl IntroSkipRange {
  fn new(kind: IntroSkipKind, start_seconds: f64, end_seconds: f64) -> Option<Self> {
    if !start_seconds.is_finite()
      || !end_seconds.is_finite()
      || start_seconds < 0.0
      || end_seconds <= start_seconds
    {
      return None;
    }

    Some(Self {
      kind,
      start_seconds,
      end_seconds,
    })
  }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct IntroSkipperPluginSegment {
  pub start: f64,
  pub end: f64,
}

pub type IntroSkipperPluginResponse = HashMap<String, IntroSkipperPluginSegment>;

/// Parse valid Introduction ranges from the Intro Skipper plugin response.
pub fn parse_intro_skipper_ranges(response: IntroSkipperPluginResponse) -> Vec<IntroSkipRange> {
  response
    .into_iter()
    .filter_map(|(kind, segment)| match kind.as_str() {
      "Introduction" => {
        IntroSkipRange::new(IntroSkipKind::Introduction, segment.start, segment.end)
      }
      _ => None,
    })
    .collect()
}

/// Return the seek target when playback is inside a skippable range.
pub fn evaluate_skip(position_seconds: f64, ranges: &[IntroSkipRange]) -> Option<f64> {
  if !position_seconds.is_finite() {
    return None;
  }

  ranges
    .iter()
    .find(|range| {
      position_seconds >= range.start_seconds - LOOKAHEAD_SECONDS
        && position_seconds < range.end_seconds
    })
    .map(|range| range.end_seconds)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn plugin_segment(start: f64, end: f64) -> IntroSkipperPluginSegment {
    IntroSkipperPluginSegment { start, end }
  }

  #[test]
  fn parses_valid_introduction_range() {
    let response = HashMap::from([("Introduction".to_string(), plugin_segment(12.5, 82.0))]);

    let ranges = parse_intro_skipper_ranges(response);

    assert_eq!(
      ranges,
      vec![IntroSkipRange {
        kind: IntroSkipKind::Introduction,
        start_seconds: 12.5,
        end_seconds: 82.0,
      }]
    );
  }

  #[test]
  fn ignores_invalid_and_unsupported_ranges() {
    let response = HashMap::from([
      ("Introduction".to_string(), plugin_segment(90.0, 80.0)),
      ("Credits".to_string(), plugin_segment(1200.0, 1260.0)),
      ("Preview".to_string(), plugin_segment(0.0, 30.0)),
      ("Unknown".to_string(), plugin_segment(10.0, 20.0)),
    ]);

    let ranges = parse_intro_skipper_ranges(response);

    assert!(ranges.is_empty());
  }

  #[test]
  fn empty_response_has_no_active_ranges() {
    let ranges = parse_intro_skipper_ranges(HashMap::new());

    assert!(ranges.is_empty());
  }

  #[test]
  fn returns_seek_target_inside_half_open_range() {
    let ranges = vec![IntroSkipRange {
      kind: IntroSkipKind::Introduction,
      start_seconds: 10.0,
      end_seconds: 80.0,
    }];

    assert_eq!(evaluate_skip(10.0, &ranges), Some(80.0));
    assert_eq!(evaluate_skip(79.99, &ranges), Some(80.0));
    assert_eq!(evaluate_skip(80.0, &ranges), None);
  }

  #[test]
  fn returns_seek_target_inside_one_second_lookahead_window() {
    let ranges = vec![IntroSkipRange {
      kind: IntroSkipKind::Introduction,
      start_seconds: 10.0,
      end_seconds: 80.0,
    }];

    assert_eq!(evaluate_skip(9.0, &ranges), Some(80.0));
    assert_eq!(evaluate_skip(8.99, &ranges), None);
  }
}
