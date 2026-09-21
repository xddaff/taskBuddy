"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type KeyboardEvent } from "react";
import { errorMessage, postJson } from "@/components/post-json";

type SkillsEditorProps = {
  initialSkills: string[];
  suggestions?: string[];
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function SkillsEditor({ initialSkills, suggestions = [] }: SkillsEditorProps) {
  const router = useRouter();
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSkill(raw: string) {
    const skill = normalize(raw);
    if (!skill) return;
    setSkills((current) => (current.includes(skill) ? current : [...current, skill]));
    setSaved(false);
  }

  function removeSkill(skill: string) {
    setSkills((current) => current.filter((item) => item !== skill));
    setSaved(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill(draft);
      setDraft("");
      return;
    }
    if (event.key === "Backspace" && draft === "" && skills.length > 0) {
      removeSkill(skills[skills.length - 1]);
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    // A skill left in the input has not been turned into a chip yet; saving should keep it.
    const pendingDraft = normalize(draft);
    const payload = pendingDraft && !skills.includes(pendingDraft) ? [...skills, pendingDraft] : skills;
    try {
      await postJson("/api/profile", { skills: payload });
      setSkills(payload);
      setDraft("");
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const unusedSuggestions = suggestions.filter((suggestion) => !skills.includes(suggestion));
  const busy = saving || pending;

  return (
    <div>
      <label htmlFor="skill-input" className="block text-sm font-medium">
        Your skills and interests
      </label>
      <p className="mt-1 text-sm text-muted">
        Type a skill and press Enter or comma to add it. Skills are matched against the labels on
        GitLab issues, so terms like <span className="font-medium text-ink">frontend</span> or{" "}
        <span className="font-medium text-ink">testing</span> work best.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-sm font-medium text-slate-700"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              aria-label={`Remove ${skill}`}
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted transition hover:bg-slate-300 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
            >
              <span aria-hidden>&times;</span>
            </button>
          </span>
        ))}
        <input
          id="skill-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            addSkill(draft);
            setDraft("");
          }}
          placeholder={skills.length === 0 ? "e.g. frontend, testing, docs" : "Add another skill"}
          className="min-w-[12rem] flex-1 border-0 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted"
        />
      </div>

      {unusedSuggestions.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Labels used in this project
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unusedSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addSkill(suggestion)}
                className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-muted transition hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save skills"}
        </button>
        {saved && !busy ? <span className="text-sm text-emerald-700">Skills saved</span> : null}
        {error ? (
          <span role="alert" className="text-sm text-red-600">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
