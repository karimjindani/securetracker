import { testConfig } from './test-config.js';
import { randomUUID } from 'node:crypto';

export function regressionName(label: string) {
  return `${testConfig.regressionPrefix}${label}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}
