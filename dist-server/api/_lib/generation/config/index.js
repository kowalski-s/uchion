export * from './types.js';
export * from './subjects/index.js';
export * from './task-types.js';
export * from './difficulty.js';
export * from './worksheet-formats.js';
export * from './task-distribution.js';
export { validateWorksheet } from '../validation/index.js';
import { mathConfig } from './subjects/math.js';
import { algebraConfig } from './subjects/algebra.js';
import { geometryConfig } from './subjects/geometry.js';
import { russianConfig } from './subjects/russian.js';
export const subjects = {
    math: mathConfig,
    algebra: algebraConfig,
    geometry: geometryConfig,
    russian: russianConfig,
};
export function getSubjectConfig(subjectId) {
    return subjects[subjectId];
}
export function getGradeConfig(subjectId, grade) {
    const subject = subjects[subjectId];
    if (!subject)
        return undefined;
    return subject.grades[grade];
}
export function isGradeSupported(subjectId, grade) {
    const subject = subjects[subjectId];
    if (!subject)
        return false;
    return grade >= subject.gradeRange.from && grade <= subject.gradeRange.to;
}
export function getAvailableSubjects() {
    return Object.values(subjects);
}
export function getSubjectsForGrade(grade) {
    return Object.values(subjects).filter((subject) => grade >= subject.gradeRange.from && grade <= subject.gradeRange.to);
}
//# sourceMappingURL=index.js.map