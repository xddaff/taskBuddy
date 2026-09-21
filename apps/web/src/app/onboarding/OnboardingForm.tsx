'use client';

import { useActionState, useState } from 'react';
import { saveOnboarding, type OnboardingState } from './actions';

interface TagOption {
  id: string;
  slug: string;
  label: string;
}

interface Props {
  skillGroups: Array<{ heading: string; tags: TagOption[] }>;
  interestOptions: TagOption[];
  initial: {
    weeklyHours: number;
    commitment: string;
    experience: string;
    bio: string;
    skills: Record<string, number>;
    interests: string[];
  };
}

const COMMITMENT_OPTIONS = [
  { value: 'CASUAL', label: 'Casual', hint: 'Something I can finish in a week' },
  { value: 'MODERATE', label: 'Moderate', hint: 'A task or two per fortnight' },
  { value: 'SERIOUS', label: 'Serious', hint: 'This is my main project' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'BEGINNER', label: 'Beginner', hint: 'Still learning the basics' },
  { value: 'INTERMEDIATE', label: 'Intermediate', hint: 'Comfortable in a codebase' },
  { value: 'ADVANCED', label: 'Advanced', hint: 'Happy to take on architecture' },
];

export function OnboardingForm({ skillGroups, interestOptions, initial }: Props) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(saveOnboarding, {});

  const [skills, setSkills] = useState<Record<string, number>>(initial.skills);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [weeklyHours, setWeeklyHours] = useState(initial.weeklyHours);

  const toggleSkill = (tagId: string) => {
    setSkills((current) => {
      const next = { ...current };
      if (tagId in next) {
        delete next[tagId];
      } else {
        next[tagId] = 3;
      }
      return next;
    });
  };

  const setProficiency = (tagId: string, proficiency: number) => {
    setSkills((current) => ({ ...current, [tagId]: proficiency }));
  };

  const toggleInterest = (tagId: string) => {
    setInterests((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  };

  const selectedCount = Object.keys(skills).length;

  return (
    <form action={formAction} className="space-y-10">
      {/* Selections live in React state, so they are mirrored into hidden
          inputs for the server action to read. */}
      {Object.entries(skills).map(([tagId, proficiency]) => (
        <input key={tagId} type="hidden" name={`skill:${tagId}`} value={proficiency} />
      ))}
      {interests.map((tagId) => (
        <input key={tagId} type="hidden" name="interests" value={tagId} />
      ))}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">What can you work with?</h2>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Pick what you know, then say how confident you are. This is the strongest signal we
            use, so it is worth being honest rather than aspirational.
          </p>
        </div>

        {skillGroups.map((group) => (
          <fieldset key={group.heading} className="space-y-2">
            <legend className="text-xs font-medium uppercase tracking-wider text-(--color-ink-faint)">
              {group.heading}
            </legend>
            <div className="flex flex-wrap gap-2">
              {group.tags.map((tag) => {
                const selected = tag.id in skills;
                return (
                  <div key={tag.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => toggleSkill(tag.id)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        selected
                          ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-ink)'
                          : 'border-(--color-border-subtle) text-(--color-ink-muted) hover:border-(--color-ink-faint) hover:text-(--color-ink)'
                      } ${selected ? 'rounded-r-none' : ''}`}
                    >
                      {tag.label}
                    </button>

                    {selected && (
                      <label className="flex items-center gap-1 rounded-r-full border border-l-0 border-(--color-accent) bg-(--color-accent-soft) py-1.5 pr-2 pl-1">
                        <span className="sr-only">{tag.label} proficiency, 1 to 5</span>
                        <select
                          value={skills[tag.id]}
                          onChange={(event) =>
                            setProficiency(tag.id, Number.parseInt(event.target.value, 10))
                          }
                          className="bg-transparent text-xs text-(--color-ink) outline-none"
                        >
                          {[1, 2, 3, 4, 5].map((level) => (
                            <option key={level} value={level} className="bg-(--color-surface)">
                              {level}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <p aria-live="polite" className="text-xs text-(--color-ink-faint)">
          {selectedCount === 0
            ? 'Nothing picked yet.'
            : `${selectedCount} selected.`}
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">What are you interested in?</h2>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Things you want to work on, even if you have not yet. These carry less weight than
            skills, so it is safe to be ambitious here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {interestOptions.map((tag) => {
            const selected = interests.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleInterest(tag.id)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selected
                    ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-ink)'
                    : 'border-(--color-border-subtle) text-(--color-ink-muted) hover:border-(--color-ink-faint) hover:text-(--color-ink)'
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">How much time do you have?</h2>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            We size tasks against this, so you do not get handed a month of work for a two hour
            slot, or a trivial fix when you wanted something substantial.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm">
            <strong className="text-(--color-ink)">{weeklyHours} hours</strong> per week
          </span>
          <input
            type="range"
            name="weeklyHours"
            min={1}
            max={40}
            value={weeklyHours}
            onChange={(event) => setWeeklyHours(Number.parseInt(event.target.value, 10))}
            className="w-full accent-(--color-accent)"
          />
        </label>

        <RadioCards name="commitment" options={COMMITMENT_OPTIONS} defaultValue={initial.commitment} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">How experienced are you?</h2>
        <RadioCards name="experience" options={EXPERIENCE_OPTIONS} defaultValue={initial.experience} />
      </section>

      <section className="space-y-2">
        <label htmlFor="bio" className="text-lg font-medium">
          Anything else?
        </label>
        <p className="text-sm text-(--color-ink-muted)">
          Optional. Shown to teammates on your profile.
        </p>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={500}
          defaultValue={initial.bio}
          placeholder="Second year, mostly frontend. Trying to get better at accessibility."
          className="w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-sm placeholder:text-(--color-ink-faint) focus:border-(--color-accent) focus:outline-none"
        />
      </section>

      {state.error && (
        <p role="alert" className="rounded-lg border border-(--color-danger) bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-(--color-accent) px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Finding tasks for you...' : 'Find me tasks'}
      </button>
    </form>
  );
}

function RadioCards({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: Array<{ value: string; label: string; hint: string }>;
  defaultValue: string;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="sr-only">{name}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="cursor-pointer rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-3 transition has-checked:border-(--color-accent) has-checked:bg-(--color-accent-soft) hover:border-(--color-ink-faint)"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            className="sr-only"
          />
          <span className="block text-sm font-medium">{option.label}</span>
          <span className="mt-0.5 block text-xs text-(--color-ink-muted)">{option.hint}</span>
        </label>
      ))}
    </fieldset>
  );
}
