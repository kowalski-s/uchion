import { getGenerationModel, getAgentsModel } from './ai-models.js';
import { DummyProvider } from './providers/dummy-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
// Re-export for convenience
export { getGenerationModel, getAgentsModel };
// =============================================================================
// Factory
// =============================================================================
export function getAIProvider() {
    const isProd = process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production';
    const aiProvider = process.env.AI_PROVIDER;
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_BASE_URL;
    const useAI = (isProd && aiProvider === 'openai' && apiKey) ||
        (aiProvider === 'polza' && apiKey) ||
        (aiProvider === 'neuroapi' && apiKey);
    console.log('[УчиОн] getAIProvider:', {
        isProd,
        AI_PROVIDER: aiProvider,
        AI_BASE_URL: baseURL || 'default',
        useAI: !!useAI,
    });
    if (useAI) {
        return new OpenAIProvider(apiKey, baseURL);
    }
    return new DummyProvider();
}
//# sourceMappingURL=ai-provider.js.map