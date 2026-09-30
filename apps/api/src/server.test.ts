import { describe, expect, it } from 'vitest';
import { createServer } from './server.js';

describe('health query', () => {
  it('returns ok', async () => {
    const server = createServer();
    const response = await server.executeOperation({ query: '{ health }' });

    expect(response.body.kind).toBe('single');
    if (response.body.kind === 'single') {
      expect(response.body.singleResult.errors).toBeUndefined();
      expect(response.body.singleResult.data).toEqual({ health: 'ok' });
    }
  });
});
