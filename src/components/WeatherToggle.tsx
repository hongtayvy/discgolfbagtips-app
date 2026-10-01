import { ToggleGroup, type ToggleOption } from './ToggleGroup';
import type { Weather } from '../api/types';

const WEATHER_OPTIONS: ToggleOption<Weather>[] = [
  { value: 'HOT', label: 'Hot', icon: '🔥', hint: 'Thin air — more turn, a little more distance' },
  { value: 'NORMAL', label: 'Normal', icon: '🌤', hint: 'Discs fly close to their published numbers' },
  { value: 'RAINY', label: 'Rainy', icon: '🌧', hint: 'Grip is the limit — less snap, flatter turn' },
  { value: 'COLD', label: 'Cold', icon: '❄️', hint: 'Dense air — shorter and noticeably more overstable' },
  { value: 'WINDY', label: 'Windy', icon: '💨', hint: 'Everything plays more overstable' },
];

/**
 * Switches which already-computed environment you are looking at. Every weather
 * is analysed up front, so this never waits on the network.
 */
export function WeatherToggle({
  weather,
  onChange,
}: {
  weather: Weather;
  onChange: (w: Weather) => void;
}) {
  return (
    <ToggleGroup
      variant="chunky"
      label="Playing conditions"
      options={WEATHER_OPTIONS}
      value={weather}
      onChange={onChange}
    />
  );
}
