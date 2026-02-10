#!/usr/bin/env node
import { audit } from './index.js';

const result = audit();
const status = result.ok ? 'OK' : 'FAIL';

console.log(`[a11y-ai] ${status}`);
for (const message of result.messages) {
  console.log(`- ${message}`);
}
