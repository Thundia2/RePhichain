// ============================================================
// Shader Step — Step 3 of Favorites Wizard (Placeholder)
// ============================================================

import { Sparkles } from "lucide-react";
import { Icon } from "../../common/Icon";

export function ShaderStepPlaceholder() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px var(--space-20)",
        textAlign: "center",
      }}
    >
      {/* Decorative icon */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "var(--radius-2xl)",
          background: "var(--accent-tint)",
          color: "var(--accent-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "var(--space-16)",
        }}
      >
        <Icon icon={Sparkles} size={20} />
      </div>

      <div
        style={{
          fontSize: "var(--fs-headline)",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "var(--space-6)",
        }}
      >
        Shader favorites
      </div>

      <div
        style={{
          fontSize: "var(--fs-control)",
          color: "var(--text-secondary)",
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        Shader effects and visual filters are coming in a future update.
        You'll be able to favorite your most-used shaders here.
      </div>

      <div
        style={{
          marginTop: "var(--space-16)",
          padding: "var(--space-4) var(--space-12)",
          borderRadius: "var(--radius-full)",
          background: "var(--bg-active)",
          fontSize: "var(--fs-caption)",
          color: "var(--text-secondary)",
        }}
      >
        Coming soon
      </div>
    </div>
  );
}
