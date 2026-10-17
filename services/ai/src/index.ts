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
