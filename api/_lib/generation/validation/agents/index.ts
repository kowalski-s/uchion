import { verifyAnswers } from './answer-verifier.js'
import { checkContent } from './content-checker.js'
import type { TaskTypeId } from '../../config/task-types.js'

// =============================================================================
// Shared agent types
// =============================================================================

export interface AgentIssue {
  code: string
  message: string
  suggestion?: string
}

export interface AgentTaskResult {
  taskIndex: number
  status: 'ok' | 'error' | 'warning'
  issues: AgentIssue[]
}

export interface AgentResult {
  agentName: string
  tasks: AgentTaskResult[]
  totalErrors: number
  totalWarnings: number
}

// =============================================================================
// Orchestrator types
// =============================================================================

export interface MultiAgentValidationResult {
  valid: boolean
  agents: AgentResult[]
  problemTasks: number[]
  allIssues: Array<{ taskIndex: number; agent: string; issue: AgentIssue }>
}

// Same shape as in ai-provider.ts
interface GeneratedTask {
  type: TaskTypeId
  question?: string
  options?: string[]
  correctIndex?: number
  correctIndices?: number[]
  explanation?: string
  correctAnswer?: string
  acceptableVariants?: string[]
  instruction?: string
  leftColumn?: string[]
  rightColumn?: string[]
  correctPairs?: [number, number][]
  textWithBlanks?: string
  blanks?: { position: number; correctAnswer: string; acceptableVariants?: string[] }[]
}

// =============================================================================
// Orchestrator
// =============================================================================

export async function runMultiAgentValidation(
  tasks: GeneratedTask[],
  params: { subject: string; grade: number; topic: string }
): Promise<MultiAgentValidationResult> {
  const start = Date.now()
  console.log(`[УчиОн] Multi-agent validation started for ${tasks.length} tasks`)

  // Run agents in parallel
  const [answerResult, contentResult] = await Promise.all([
    verifyAnswers(tasks, params.subject),
    checkContent(tasks, params.subject, params.grade, params.topic),
  ])

  const agents = [answerResult, contentResult]

  // Collect all issues
  const allIssues: Array<{ taskIndex: number; agent: string; issue: AgentIssue }> = []
  const errorTaskIndices = new Set<number>()

  for (const agentResult of agents) {
    for (const taskResult of agentResult.tasks) {
      if (taskResult.taskIndex < 0) continue // Skip agent-level warnings

      for (const issue of taskResult.issues) {
        allIssues.push({
          taskIndex: taskResult.taskIndex,
          agent: agentResult.agentName,
          issue,
        })
      }

      if (taskResult.status === 'error') {
        errorTaskIndices.add(taskResult.taskIndex)
      }
    }
  }

  const problemTasks = Array.from(errorTaskIndices).sort((a, b) => a - b)
  const valid = problemTasks.length === 0

  const duration = Date.now() - start
  console.log(`[УчиОн] Multi-agent validation done in ${duration}ms: ${problemTasks.length} problem tasks, ${allIssues.length} total issues`)

  return { valid, agents, problemTasks, allIssues }
}

export { verifyAnswers } from './answer-verifier.js'
export { checkContent } from './content-checker.js'
