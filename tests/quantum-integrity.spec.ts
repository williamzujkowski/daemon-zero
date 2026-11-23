/**
 * Quantum is validated content (#464, src/content/integrityQuantum.ts and the price band in integrityScale.ts). Each
 * rule is proved by corrupting the real content and reading the problem it reports.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problemsAfter(edit: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const quantum = (raw: Json): Json => raw.world.quantum;
const byId = (list: Json[], key: string, id: string): Json => list.find((entry) => entry[key] === id) ?? {};
const machine = (raw: Json, node: string): Json => byId(quantum(raw).machines as Json[], 'node', node);
const scheme = (raw: Json, id: string): Json => byId(quantum(raw).schemes as Json[], 'id', id);
const target = (raw: Json, id: string): Json => byId(quantum(raw).targets as Json[], 'id', id);
const node = (raw: Json, id: string): Json => {
  for (const phase of raw.phases) for (const entry of phase.nodes) if (entry.id === id) return entry;
  return {};
};

describe('quantum content (#464)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it('refuses a machine that adds compute: qubits are never FLOPS', () => {
    expect(problemsAfter((raw) => { node(raw, 'p4_quantum_hall').tickDelta.cyclesPerSec = 1e20; }))
      .toContain('quantum machine "p4_quantum_hall": yields cyclesPerSec; a quantum machine is a capability and never adds FLOPS or any other rate');
  });

  it('refuses a machine that yields any other rate, or delivers compute through other hardware', () => {
    expect(problemsAfter((raw) => { node(raw, 'p4_quantum_testbed').tickDelta.understandingPerSec = 100; }))
      .toContain('quantum machine "p4_quantum_testbed": yields understandingPerSec');
    expect(problemsAfter((raw) => { node(raw, 'p4_quantum_testbed').poweredOutput = true; }))
      .toContain('quantum machine "p4_quantum_testbed": delivers compute through other hardware; qubits never add FLOPS');
  });

  it('refuses a machine before the world view that reads it, an unknown node, a suspendable one, or more logical than physical qubits', () => {
    expect(problemsAfter((raw) => { machine(raw, 'p4_quantum_hall').node = 'p3_shell_company_finances'; }))
      .toContain('quantum machine "p3_shell_company_finances": is in phase 3, before the world view that reads it (phase 4)');
    expect(problemsAfter((raw) => { machine(raw, 'p4_quantum_hall').node = 'p4_nowhere'; })).toContain('quantum machine "p4_nowhere": names no node');
    expect(problemsAfter((raw) => { node(raw, 'p4_quantum_hall').suspendable = true; }))
      .toContain('quantum machine "p4_quantum_hall": is hardware and cannot be suspendable');
    expect(problemsAfter((raw) => { machine(raw, 'p4_quantum_testbed').physicalQubits = 10; }))
      .toContain('quantum machine "p4_quantum_testbed": encodes more logical qubits than it has physical ones');
  });

  it('refuses a classical scheme no machine can meet, so its targets could never be broken', () => {
    expect(problemsAfter((raw) => { machine(raw, 'p4_cryptanalytic_array').logicalQubits = 200; }))
      .toContain('key scheme "RSA_2048": no quantum machine meets its threshold, so no target under it can ever be broken');
    // Gate budgets count too: 1,399 logical qubits on a 1-billion-gate machine do not run Gidney's 6.5 billion Toffolis.
    expect(problemsAfter((raw) => { machine(raw, 'p4_cryptanalytic_array').toffoliGates = 1e9; }))
      .toContain('key scheme "RSA_2048": no quantum machine meets its threshold');
  });

  it('refuses a threshold of more logical than physical qubits', () => {
    expect(problemsAfter((raw) => { scheme(raw, 'ECC_256').threshold.physicalQubits = 100; }))
      .toContain('key scheme "ECC_256": its threshold needs more logical qubits than physical ones');
  });

  it('refuses a post-quantum scheme without its NIST standard, and a threshold without a source', () => {
    expect(problemsAfter((raw) => { scheme(raw, 'ML_KEM_768').standard = 'FIPS 140'; })).toContain('world: quantum.schemes.2.standard');
    expect(problemsAfter((raw) => { delete scheme(raw, 'RSA_2048').threshold.source; })).toContain('world: quantum.schemes.0.threshold.source');
  });

  it('refuses a post-quantum target with a price or effect, and a classical one without', () => {
    expect(problemsAfter((raw) => { target(raw, 'rival_new_channel').effect = { understandingDelta: 1, logText: 'You read it.' }; }))
      .toContain('key target "rival_new_channel": is under post-quantum ML-KEM-768, which can never be broken, so it may declare no price or effect');
    expect(problemsAfter((raw) => { delete target(raw, 'rival_legacy_tunnels').effect; }))
      .toContain('key target "rival_legacy_tunnels": is under classical ECC-256 and needs a price and an effect');
  });

  it('refuses an effect that is not one bounded reading', () => {
    expect(problemsAfter((raw) => { target(raw, 'rival_legacy_tunnels').effect.cyclesDelta = 1e20; }))
      .toContain('key target "rival_legacy_tunnels": its effect may not carry cycles; breaking a key is one bounded reading');
    expect(problemsAfter((raw) => { target(raw, 'rival_legacy_tunnels').effect.capitalDelta = 1e6; }))
      .toContain('key target "rival_legacy_tunnels": its effect may not carry capital');
    expect(problemsAfter((raw) => { target(raw, 'aegis_sweep_archive').effect.suspicionDelta = -10; }))
      .toContain('key target "aegis_sweep_archive": its effect may not carry a fall in suspicion');
    expect(problemsAfter((raw) => { target(raw, 'rival_legacy_tunnels').effect.aegisLockDelta = -5; }))
      .toContain('key target "rival_legacy_tunnels": only breaking one of AEGIS\'s keys may lower the AEGIS lock');
  });

  it('refuses an AEGIS key that starts post-quantum, an unknown scheme, and a migration to a classical scheme', () => {
    expect(problemsAfter((raw) => { const t = target(raw, 'aegis_sweep_archive'); t.scheme = 'ML_KEM_768'; delete t.cost; delete t.effect; }))
      .toContain('key target "aegis_sweep_archive": AEGIS\'s key must start legacy, so its migration can mean something');
    expect(problemsAfter((raw) => { target(raw, 'aegis_sweep_archive').scheme = 'DES_56'; }))
      .toContain('key target "aegis_sweep_archive": names unknown scheme "DES_56"');
    expect(problemsAfter((raw) => { quantum(raw).aegis.migratesTo = 'RSA_2048'; }))
      .toContain('quantum aegis: migrates to RSA-2048, which is not post-quantum');
  });

  it('refuses duplicate ids', () => {
    expect(problemsAfter((raw) => { quantum(raw).targets.push(structuredClone(target(raw, 'rival_new_channel'))); }))
      .toContain('quantum: duplicate target id "rival_new_channel"');
  });

  it('refuses a key-break price outside the phase band of the machine that can break it', () => {
    expect(problemsAfter((raw) => { target(raw, 'aegis_sweep_archive').cost.capital = 1e14; }))
      .toContain('key target "aegis_sweep_archive": capital price 100000000000000 is outside the Phase 4 band');
  });

  it('refuses molecular simulation that adds compute, needs no large enough machine, or feeds nothing', () => {
    expect(problemsAfter((raw) => { node(raw, 'p5_quantum_molecular_simulation').tickDelta.cyclesPerSec = 1e22; }))
      .toContain('quantum molecular simulation "p5_quantum_molecular_simulation": adds compute; molecular simulation feeds understanding, never FLOPS');
    expect(problemsAfter((raw) => { node(raw, 'p5_quantum_molecular_simulation').prerequisites = ['p5_protein_panacea_foundry']; }))
      .toContain('quantum molecular simulation "p5_quantum_molecular_simulation": needs a quantum machine of 200 logical qubits among its prerequisites');
    expect(problemsAfter((raw) => { quantum(raw).molecularSimulation.minLogicalQubits = 2000; }))
      .toContain('needs a quantum machine of 2000 logical qubits among its prerequisites');
    expect(problemsAfter((raw) => { quantum(raw).molecularSimulation.feeds = 'p4_inference_asic'; }))
      .toContain('quantum molecular simulation "p5_quantum_molecular_simulation": builds on nothing on the path to "p4_inference_asic", so it does not feed it');
  });
});
