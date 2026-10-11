// ============================================================
// AiTab — AI Chat Tab for the Context Panel
//
// Renders inside the Context Panel's existing scrollable content
// area. Provides a compact chat interface for natural language
// chart generation with full response logging.
//
// Recent change: Added full logging — raw AI response is always
// visible via expandable viewer on every response path (success,
// empty commands, and parse errors). Token usage + finish reason
// shown inline after each response.
// Styling: message bubbles sit on bg-active; the AI is marked with
// the Sparkles icon; actions use the shared Button.
// ============================================================

import { useRef, useEffect, useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Send, Sparkles, Square } from "lucide-react";
import { useAiChatStore } from "../../../stores/aiChatStore";
import { useSettingsStore } from "../../../stores/settingsStore";
import { generateAiCommandsStream } from "../../../utils/aiService";
import { executeAiCommands, previewAiCommands } from "../../../utils/aiCommandExecutor";
import type { AiParseError } from "../../../utils/aiService";
import { useToastStore } from "../../../stores/toastStore";
import { Button } from "../../common/Button";
import { Icon } from "../../common/Icon";

// ---- Styles ----

const tint = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;

const BUBBLE: React.CSSProperties = {
  borderRadius: "var(--radius-lg)",
  background: "var(--bg-active)",
  overflow: "hidden",
};

const ROLE_LABEL: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "var(--space-4)",
  fontSize: "var(--fs-caption)", fontWeight: 600, marginBottom: "var(--space-4)",
};

const BODY_TEXT: React.CSSProperties = {
  fontSize: "var(--fs-control)", color: "var(--text-primary)", lineHeight: 1.45,
  whiteSpace: "pre-wrap", wordBreak: "break-word",
};

export function AiTab() {
  const {
    messages,
    pendingCommands,
    pendingPreview,
    pendingReasoning,
    isGenerating,
    error,
    lastTokenUsage,
    lastRawResponse,
    lastFinishReason,
    streamingContent,
    pendingQuestions,
    addUserMessage,
    addAssistantMessage,
    setPending,
    clearPending,
    setGenerating,
    setError,
    setTokenUsage,
    setLastRawResponse,
    appendStreamingContent,
    clearStreamingContent,
    setPendingQuestions,
    clearConversation,
  } = useAiChatStore();

  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const aiEndpoint = useSettingsStore((s) => s.aiEndpoint);
  const aiModel = useSettingsStore((s) => s.aiModel);
  const aiTemperature = useSettingsStore((s) => s.aiTemperature);
  const aiMaxTokens = useSettingsStore((s) => s.aiMaxTokens);
  const aiApiKey = useSettingsStore((s) => s.aiApiKey);

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);
  const [errorRawExpanded, setErrorRawExpanded] = useState(false);
  // Abort flag — when set to true, the streaming handler stops processing chunks
  const abortRef = useRef(false);
  // M4: per-generation AbortController — abort() triggers the Rust-side stream
  // cancel (ai_cancel_stream via ipc generateAiStream) so a stopped generation
  // doesn't keep draining the upstream model in the background.
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when messages change
  // Use instant scroll during streaming to avoid animation jank
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isGenerating ? "auto" : "smooth" });
  }, [messages, pendingPreview, error, isGenerating, streamingContent, lastRawResponse]);

  // Auto-resize textarea to fit content
  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  // ---- Generate handler ----
  const handleGenerate = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    addUserMessage(trimmed);
    setGenerating(true);
    clearPending();
    clearStreamingContent();
    setErrorRaw(null);
    setErrorRawExpanded(false);
    setLastRawResponse(null);
    abortRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Use streaming — tokens arrive progressively via appendStreamingContent
      const result = await generateAiCommandsStream(
        trimmed,
        messages,
        {
          endpoint: aiEndpoint,
          model: aiModel,
          temperature: aiTemperature,
          maxTokens: aiMaxTokens,
          apiKey: aiApiKey || undefined,
        },
        (token) => {
          // Stop processing tokens if the user clicked Stop
          if (abortRef.current) return;
          appendStreamingContent(token);
        },
        controller.signal,
      );

      // If aborted, save whatever we got so far and stop
      if (abortRef.current) {
        const partial = useAiChatStore.getState().streamingContent ?? "";
        clearStreamingContent();
        if (partial) {
          addAssistantMessage(partial);
          setLastRawResponse(partial, "stopped");
        }
        setGenerating(false);
        return;
      }

      // Streaming complete — clear the streaming state
      clearStreamingContent();

      // Always store the raw response and token usage for visibility
      setLastRawResponse(result.rawResponse, result.finishReason);
      if (result.promptTokens !== undefined && result.completionTokens !== undefined) {
        setTokenUsage({ prompt: result.promptTokens, completion: result.completionTokens });
      }

      // Check for clarification questions from the AI
      if (result.questions && result.questions.length > 0) {
        setPendingQuestions(result.questions);
      }

      if (result.commands.length === 0) {
        addAssistantMessage(result.rawResponse);
        setGenerating(false);
        return;
      }

      // Generate preview and store pending commands
      const preview = previewAiCommands(result.commands);
      setPending(result.commands, preview, result.reasoning);
      addAssistantMessage(result.rawResponse);
      setGenerating(false);
    } catch (err) {
      clearStreamingContent();
      if (abortRef.current) {
        // User stopped — not an error
        setGenerating(false);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const rawResp = (err as AiParseError)?.rawResponse;
      setError(message);
      setErrorRaw(rawResp ?? null);
      if (rawResp) setLastRawResponse(rawResp);
    }
  }, [input, isGenerating, messages, aiEndpoint, aiModel, aiTemperature, aiMaxTokens, aiApiKey,
    addUserMessage, addAssistantMessage, setGenerating, clearPending, setPending, setError,
    setTokenUsage, setLastRawResponse, appendStreamingContent, clearStreamingContent, setPendingQuestions]);

  // ---- Apply handler ----
  const handleApply = useCallback(() => {
    if (!pendingCommands) return;
    try {
      const result = executeAiCommands(pendingCommands);
      clearPending();
      useToastStore.getState().addToast({
        message: `AI applied: ${result.notesCreated} notes, ${result.eventsCreated} events, ${result.linesCreated} lines`,
        type: "success",
      });
    } catch (err) {
      useToastStore.getState().addToast({
        message: `AI execution failed: ${err instanceof Error ? err.message : String(err)}`,
        type: "error",
      });
    }
  }, [pendingCommands, clearPending]);

  const handleDiscard = useCallback(() => { clearPending(); }, [clearPending]);

  // ---- Stop handler — aborts the current streaming generation ----
  const handleStop = useCallback(() => {
    abortRef.current = true;
    // M4: cancel the Rust-side stream too (not just stop processing tokens) so the
    // abandoned upstream request is dropped instead of draining in the background.
    abortControllerRef.current?.abort();
    // Save whatever streamed so far as a partial response
    const partial = useAiChatStore.getState().streamingContent ?? "";
    clearStreamingContent();
    if (partial) {
      addAssistantMessage(partial);
      setLastRawResponse(partial, "stopped");
    }
    setGenerating(false);
  }, [clearStreamingContent, addAssistantMessage, setLastRawResponse, setGenerating]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
  }, [handleGenerate]);

  // ---- Not enabled state ----
  if (!aiEnabled) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-12)", padding: "var(--space-32) var(--space-16)", textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-full)", background: "var(--accent-tint)", color: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon icon={Sparkles} size={20} />
        </div>
        <div style={{ fontSize: "var(--fs-body)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          AI generation is disabled.<br />
          Enable it in <span style={{ color: "var(--text-primary)" }}>Settings &gt; AI generation</span>.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", minHeight: 0 }}>
      {/* ---- Messages area ---- */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-6)", paddingBottom: "var(--space-6)", minHeight: 0 }}>
        {/* Empty state */}
        {messages.length === 0 && !isGenerating && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-8)", padding: "var(--space-20) var(--space-8) var(--space-12)", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", fontSize: "var(--fs-headline)", color: "var(--text-primary)", fontWeight: 600 }}>
              <span style={{ display: "inline-flex", color: "var(--accent-primary)" }}><Icon icon={Sparkles} size={16} /></span>
              AI chart generation
            </div>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 220 }}>
              Describe what to generate in natural language. The AI will output structured commands that you can preview and apply.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", justifyContent: "center", marginTop: "var(--space-4)" }}>
              {["5 tap notes from beat 6 to 11", "Circle motion from beat 0 to 32", "Fade in the selected line", "Add a sine wave of drag notes"].map((s) => (
                <Button key={s} size="sm" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}

        {/* Streaming / generating bubble */}
        {isGenerating && (
          <div style={BUBBLE}>
            <div style={{ padding: "var(--space-6) var(--space-10)" }}>
              <AiRoleLabel />
              {streamingContent ? (
                /* Tokens are arriving — show text progressively */
                <div style={BODY_TEXT}>
                  {streamingContent}
                  <span style={{ display: "inline-flex", marginLeft: "var(--space-2)", verticalAlign: "middle" }}><LoadingDots /></span>
                </div>
              ) : (
                /* Waiting for first token */
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", padding: "var(--space-2) 0" }}>
                  <LoadingDots />
                  <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>Generating…</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div style={{ borderRadius: "var(--radius-lg)", background: tint("--error", 10), overflow: "hidden" }}>
            <div style={{ padding: "var(--space-8) var(--space-10)", fontSize: "var(--fs-control)", color: "var(--error)", lineHeight: 1.4, wordBreak: "break-word" }}>
              <strong>Error:</strong> {error}
            </div>
            {errorRaw && (
              <ExpandableRaw label="Raw AI response" content={errorRaw} expanded={errorRawExpanded} onToggle={() => setErrorRawExpanded(!errorRawExpanded)} accentColor="var(--error)" />
            )}
          </div>
        )}

        {/* ---- Token usage + finish reason (shown after last response) ---- */}
        {!isGenerating && (lastTokenUsage || lastFinishReason) && messages.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", padding: "var(--space-2) var(--space-4)", fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
            {lastTokenUsage && <span>{lastTokenUsage.prompt}p + {lastTokenUsage.completion}c = {lastTokenUsage.prompt + lastTokenUsage.completion} tokens</span>}
            {lastFinishReason && <span>finish: {lastFinishReason}</span>}
          </div>
        )}

        {/* ---- Raw response viewer (always available after any response) ---- */}
        {!isGenerating && lastRawResponse && !error && (
          <RawResponseCard rawResponse={lastRawResponse} />
        )}

        {/* ---- Clarification questions card ---- */}
        {pendingQuestions && pendingQuestions.length > 0 && (
          <div style={{ borderRadius: "var(--radius-lg)", background: tint("--warning", 8), overflow: "hidden" }}>
            <div style={{ padding: "var(--space-6) var(--space-10)", fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--warning)" }}>
              Clarification needed
            </div>
            <div style={{ padding: "var(--space-2) var(--space-10) var(--space-8)", fontSize: "var(--fs-control)", lineHeight: 1.6, color: "var(--text-primary)" }}>
              {pendingQuestions.map((q, i) => (
                <div key={i} style={{ marginBottom: 3 }}>
                  {i + 1}. {q}
                </div>
              ))}
            </div>
            <div style={{ padding: "0 var(--space-10) var(--space-8)", fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
              Type your answer below to continue.
            </div>
          </div>
        )}

        {/* ---- Preview card ---- */}
        {pendingCommands && pendingPreview && (
          <div style={BUBBLE}>
            {/* Header */}
            <button type="button" onClick={() => setPreviewExpanded(!previewExpanded)} aria-expanded={previewExpanded} className="ui-hover"
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--space-6)", padding: "var(--space-6) var(--space-10)", border: "none", cursor: "pointer", color: "var(--text-primary)", fontSize: "var(--fs-control)", fontWeight: 600, fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ display: "inline-flex", color: "var(--text-secondary)" }}><Icon icon={previewExpanded ? ChevronDown : ChevronRight} size={12} /></span>
              <span>Preview ({pendingCommands.length} command{pendingCommands.length !== 1 ? "s" : ""})</span>
            </button>
            {/* Reasoning */}
            {previewExpanded && pendingReasoning && (
              <div style={{ padding: "var(--space-4) var(--space-10) var(--space-6)", fontSize: "var(--fs-caption)", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.4, borderBottom: "var(--rule) solid var(--separator)" }}>
                {pendingReasoning}
              </div>
            )}
            {/* Preview lines */}
            {previewExpanded && (
              <div style={{ padding: "var(--space-6) var(--space-10)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", lineHeight: 1.6, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {pendingPreview.split("\n").map((line, i) => {
                  let c = "var(--text-secondary)";
                  if (line.startsWith("+")) c = "var(--success)";
                  else if (line.startsWith("-")) c = "var(--error)";
                  else if (line.startsWith("!")) c = "var(--warning)";
                  else if (line.startsWith("~")) c = "var(--info)";
                  else if (line.startsWith("#")) c = "var(--accent-primary)";
                  return <div key={i} style={{ color: c }}>{line}</div>;
                })}
              </div>
            )}
            {/* Apply / Discard */}
            <div style={{ display: "flex", gap: "var(--space-6)", padding: "var(--space-6) var(--space-10) var(--space-8)", borderTop: "var(--rule) solid var(--separator)" }}>
              <Button variant="primary" onClick={handleApply} style={{ flex: 1 }}>
                Apply
              </Button>
              <Button variant="ghost" onClick={handleDiscard} style={{ flex: 1 }}>
                Discard
              </Button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ---- Input area ---- */}
      <div style={{ flexShrink: 0, borderTop: "var(--rule) solid var(--separator)", paddingTop: "var(--space-8)" }}>
        <div style={{ position: "relative", borderRadius: "var(--radius-md)", border: `var(--hairline) solid ${isGenerating ? "var(--accent-primary)" : "var(--border-color)"}`, background: "var(--bg-tertiary)", overflow: "hidden", transition: "border-color var(--dur-base)" }}>
          <textarea ref={textareaRef} value={input}
            aria-label="Message to the AI"
            onChange={(e) => { setInput(e.target.value); handleTextareaInput(); }}
            onKeyDown={handleKeyDown} placeholder="Describe what to generate…" disabled={isGenerating} rows={1}
            style={{ display: "block", width: "100%", padding: "var(--space-8) var(--space-10)", border: "none", background: "transparent", color: "var(--text-primary)", fontSize: "var(--fs-control)", fontFamily: "inherit", lineHeight: 1.5, resize: "none", minHeight: 20, maxHeight: 120 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "var(--space-6)", gap: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
            {isGenerating ? (
              /* Stop button — shown during generation */
              <Button variant="danger" icon={Square} onClick={handleStop}>
                Stop
              </Button>
            ) : (
              /* Generate button — shown when idle */
              <Button variant="primary" icon={Send} onClick={handleGenerate} disabled={!input.trim()}>
                Generate
              </Button>
            )}
            {messages.length > 0 && !isGenerating && (
              <Button variant="ghost" onClick={clearConversation}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

/** Expandable raw text viewer — used for errors and raw response cards */
function ExpandableRaw({ label, content, expanded, onToggle, accentColor }: {
  label: string; content: string; expanded: boolean; onToggle: () => void; accentColor: string;
}) {
  return (
    <div style={{ borderTop: "var(--rule) solid var(--separator)" }}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="ui-hover"
        style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--space-6)", padding: "var(--space-4) var(--space-10)", border: "none", cursor: "pointer", color: accentColor, fontSize: "var(--fs-caption)", fontFamily: "inherit", textAlign: "left" }}>
        <Icon icon={expanded ? ChevronDown : ChevronRight} size={12} />
        <span>{label} ({content.length} chars)</span>
      </button>
      {expanded && (
        <pre style={{ padding: "var(--space-6) var(--space-10) var(--space-8)", margin: 0, fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 250, overflowY: "auto", borderTop: "var(--rule) solid var(--separator)" }}>
          {content}
        </pre>
      )}
    </div>
  );
}

/** Card that shows the raw AI response — always visible after a response */
function RawResponseCard({ rawResponse }: { rawResponse: string }) {
  const [expanded, setExpanded] = useState(false);

  // Try to extract a display summary from the raw response
  let summary = "";
  let prettyJson = "";
  try {
    const parsed = JSON.parse(rawResponse);
    if (parsed.reasoning) summary = parsed.reasoning;
    prettyJson = JSON.stringify(parsed, null, 2);
  } catch {
    // Not valid JSON — show as raw text
    prettyJson = rawResponse;
  }

  return (
    <div style={BUBBLE}>
      {/* Summary line */}
      {summary && (
        <div style={{ padding: "var(--space-6) var(--space-10)", fontSize: "var(--fs-caption)", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.4 }}>
          {summary}
        </div>
      )}
      {/* Expandable raw */}
      <ExpandableRaw
        label="Raw response"
        content={prettyJson}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        accentColor="var(--text-secondary)"
      />
    </div>
  );
}

/** "AI" role label with the Sparkles mark */
function AiRoleLabel() {
  return (
    <div style={{ ...ROLE_LABEL, color: "var(--accent-primary)" }}>
      <Icon icon={Sparkles} size={12} />
      AI
    </div>
  );
}

/** Message bubble for user and assistant messages */
function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  const [rawExpanded, setRawExpanded] = useState(false);

  // For assistant messages, extract reasoning as the display text
  let displayContent = content;
  let hasRawJson = false;
  let prettyRaw = content;

  if (!isUser) {
    try {
      const parsed = JSON.parse(content);
      hasRawJson = true;
      prettyRaw = JSON.stringify(parsed, null, 2);
      if (parsed.reasoning) {
        displayContent = parsed.reasoning;
      } else {
        // No reasoning field — show a brief summary
        const cmdCount = Array.isArray(parsed.commands) ? parsed.commands.length : 0;
        displayContent = cmdCount > 0
          ? `Generated ${cmdCount} command${cmdCount !== 1 ? "s" : ""}.`
          : "Response received (no commands).";
      }
    } catch {
      // Not JSON — show as-is but still offer expandable view if long
      hasRawJson = content.length > 200;
      prettyRaw = content;
      if (content.length > 400) {
        displayContent = content.slice(0, 400) + "…";
      }
    }
  }

  return (
    <div style={BUBBLE}>
      <div style={{ padding: "var(--space-6) var(--space-10)" }}>
        {/* Role label */}
        {isUser
          ? <div style={{ ...ROLE_LABEL, color: "var(--text-secondary)" }}>You</div>
          : <AiRoleLabel />}
        {/* Content */}
        <div style={BODY_TEXT}>
          {displayContent}
        </div>
      </div>
      {/* Expandable raw for assistant messages */}
      {!isUser && hasRawJson && (
        <ExpandableRaw
          label="Full response"
          content={prettyRaw}
          expanded={rawExpanded}
          onToggle={() => setRawExpanded(!rawExpanded)}
          accentColor="var(--text-secondary)"
        />
      )}
    </div>
  );
}

/** Animated loading dots */
function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      <style>{`@keyframes aiDot { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "var(--accent-primary)", animation: `aiDot 1.2s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}
