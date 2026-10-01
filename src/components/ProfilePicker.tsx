import { ToggleGroup, type ToggleOption } from './ToggleGroup';
import type { CourseType, PlayerProfile, SkillLevel, ThrowingStyle } from '../api/types';

const SKILL: ToggleOption<SkillLevel>[] = [
  { value: 'BEGINNER', label: 'Beginner', hint: 'Under about 250 ft' },
  { value: 'INTERMEDIATE', label: 'Intermediate', hint: '250–350 ft' },
  { value: 'ADVANCED', label: 'Advanced', hint: '350–425 ft' },
  { value: 'PROFESSIONAL', label: 'Pro', hint: '425 ft and up' },
];

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

export function ProfilePicker({
  profile,
  onChange,
}: {
  profile: PlayerProfile;
  onChange: (p: PlayerProfile) => void;
}) {
  return (
    <div className="picker-grid">
      <ToggleGroup
        label="Skill level"
        options={SKILL}
        value={profile.skillLevel}
        onChange={(skillLevel) => onChange({ ...profile, skillLevel })}
      />
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
