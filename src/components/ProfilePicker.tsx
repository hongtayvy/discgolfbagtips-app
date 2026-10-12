import { ToggleGroup, type ToggleOption } from './ToggleGroup';
import type { CourseType, PlayerProfile, SkillLevel, ThrowingStyle } from '../api/types';
import { levelForRating, MAX_RATING, MIN_RATING, PDGA_TIERS, parseRating, rangeLabel, tierForRating } from '../lib/pdga';

const SKILL: ToggleOption<SkillLevel>[] = [
  { value: 'BEGINNER', label: 'Beginner', hint: 'Under about 250 ft' },
  { value: 'INTERMEDIATE', label: 'Intermediate', hint: '250–350 ft' },
  { value: 'ADVANCED', label: 'Advanced', hint: '350–425 ft' },
  { value: 'PROFESSIONAL', label: 'Pro', hint: '425 ft and up' },
];

const LEVEL_NAME: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  PROFESSIONAL: 'Pro',
};

const STYLE: ToggleOption<ThrowingStyle>[] = [
  { value: 'BACKHAND', label: 'Backhand', icon: '↺' },
  { value: 'FOREHAND', label: 'Forehand', icon: '↻' },
  { value: 'BOTH', label: 'Both', icon: '↔', hint: 'Equally comfortable either way' },
];

const COURSE: ToggleOption<CourseType>[] = [
  { value: 'WOODED', label: 'Wooded', icon: '🌲' },
  { value: 'OPEN', label: 'Open', icon: '🏞' },
  { value: 'MIXED', label: 'Mixed', icon: '🗺' },
];

/** How the skill level is being entered. The rating text is kept raw so typing isn't cut short. */
export interface SkillInput {
  mode: 'level' | 'pdga';
  rating: string;
}

export function ProfilePicker({
  profile,
  onChange,
  skillInput,
  onSkillInputChange,
}: {
  profile: PlayerProfile;
  onChange: (p: PlayerProfile) => void;
  skillInput: SkillInput;
  onSkillInputChange: (next: SkillInput) => void;
}) {
  const usingRating = skillInput.mode === 'pdga';
  const rating = parseRating(skillInput.rating);

  const setRatingText = (text: string) => {
    onSkillInputChange({ mode: 'pdga', rating: text });
    const parsed = parseRating(text);
    // Only a valid rating changes the level; a half-typed one leaves it as it was.
    if (parsed !== null) onChange({ ...profile, skillLevel: levelForRating(parsed) });
  };

  const switchMode = (mode: SkillInput['mode']) => {
    onSkillInputChange({ ...skillInput, mode });
    if (mode === 'pdga') {
      const parsed = parseRating(skillInput.rating);
      if (parsed !== null) onChange({ ...profile, skillLevel: levelForRating(parsed) });
    }
  };

  return (
    <div className="picker-grid">
      <div className="skill-input">
        {usingRating ? (
          <div className="toggle-group">
            <label className="toggle-group__label" htmlFor="pdga-rating">
              PDGA rating
            </label>
            <div className="rating-field">
              <input
                id="pdga-rating"
                className="rating-field__input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="e.g. 925"
                value={skillInput.rating}
                onChange={(e) => setRatingText(e.target.value.replace(/[^\d]/g, ''))}
                aria-describedby="pdga-rating-result"
                aria-invalid={skillInput.rating !== '' && rating === null}
              />
              <p id="pdga-rating-result" className="rating-field__result" aria-live="polite">
                {rating !== null ? (
                  <>
                    <span aria-hidden="true">→</span> <strong>{tierForRating(rating).name}</strong>{' '}
                    <span className="rating-field__range">({rangeLabel(tierForRating(rating))})</span>
                  </>
                ) : skillInput.rating === '' ? (
                  <>Currently {LEVEL_NAME[profile.skillLevel]}. Type your rating to change it.</>
                ) : (
                  <>Enter a rating between {MIN_RATING} and {MAX_RATING}.</>
                )}
              </p>
            </div>
            <p className="skill-input__bands">
              {PDGA_TIERS.map((t) => `${t.name} ${rangeLabel(t)}`).join(' · ')}
            </p>
          </div>
        ) : (
          <ToggleGroup
            label="Skill level"
            options={SKILL}
            value={profile.skillLevel}
            onChange={(skillLevel) => onChange({ ...profile, skillLevel })}
          />
        )}
        <button
          type="button"
          className="link-button skill-input__switch"
          onClick={() => switchMode(usingRating ? 'level' : 'pdga')}
        >
          {usingRating ? 'Pick a level instead' : 'Use my PDGA rating instead'}
        </button>
      </div>

      <ToggleGroup
        label="Dominant throw"
        options={STYLE}
        value={profile.throwingStyle}
        onChange={(throwingStyle) => onChange({ ...profile, throwingStyle })}
      />
      <ToggleGroup
        label="Typical course"
        options={COURSE}
        value={profile.courseType}
        onChange={(courseType) => onChange({ ...profile, courseType })}
      />
    </div>
  );
}
