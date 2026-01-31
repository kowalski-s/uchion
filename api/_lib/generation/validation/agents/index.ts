import { verifyAnswers } from './answer-verifier.js'
import { checkContent } from './content-checker.js'
import { checkQuality } from './quality-checker.js'
import { fixTask, MAX_FIXES_PER_GENERATION, type FixResult } from './task-fixer.js'
import type { TaskTypeId } from '../../config/task-types.js'
import type { DifficultyLevel } from '../../config/difficulty.js'

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
  fixedTasks: GeneratedTask[]
  fixResults: FixResult[]
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
// Helpers
// =============================================================================

interface TaskWithErrors {
  taskIndex: number
  issues: AgentIssue[]
}

function collectTasksWithErrors(
  ...agentResults: AgentResult[]
): TaskWithErrors[] {
  const errorMap = new Map<number, AgentIssue[]>()

  for (const agentResult of agentResults) {
    for (const taskResult of agentResult.tasks) {
      if (taskResult.taskIndex < 0) continue
      if (taskResult.status !== 'error') continue

      for (const issue of taskResult.issues) {
        const existing = errorMap.get(taskResult.taskIndex) || []
        existing.push(issue)
        errorMap.set(taskResult.taskIndex, existing)
      }
    }
  }

  return Array.from(errorMap.entries())
    .map(([taskIndex, issues]) => ({ taskIndex, issues }))
    .sort((a, b) => a.taskIndex - b.taskIndex)
}

// =============================================================================
// Orchestrator
// =============================================================================

export async function runMultiAgentValidation(
  tasks: GeneratedTask[],
  params: { subject: string; grade: number; topic: string; difficulty: DifficultyLevel },
  options: { autoFix: boolean } = { autoFix: true }
): Promise<MultiAgentValidationResult> {
  const start = Date.now()
  console.log(`[УчиОн] Multi-agent validation started for ${tasks.length} tasks`)

  // 1. Run all 3 agents in parallel
  const [answerResult, contentResult, qualityResult] = await Promise.all([
    verifyAnswers(tasks, params.subject),
    checkContent(tasks, params.subject, params.grade, params.topic),
    checkQuality(tasks, params.subject, params.grade, params.difficulty),
  ])

  const agents = [answerResult, contentResult, qualityResult]

  // 2. Collect all issues
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

  // 3. Auto-fix tasks with errors
  let fixedTasks = [...tasks]
  const fixResults: FixResult[] = []

  if (options.autoFix && problemTasks.length > 0) {
    const tasksWithErrors = collectTasksWithErrors(answerResult, contentResult, qualityResult)
    const toFix = tasksWithErrors.slice(0, MAX_FIXES_PER_GENERATION)

    if (tasksWithErrors.length > MAX_FIXES_PER_GENERATION) {
      console.log(`[УчиОн] Fixing ${toFix.length} of ${tasksWithErrors.length} tasks (limit: ${MAX_FIXES_PER_GENERATION})`)
    } else {
      console.log(`[УчиОн] Fixing ${toFix.length} tasks with errors...`)
    }

    // Fix sequentially to avoid overloading the API
    for (const { taskIndex, issues } of toFix) {
      const result = await fixTask(
        tasks[taskIndex],
        issues[0], // Use the first (most critical) issue
        params
      )

      if (result.success && result.fixedTask) {
        fixedTasks[taskIndex] = result.fixedTask
        console.log(`[УчиОн] Task ${taskIndex} fixed: ${result.fixDescription}`)
      } else {
        console.log(`[УчиОн] Task ${taskIndex} fix failed: ${result.error}`)
      }

      fixResults.push(result)
    }
  }

  const valid = problemTasks.length === 0
  const duration = Date.now() - start
  const fixedCount = fixResults.filter(r => r.success).length
  console.log(`[УчиОн] Multi-agent validation done in ${duration}ms: ${problemTasks.length} problem tasks, ${fixedCount} fixed, ${allIssues.length} total issues`)

  return { valid, agents, problemTasks, allIssues, fixedTasks, fixResults }
}

export { verifyAnswers } from './answer-verifier.js'
export { checkContent } from './content-checker.js'
export { checkQuality } from './quality-checker.js'
export { fixTask, type FixResult } from './task-fixer.js'
