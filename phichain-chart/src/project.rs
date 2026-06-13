use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::{Path, PathBuf};
use thiserror::Error;
use uuid::Uuid;

// R1: `extra` captures any meta.json fields beyond the five named ones — Phira's
// info.yml extensions (tags, preview_start, intro, …) and the RPE round-trip
// fields (rpe_song, rpe_background, rpe_id, …). #[serde(flatten)] makes BOTH the
// load path (serde_json::from_reader in into_project) and any re-serialization
// preserve them, so opening then saving a Phira/RPE-sourced project no longer
// strips its metadata down to the five core strings. `Eq` is dropped from the
// derive because serde_json::Value is not Eq (it can hold an f64).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ProjectMeta {
    pub composer: String,
    pub charter: String,
    pub illustrator: String,
    pub name: String,
    pub level: String,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Error, Debug)]
pub enum OpenProjectError {
    #[error("missing {0} file")]
    MissingFile(&'static str),
    #[error("cannot open meta.json")]
    CannotOpenMeta(#[from] std::io::Error),
    #[error("invalid meta.json")]
    InvalidMeta(#[from] serde_json::Error),
}

#[cfg_attr(feature = "bevy", derive(bevy::prelude::Resource))]
#[derive(Debug, Clone)]
pub struct Project {
    pub path: ProjectPath,
    pub meta: ProjectMeta,

    /// A unique uuid represents a project session.
    pub id: Uuid,
}

impl Project {
    pub fn open(root_dir: PathBuf) -> Result<Self, OpenProjectError> {
        ProjectPath(root_dir).into_project()
    }
}

#[derive(Debug, Clone)]
pub struct ProjectPath(pub PathBuf);

impl ProjectPath {
    pub fn chart_path(&self) -> PathBuf {
        self.0.join("chart.json")
    }

    pub fn sub_path(&self, path: impl AsRef<Path>) -> PathBuf {
        self.0.join(path)
    }

    fn find_file(&self, name: &str, allowed_extensions: &[impl ToString]) -> Option<PathBuf> {
        std::fs::read_dir(&self.0)
            .ok()?
            .filter_map(Result::ok)
            .map(|x| x.path())
            .find(|path| {
                path.is_file()
                    && path.file_stem() == Some(name.as_ref())
                    && path.extension().is_some_and(|ext| {
                        allowed_extensions
                            .iter()
                            .any(|allowed| *allowed.to_string() == *ext)
                    })
            })
    }

    pub fn music_path(&self) -> Option<PathBuf> {
        self.find_file("music", &["wav", "mp3", "ogg", "flac"])
    }

    pub fn illustration_path(&self) -> Option<PathBuf> {
        self.find_file("illustration", &["png", "jpg", "jpeg"])
    }

    pub fn meta_path(&self) -> PathBuf {
        self.0.join("meta.json")
    }

    pub fn into_project(self) -> Result<Project, OpenProjectError> {
        if !self.chart_path().is_file() {
            return Err(OpenProjectError::MissingFile("chart.json"));
        }
        if !self
            .music_path()
            .ok_or(OpenProjectError::MissingFile("music.[wav|mp3|ogg|flac]"))?
            .is_file()
        {
            return Err(OpenProjectError::MissingFile("music.[wav|mp3|ogg|flac]"));
        }
        if !self.meta_path().is_file() {
            return Err(OpenProjectError::MissingFile("meta.json"));
        }

        let meta_file = File::open(self.meta_path())?;
        let meta: ProjectMeta = serde_json::from_reader(meta_file)?;

        Ok(Project {
            path: self,
            meta,
            id: Uuid::new_v4(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // R1: a meta.json carrying Phira/RPE fields beyond the five core strings must
    // survive a deserialize -> serialize round-trip (collected into `extra` by
    // #[serde(flatten)]) — otherwise opening then saving a project strips them.
    #[test]
    fn project_meta_preserves_unknown_fields() {
        let json = r#"{
            "composer": "C", "charter": "Ch", "illustrator": "I",
            "name": "N", "level": "Lv",
            "tags": ["a", "b"], "rpe_song": "song.ogg", "preview_start": 12.5
        }"#;
        let meta: ProjectMeta = serde_json::from_str(json).unwrap();
        assert_eq!(meta.name, "N");
        assert_eq!(meta.extra.get("rpe_song").and_then(|v| v.as_str()), Some("song.ogg"));
        assert_eq!(meta.extra.get("preview_start").and_then(|v| v.as_f64()), Some(12.5));
        // Named fields are captured by name, NOT duplicated into extra.
        assert!(!meta.extra.contains_key("name"));

        // Re-serialize and confirm the extras are still present.
        let out = serde_json::to_value(&meta).unwrap();
        assert_eq!(out.get("rpe_song").and_then(|v| v.as_str()), Some("song.ogg"));
        assert_eq!(out.get("tags").and_then(|v| v.as_array()).map(|a| a.len()), Some(2));
    }
}
