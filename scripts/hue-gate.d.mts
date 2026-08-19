export declare const HUE_GATE_EXCEPTIONS: Set<string>;
export declare function hexHue(hex: string): number;
export declare function passesHueGate(hex: string): boolean;
export declare function findHueGateViolations(source: string): string[];
