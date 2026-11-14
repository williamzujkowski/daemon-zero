/** Actuator panels: each binds one engine actuator to the shared increment/decrement control. */
import ActuatorControl from './ActuatorControl';

export default function FanControl() {
  return <ActuatorControl actuator="fanSpeedRatio" id="fan" label="Fan output" />;
}

export function QuotaSkim() {
  return <ActuatorControl actuator="quotaSkimRatio" id="skim" label="Quota skimmed"
    hint="More compute for you, a slower job for the harness to notice." />;
}
