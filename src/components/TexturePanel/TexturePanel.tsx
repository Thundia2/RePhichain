// ============================================================
// Texture Panel — Manage texture lines in canvas mode
//
// Shows all lines with textures, thumbnail previews, and lets
// users select, upload, change, or remove textures.
// Provides quick access to texture line properties.
// Rows hover via ui-hover; the selected line is accent-selected.
// ============================================================

import { useMemo } from "react";
import { Plus, Upload, ImageOff, SquarePen, X, Trash2, Link } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { useSelectedLineIndex, selectLineByIndex } from "../../stores/selection";
import { useTabStore } from "../../stores/tabStore";
import { SectionHeader, EmptyState } from "../common/UIKit";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

const LIST_CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--bg-active)",
  borderRadius: "var(--radius-xl)",
  overflow: "hidden",
  margin: "0 var(--space-8) var(--space-8)",
};

const DETAIL_STYLE: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "var(--fs-caption)" };

function TextureThumb({ textureName }: { textureName: string }) {
  const lineTextures = useChartStore((s) => s.lineTextures);

  const url = useMemo(() => {
    const blob = lineTextures.get(textureName);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [textureName, lineTextures]);

  if (!url) {
    return (
      <Tooltip content="Texture not loaded">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-tertiary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
          role="img"
          aria-label={`${textureName} (not loaded)`}
        >
          <Icon icon={ImageOff} size={14} />
        </div>
      </Tooltip>
    );
  }

  return (
    <img
      src={url}
      alt={textureName}
      style={{
        width: 40,
        height: 40,
        borderRadius: "var(--radius-md)",
        objectFit: "cover",
        background: "var(--bg-tertiary)",
        flexShrink: 0,
      }}
    />
  );
}

export function TexturePanel() {
  const lines = useChartStore((s) => s.chart.lines);
  const lineTextures = useChartStore((s) => s.lineTextures);
  const setLineTexture = useChartStore((s) => s.setLineTexture);
  const removeLineTexture = useChartStore((s) => s.removeLineTexture);
  const editLine = useChartStore((s) => s.editLine);
  const addLine = useChartStore((s) => s.addLine);
  const selectedLineIndex = useSelectedLineIndex();
  const openLineEventEditor = useTabStore((s) => s.openLineEventEditor);

  // Find all lines with textures
  const texturedLines = useMemo(() => {
    return lines
      .map((line, idx) => (line.texture ? { line, idx } : null))
      .filter(Boolean) as { line: (typeof lines)[0]; idx: number }[];
  }, [lines]);

  // All unique texture assets loaded
  const textureAssets = useMemo(() => {
    return [...lineTextures.entries()].map(([name, blob]) => ({
      name,
      size: blob.size,
    }));
  }, [lineTextures]);

  const handleUploadTexture = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png,.jpg,.jpeg,.webp,.gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      setLineTexture(file.name, blob);
    };
    input.click();
  };

  const handleAddTextureLine = () => {
    // Create a new line, then prompt to assign a texture
    const newIndex = lines.length;
    addLine({ name: `Texture Line ${newIndex + 1}` });
    selectLineByIndex(newIndex);
    // Prompt file pick immediately
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png,.jpg,.jpeg,.webp,.gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      setLineTexture(file.name, blob);
      editLine(newIndex, { texture: file.name });
    };
    input.click();
  };

  const handleAssignTexture = (lineIdx: number, texName: string) => {
    editLine(lineIdx, { texture: texName });
  };

  const handleRemoveTexture = (lineIdx: number) => {
    editLine(lineIdx, { texture: undefined });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: "var(--fs-body)", minHeight: 0 }}>
      {/* Header actions */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-6)",
          padding: "var(--space-8) var(--space-12)",
          borderBottom: "var(--rule) solid var(--border-color)",
          flexWrap: "wrap",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <Button variant="primary" size="sm" icon={Plus} onClick={handleAddTextureLine} title="Add a new line with a texture image">
          Add texture line…
        </Button>
        <Button size="sm" icon={Upload} onClick={handleUploadTexture} title="Upload a texture image asset">
          Upload asset…
        </Button>
        <span style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>
          {texturedLines.length} line{texturedLines.length !== 1 ? "s" : ""} &middot;{" "}
          {textureAssets.length} asset{textureAssets.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {/* Empty state */}
        {texturedLines.length === 0 && textureAssets.length === 0 ? (
          <EmptyState>
            <div style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)", marginBottom: "var(--space-4)" }}>No texture lines</div>
            <div style={{ fontSize: "var(--fs-caption)" }}>
              Import an RPE chart with textures, or click "Add texture line…" to create one.
            </div>
          </EmptyState>
        ) : (
          <>
            {/* Lines with textures */}
            {texturedLines.length > 0 && (
              <div>
                <div style={{ padding: "var(--space-4) var(--space-12)" }}>
                  <SectionHeader>Texture lines</SectionHeader>
                </div>
                <div style={LIST_CARD_STYLE}>
                  {texturedLines.map(({ line, idx }, i) => {
                    const isSelected = selectedLineIndex === idx;
                    return (
                      <div
                        key={idx}
                        className="ui-hover"
                        aria-current={isSelected ? "true" : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-10)",
                          padding: "var(--space-8) var(--space-12)",
                          borderBottom: i < texturedLines.length - 1 ? "var(--rule) solid var(--separator)" : "none",
                          background: isSelected ? "var(--accent-selected)" : undefined,
                          cursor: "pointer",
                        }}
                        onClick={() => selectLineByIndex(idx)}
                      >
                        {line.texture && <TextureThumb textureName={line.texture} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
                              fontSize: "var(--fs-control)",
                              fontWeight: isSelected ? 600 : 400,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line.name || `Line ${idx + 1}`}
                          </div>
                          <div style={DETAIL_STYLE}>
                            <span style={{ fontFamily: "var(--font-mono)" }}>#{idx}</span> &middot; {line.texture}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexShrink: 0 }}>
                          <Button
                            size="sm"
                            icon={SquarePen}
                            onClick={(e) => {
                              e.stopPropagation();
                              openLineEventEditor(idx, line.name || `Line ${idx + 1}`);
                            }}
                            title="Edit events for this texture line"
                          >
                            Events
                          </Button>
                          <IconButton
                            icon={X}
                            label="Remove texture from this line"
                            size="md"
                            danger
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTexture(idx);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Texture assets */}
            {textureAssets.length > 0 && (
              <div>
                <div style={{ padding: "var(--space-4) var(--space-12)" }}>
                  <SectionHeader>Loaded assets</SectionHeader>
                </div>
                <div style={LIST_CARD_STYLE}>
                  {textureAssets.map((asset, i) => {
                    const usedBy = lines.filter((l) => l.texture === asset.name).length;
                    return (
                      <div
                        key={asset.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-10)",
                          padding: "var(--space-8) var(--space-12)",
                          borderBottom: i < textureAssets.length - 1 ? "var(--rule) solid var(--separator)" : "none",
                        }}
                      >
                        <TextureThumb textureName={asset.name} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              color: "var(--text-primary)",
                              fontSize: "var(--fs-control)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {asset.name}
                          </div>
                          <div style={DETAIL_STYLE}>
                            {(asset.size / 1024).toFixed(0)} KB &middot; used by {usedBy} line
                            {usedBy !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexShrink: 0 }}>
                          {/* Assign to selected line button */}
                          {selectedLineIndex !== null && !lines[selectedLineIndex]?.texture && (
                            <Button
                              size="sm"
                              icon={Link}
                              onClick={() => handleAssignTexture(selectedLineIndex, asset.name)}
                              title="Assign to selected line"
                            >
                              Assign
                            </Button>
                          )}
                          {usedBy === 0 && (
                            <IconButton
                              icon={Trash2}
                              label="Delete unused asset"
                              size="md"
                              danger
                              onClick={() => removeLineTexture(asset.name)}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
