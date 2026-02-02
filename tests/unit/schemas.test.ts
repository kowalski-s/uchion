import { describe, it, expect } from 'vitest'
import { SubjectSchema, GenerateSchema } from '../../shared/types'

describe('Shared Schemas', () => {
  describe('SubjectSchema', () => {
    it('should accept valid subjects', () => {
      expect(() => SubjectSchema.parse('math')).not.toThrow()
      expect(() => SubjectSchema.parse('russian')).not.toThrow()
    })

    it('should reject invalid subjects', () => {
      expect(() => SubjectSchema.parse('english')).toThrow()
      expect(() => SubjectSchema.parse('')).toThrow()
    })
  })

  describe('GenerateSchema', () => {
    it('should accept valid grades (1-11)', () => {
      const validPayload1 = { subject: 'math', grade: 1, topic: 'Счёт' }
      const validPayload4 = { subject: 'math', grade: 4, topic: 'Дроби' }
      const validPayload11 = { subject: 'algebra', grade: 11, topic: 'Логарифмы' }

      expect(() => GenerateSchema.parse(validPayload1)).not.toThrow()
      expect(() => GenerateSchema.parse(validPayload4)).not.toThrow()
      expect(() => GenerateSchema.parse(validPayload11)).not.toThrow()
    })

    it('should reject invalid grades', () => {
      const payload0 = { subject: 'math', grade: 0, topic: 'Тема' }
      const payload12 = { subject: 'math', grade: 12, topic: 'Тема' }
      const payloadString = { subject: 'math', grade: '2', topic: 'Тема' }

      expect(() => GenerateSchema.parse(payload0)).toThrow()
      expect(() => GenerateSchema.parse(payload12)).toThrow()
      expect(() => GenerateSchema.parse(payloadString)).toThrow()
    })

    it('should accept valid complete payload', () => {
      const validPayload = {
        subject: 'math',
        grade: 2,
        topic: 'Сложение и вычитание',
      }
      expect(() => GenerateSchema.parse(validPayload)).not.toThrow()
    })

    it('should reject payload with missing fields', () => {
      const invalidPayload = {
        subject: 'math',
        grade: 2,
      }
      expect(() => GenerateSchema.parse(invalidPayload)).toThrow()
    })

    it('should reject payload with invalid subject', () => {
      const invalidPayload = {
        subject: 'english',
        grade: 2,
        topic: 'Тема',
      }
      expect(() => GenerateSchema.parse(invalidPayload)).toThrow()
    })
  })
})
