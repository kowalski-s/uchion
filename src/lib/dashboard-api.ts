import type { WorksheetListItem } from '../../shared/types'

export async function fetchRecentWorksheets(): Promise<WorksheetListItem[]> {
  const res = await fetch('/api/worksheets/recent', {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error('Failed to fetch worksheets')
  }

  const data = await res.json()
  return data.worksheets
}

export async function deleteWorksheet(id: string): Promise<void> {
  const res = await fetch(`/api/worksheets/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized')
    }
    if (res.status === 403) {
      throw new Error('Access denied')
    }
    if (res.status === 404) {
      throw new Error('Worksheet not found')
    }
    throw new Error('Failed to delete worksheet')
  }
}

// Helper to format plan name
export function formatPlanName(plan: string): string {
  const names: Record<string, string> = {
    free: 'Бесплатный',
    basic: 'Базовый',
    premium: 'Премиум',
  }
  return names[plan] || plan
}

// Helper to format subject name
export function formatSubjectName(subject: string): string {
  const names: Record<string, string> = {
    math: 'Математика',
    russian: 'Русский язык',
  }
  return names[subject] || subject
}
