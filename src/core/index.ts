// MOD-Core — domain types, limits, geometry, frame/padding/canvas maths, pure helpers
// (specs/40-technical/modules/MOD-Core.md). Pure, synchronous, dependency-free: usable on the main
// thread and in the effects worker; no DOM, clock or language. Results carry codes and numbers.
// Types, constants, size tables, the format sniff (F-001), the canvas/fit maths and the view maths
// (F-002), the tools and shape geometry (F-003), step numbering (F-006), text (F-005), redaction geometry (F-007), the export's file name and PNG chunk whitelist (F-012) and the edit geometry (F-008: move, resize, Alt+arrows, marquee, position and size fields) and the frame maths with the padding
// sizes it allows (F-010: RULE-13, RULE-14) are real.
export * from './types';
export * from './limits';
export * from './sizes';
export * from './constants';
export * from './format';
export * from './canvas';
export * from './header';
export * from './view';
export * from './tools';
export * from './shapes';
export * from './steps';
export * from './text';
export * from './redaction';
export * from './export';
export * from './frame';
