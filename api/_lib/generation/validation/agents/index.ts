import { verifyAnswers } from './answer-verifier.js'
import { checkQualityAndContent } from './unified-checker.js'
import { fixTask, MAX_FIXES_PER_GENERATION, type FixResult } from './task-fixer.js'
import { isStemSubject } from '../../../ai-models.js'
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

      // Include errors + DIFFICULTY_MISMATCH warnings
      const shouldFix = taskResult.status === 'error' ||
        (taskResult.status === 'warning' && taskResult.issues.some(i => i.code === 'DIFFICULTY_MISMATCH'))

      if (!shouldFix) continue

      for (const issue of taskResult.issues) {
        // For warnings, only include DIFFICULTY_MISMATCH issues
        if (taskResult.status === 'warning' && issue.code !== 'DIFFICULTY_MISMATCH') continue

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

  // 1. Run answer-verifier + unified quality/content checker in parallel
  //    (was 3 agents, now 2 — quality-checker + content-checker merged)
  const [answerResult, unifiedResult] = await Promise.all([
    verifyAnswers(tasks, params.subject, params.grade),
    checkQualityAndContent(tasks, params.subject, params.grade, params.topic, params.difficulty),
  ])

  const agents = [answerResult, unifiedResult]

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

  // Collect tasks with errors + DIFFICULTY_MISMATCH warnings for fixing
  const tasksWithErrors = collectTasksWithErrors(answerResult, unifiedResult)

  const stem = isStemSubject(params.subject)

  if (options.autoFix && tasksWithErrors.length > 0) {
    // Non-STEM (russian etc.): skip fixer entirely — flash-lite creates false positives
    if (!stem) {
      console.log(`[УчиОн] Skipping task-fixer for non-STEM subject "${params.subject}", logging ${tasksWithErrors.length} issues only`)
      for (const { taskIndex, issues } of tasksWithErrors) {
        console.log(`[УчиОн] Task ${taskIndex} issue (not fixed): ${issues[0].code} — ${issues[0].message}`)
      }
    } else {
      const toFix = tasksWithErrors.slice(0, MAX_FIXES_PER_GENERATION)

      if (tasksWithErrors.length > MAX_FIXES_PER_GENERATION) {
        console.log(`[УчиОн] Fixing ${toFix.length} of ${tasksWithErrors.length} tasks (limit: ${MAX_FIXES_PER_GENERATION})`)
      } else {
        console.log(`[УчиОн] Fixing ${toFix.length} tasks with errors...`)
      }

      // Fix sequentially to avoid overloading the API
      const fixedTasksForReVerify: { originalIndex: number; task: GeneratedTask; fixResultIndex: number }[] = []

      for (const { taskIndex, issues } of toFix) {
        const result = await fixTask(
          tasks[taskIndex],
          issues[0], // Use the first (most critical) issue
          params
        )

        fixResults.push(result)

        if (result.success && result.fixedTask) {
          fixedTasksForReVerify.push({
            originalIndex: taskIndex,
            task: result.fixedTask,
            fixResultIndex: fixResults.length - 1,
          })
        } else {
          console.log(`[УчиОн] Task ${taskIndex} fix failed: ${result.error}`)
        }
      }

      // Batch re-verification: verify ALL fixed tasks in a single call
      // (was: one verifyAnswers() call per fixed task = up to 10 Gemini calls)
      if (fixedTasksForReVerify.length > 0) {
        console.log(`[task-fixer] Batch re-verifying ${fixedTasksForReVerify.length} fixed tasks...`)

        const tasksToVerify = fixedTasksForReVerify.map(f => f.task)
        const reVerification = await verifyAnswers(tasksToVerify, params.subject, params.grade)

        let reVerifyPassed = 0
        let reVerifyReverted = 0

        for (let i = 0; i < fixedTasksForReVerify.length; i++) {
          const { originalIndex, task, fixResultIndex } = fixedTasksForReVerify[i]
          // Find the result for this task (by index in the batch)
          const taskReVerify = reVerification.tasks.find(t => t.taskIndex === i)
          const hasErrors = taskReVerify?.status === 'error'

          if (hasErrors) {
            // Revert to original — fix introduced new errors
            fixResults[fixResultIndex].success = false
            fixResults[fixResultIndex].error = 're-verification failed, reverted to original'
            reVerifyReverted++
            console.log(`[task-fixer] Task ${originalIndex} re-verification FAILED, reverted`)
          } else {
            fixedTasks[originalIndex] = task
            reVerifyPassed++
            console.log(`[УчиОн] Task ${originalIndex} fixed: ${fixResults[fixResultIndex].fixDescription}`)
          }
        }

        console.log(`[task-fixer] Re-verification: ${reVerifyPassed}/${fixedTasksForReVerify.length} passed, ${reVerifyReverted} reverted`)
      }
    }
  }

  const valid = problemTasks.length === 0
  const duration = Date.now() - start
  const fixedCount = fixResults.filter(r => r.success).length
  console.log(`[УчиОн] Multi-agent validation done in ${duration}ms: ${problemTasks.length} problem tasks, ${fixedCount} fixed, ${allIssues.length} total issues`)

  return { valid, agents, problemTasks, allIssues, fixedTasks, fixResults }
}

export { verifyAnswers } from './answer-verifier.js'
export { checkQualityAndContent } from './unified-checker.js'
export { fixTask, type FixResult } from './task-fixer.js'

// Legacy re-exports for backward compatibility (if anything imports these directly)
export { checkQualityAndContent as checkContent } from './unified-checker.js'
export { checkQualityAndContent as checkQuality } from './unified-checker.js'
