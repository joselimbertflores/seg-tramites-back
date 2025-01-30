import * as humanizeDuration from 'humanize-duration';
export function HumanizeTime(time: number): string {
  return humanizeDuration(time, { language: 'es', round: true });
}
