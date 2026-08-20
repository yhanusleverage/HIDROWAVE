import os, re
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def w(rel, content):
    path = os.path.join(BASE, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("W", rel)

def patch(rel, old, new, count=1):
    path = os.path.join(BASE, rel.replace("/", os.sep))
    text = open(path, encoding="utf-8").read()
    if old not in text:
        raise SystemExit(f"PATCH MISS {rel}: {old[:80]!r}")
    text = text.replace(old, new, count)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("P", rel)

def patch_all(rel, old, new):
    path = os.path.join(BASE, rel.replace("/", os.sep))
    text = open(path, encoding="utf-8").read()
    n = text.count(old)
    if n == 0:
        raise SystemExit(f"PATCH MISS {rel}")
    text = text.replace(old, new)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("P", rel, n)


def main():
    w("src/lib/rule-procedure/validate-procedure.ts", """import {
  LAYER_PRIORITY_HINT,
  type ActuatorRef,
  type ProcedureStep,
  type ProcedureTrigger,
  type RuleProcedure,
} from './types';

export interface ProcedureValidationResult {
  valid: boolean;
  errors: string[];
}

function validateActuator(actuator: ActuatorRef, path: string, errors: string[]): void {
  if (actuator.target !== 'master' && actuator.target !== 'slave') {
    errors.push(`${path}.actuator.target invalido`);
  }
  if (!Number.isInteger(actuator.relayIndex) || actuator.relayIndex < 0 || actuator.relayIndex > 7) {
    errors.push(`${path}.actuator.relayIndex deve ser 0-7`);
  }
  if (actuator.target === 'slave' && (!actuator.slaveMac || actuator.slaveMac.trim() === '')) {
    errors.push(`${path}.actuator.slaveMac e obrigatorio para target slave`);
  }
}

function validateTrigger(trigger: ProcedureTrigger, index: number, errors: string[]): void {
  const p = `triggers[${index}]`;
  switch (trigger.type) {
    case 'time_window':
      if (!trigger.start?.trim()) errors.push(`${p}.start e obrigatorio`);
      if (!trigger.end?.trim()) errors.push(`${p}.end e obrigatorio`);
      break;
    case 'interval':
      if (typeof trigger.everyMs !== 'number' || trigger.everyMs <= 0) {
        errors.push(`${p}.everyMs deve ser > 0`);
      }
      break;
    case 'cycle_week':
      if (!Number.isInteger(trigger.weekIndex) || trigger.weekIndex < 0) {
        errors.push(`${p}.weekIndex invalido`);
      }
      break;
    case 'manual':
      break;
    default:
      errors.push(`${p}.type desconhecido`);
  }
}

function validateStep(step: ProcedureStep, index: number, errors: string[]): void {
  const p = `steps[${index}]`;
  if (!step.id?.trim()) errors.push(`${p}.id e obrigatorio`);

  switch (step.type) {
    case 'sensor_valve':
      validateActuator(step.actuator, p, errors);
      if (!step.sensor.sensor?.trim()) errors.push(`${p}.sensor.sensor e obrigatorio`);
      if (step.maxDurationMs <= 0) errors.push(`${p}.maxDurationMs deve ser > 0`);
      break;
    case 'set_relay':
      validateActuator(step.actuator, p, errors);
      if (step.state !== 'on' && step.state !== 'off') errors.push(`${p}.state invalido`);
      break;
    case 'wait':
      if (step.durationMs <= 0) errors.push(`${p}.durationMs deve ser > 0`);
      break;
    case 'hold_chemical':
      break;
    case 'invoke_rule':
      if (!step.targetRuleId?.trim()) errors.push(`${p}.targetRuleId e obrigatorio`);
      break;
    default:
      errors.push(`${p}.type desconhecido`);
  }
}

export function validateProcedure(procedure: RuleProcedure): ProcedureValidationResult {
  const errors: string[] = [];

  if (!procedure.id?.trim()) errors.push('id e obrigatorio');
  if (!procedure.name?.trim()) errors.push('name e obrigatorio');
  if (!Number.isFinite(procedure.priority) || procedure.priority < 0 || procedure.priority > 100) {
    errors.push('priority deve estar entre 0 e 100');
  }

  const hint = LAYER_PRIORITY_HINT[procedure.layer];
  if (hint && (procedure.priority < hint.min || procedure.priority > hint.max)) {
    errors.push(
      `priority ${procedure.priority} fora da faixa sugerida para ${procedure.layer} (${hint.min}-${hint.max})`
    );
  }

  if (!Array.isArray(procedure.triggers) || procedure.triggers.length === 0) {
    errors.push('triggers deve ter pelo menos um item');
  } else {
    procedure.triggers.forEach((t, i) => validateTrigger(t, i, errors));
  }

  if (!Array.isArray(procedure.steps) || procedure.steps.length === 0) {
    errors.push('steps deve ter pelo menos um item');
  } else {
    procedure.steps.forEach((s, i) => validateStep(s, i, errors));
  }

  procedure.chain?.forEach((link, i) => {
    if (!link.targetRuleId?.trim()) errors.push(`chain[${i}].targetRuleId e obrigatorio`);
    if (typeof link.delayMs !== 'number' || link.delayMs < 0) {
      errors.push(`chain[${i}].delayMs deve ser >= 0`);
    }
  });

  return { valid: errors.length === 0, errors };
}
""")

if __name__ == "__main__":
    main()
