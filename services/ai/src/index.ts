/**
 * Public exports for the AI worker package (M9).
 */
export {
  runPipeline,
  classifySensitivity,
  extractThemes,
  findContradictions,
  buildInterviewPrompts,
  type AnalysisPayload,
  type AnalysisTheme,
  type AnalysisClaim,
  type AnalysisFact,
  type AnalysisOpportunity,
  type AnalysisInterviewPrompt,
  type PipelineInput,
  type SubmissionRow,
  type AnswerRow,
  type QuestionItemRow,
} from './pipeline.js';
export { processSubmission, processAllSubmitted, defaultWorker } from './worker.js';
export {
  detectCrossTeamSynergies,
  type SynergyDetectionOptions,
  type SynergyDetectionResult,
} from './synergyDetector.js';
export {
  rollupTeamBadges,
  type TeamBadgeRollupOptions,
  type TeamBadgeRollupResult,
} from './teamBadgeRollup.js';
export {
  runRetentionWorker,
  type RetentionWorkerOptions,
  type RetentionWorkerResult,
} from './retentionWorker.js';
export {
  loadAiConfig,
  parseAiConfig,
  resolveRoute,
  RouteNotApprovedError,
  type AiConfig,
  type ResolvedRoute,
} from './llm/config.js';
export { CostCeilingError } from './llm/costs.js';
export {
  runLlmPipeline,
  OutputValidationError,
  TenantIsolationError,
  type AnalysisMeta,
  type LlmPipelineResult,
} from './llm/llmPipeline.js';
export {
  MockProvider,
  OpenAICompatibleProvider,
  AnthropicProvider,
  ProviderRefusalError,
  createProvider,
  type ModelProvider,
} from './llm/providers.js';
export { PROMPT_VERSION } from './llm/prompt.js';
