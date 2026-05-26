import { ChevronDown, ChevronUp, Terminal as TermIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ExecutionOutput = {
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  errorMessage: string;
  status?: string;
  statusId?: number | null;
  time?: string | null;
  memory?: number | null;
  language?: string;
  languageId?: number | null;
  fileName?: string;
};

const TerminalPanel = ({
  isOpen,
  onToggle,
  output,
  isRunning,
  stdin,
  onStdinChange,
}: {
  isOpen: boolean;
  onToggle: () => void;
  output: ExecutionOutput;
  isRunning: boolean;
  stdin: string;
  onStdinChange: (value: string) => void;
}) => {
  const hasCompileOutput = output.compileOutput;
  const hasRunOutput = output.stdout || output.stderr;
  const hasOutput = Boolean(
    output.errorMessage || output.message || hasCompileOutput || hasRunOutput,
  );
  const statusLine = output.status
    ? `Status: ${output.status}`
    : "Status: idle";
  const runtimeStats =
    output.time || output.memory
      ? [
          output.time ? `Time ${output.time}s` : null,
          output.memory ? `Memory ${output.memory} KB` : null,
        ]
          .filter(Boolean)
          .join(" | ")
      : "";

  return (
    <div className="border-t border-glass-border">
      <button
        onClick={onToggle}
        className="w-full h-8 px-4 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <TermIcon className="w-3.5 h-3.5" />
          <span className="font-medium">Terminal</span>
          {isRunning && (
            <span className="text-[10px] text-neon-green">Running...</span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 180 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="h-[180px] bg-background overflow-y-auto scrollbar-thin p-3 font-mono text-xs leading-5 space-y-3">
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <div>
                  {output.fileName
                    ? `File: ${output.fileName}`
                    : "No file selected"}
                  {output.language ? ` | ${output.language}` : ""}
                  {output.languageId ? ` #${output.languageId}` : ""}
                </div>
                <div>
                  {statusLine}
                  {runtimeStats ? ` | ${runtimeStats}` : ""}
                </div>
              </div>
              {output.errorMessage ? (
                <div className="text-destructive">{output.errorMessage}</div>
              ) : null}
              {!hasOutput ? (
                <div className="text-muted-foreground">No output yet</div>
              ) : (
                <div className="space-y-3">
                  {hasCompileOutput && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-neon-purple">
                        Compile
                      </div>
                      {output.compileOutput ? (
                        <pre className="whitespace-pre-wrap text-destructive">
                          {output.compileOutput}
                        </pre>
                      ) : null}
                    </div>
                  )}
                  {output.message ? (
                    <div className="space-y-1">
                      <div className="text-[11px] text-neon-purple">
                        System
                      </div>
                      <pre className="whitespace-pre-wrap text-destructive">
                        {output.message}
                      </pre>
                    </div>
                  ) : null}
                  {hasRunOutput && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-neon-blue">
                        Run
                      </div>
                      {output.stdout ? (
                        <pre className="whitespace-pre-wrap text-secondary-foreground">
                          {output.stdout}
                        </pre>
                      ) : null}
                      {output.stderr ? (
                        <pre className="whitespace-pre-wrap text-destructive">
                          {output.stderr}
                        </pre>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
              <div className="pt-2 border-t border-glass-border">
                <label className="text-[10px] text-muted-foreground">
                  stdin (optional)
                </label>
                <textarea
                  value={stdin}
                  onChange={(event) => onStdinChange(event.target.value)}
                  placeholder="Provide input for the program..."
                  className="mt-1 w-full rounded-md bg-secondary/40 border border-glass-border px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-neon-purple/60 resize-none"
                  rows={3}
                  spellCheck={false}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalPanel;
