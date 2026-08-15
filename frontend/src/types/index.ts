/* CoursePlanner TypeScript type definitions */

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type TermSeason = 'Fall' | 'Spring' | 'Summer';
export type SectionType = 'L' | 'T' | 'LA';

export interface AcademicTerm {
  year: string;   // "2026-27"
  season: TermSeason;
  label: string;  // "2026-27 Fall"
}

export interface TimeSlot {
  day: DayOfWeek;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  venue: string;
}

export interface Section {
  sectionId: string;
  sectionType: SectionType;
  courseCode: string;
  instructor: string;
  timeSlots: TimeSlot[];
  quota: number;
  enrol: number;
  remarks: string;
}

export interface Course {
  code: string;          // e.g. "MATH 2111"
  department: string;    // e.g. "MATH"
  title: string;
  credits: number;
  school: string;        // e.g. "SSCI"
  description: string;
  prerequisites: string;
  corequisites: string;
  exclusions: string;
  sections: Section[];
  rating?: number;
}

export interface ProfessorRating {
  name: string;
  school: string;
  overallGrade: string;    // Letter grade: A+, A, A-, B+, B, B-, C+, C, C-, D, F
  overallGpa: number;      // GPA equivalent: 4.3 (A+) to 0.0 (F)
  teachingGrade: string;
  teachingGpa: number;
  gradingGrade: string;    // Grading fairness / "turtle" index
  gradingGpa: number;
  reviewCount: number;
  source: string;
  latestTerm: string;
}

export interface UserConstraint {
  avoidNoonBackToBack: boolean;
  noonStart: string;       // "11:00"
  noonEnd: string;         // "14:00"
  noEveningClasses: boolean;
  eveningCutoff: string;
  dayOff: DayOfWeek | null;
  avoidedInstructors: string[];
  minProfessorRating: number;  // minimum GPA (0 = no filter)
  preferredStartTime: string;
  preferredEndTime: string;
  maxConsecutiveHours: number;
}

export type Language = 'en' | 'zh';

export interface ScheduleStats {
  daysWithClasses: number;
  earliestStart: string;
  latestEnd: string;
  totalHours: number;
  totalGapHours: number;
}

export interface ScheduleResult {
  id: string;
  sections: Section[];
  stats: ScheduleStats;
  conflicts: string[];
}

export interface StudentProgress {
  completedCourses: string[];
  currentProgram: string | null;
  enrolledTerm: string | null;
  creditsCompleted: number;
  coursesRemaining: string[];
  requirementsMet: Record<string, boolean>;
}

export interface UserProfile {
  major: string | null;
  extendedMajor: string | null;
  minor: string | null;
  school: string | null;
  admissionYear: string | null;
  completedCourses: string[];
  creditsAdjustment: number;
  track: string | null;
}

export interface CourseCheckResult {
  courseCode: string;
  prereqSatisfied: boolean;
  prereqMissing: string[];
  prereqRaw: string;
  coreqSatisfied: boolean;
  coreqMissing: string[];
  coreqRaw: string;
  exclusionConflict: boolean;
  conflictingCourse: string | null;
  exclusionRaw: string;
  confidence: 'exact' | 'partial' | 'unknown';
  needsWaiver: string[];
}

export type AppView = 'planner' | 'progress' | 'profile';

/* ── Graduation progress report (backend /api/progress/calculate) ── */

export interface ProgressComponent {
  required: number;
  completed: number;
  satisfied: boolean;
  courses: string[];
  substitutable?: boolean;
  label?: string;
  /** Elective met by extra E-Comm/C-Comm/broadening credits (CTDL/UXOP) */
  substituted?: boolean;
  substituteCredits?: number;
}

export interface ProgressAreaRow {
  area: string;
  home: boolean;
  required: number;
  completed: number;
  satisfied: boolean;
  courses: string[];
}

export interface CommonCoreProgress {
  required: number;
  completed: number;
  satisfied: boolean;
  cohort: string;
  homeAreas: string[];
  components: {
    hmw: ProgressComponent;
    eComm: ProgressComponent;
    cComm: ProgressComponent;
    literacy: ProgressComponent;
    broadening: {
      areas: ProgressAreaRow[];
      nonHomeTotal: { required: number; completed: number; satisfied: boolean };
      nonHomeAreasMet: boolean;
      floorRemainder: { required: number; completed: number; satisfied: boolean };
      extraCredits: number;
    };
    uxop: ProgressComponent;
  };
}

export interface ProgressOption {
  code: string;
  title: string;
  credits: number;
}

export interface ProgressGroup {
  category: 'school' | 'major' | 'track';
  subject: string;
  note: string;
  minCredits: number;
  maxCredits: number;
  satisfied: boolean;
  completed: ProgressOption[];
  missing: ProgressOption[];
}

export interface ElectiveProgress {
  subject: string;
  minCredits: number;
  maxCredits: number;
  freeForm: string;
  completed: number;
  satisfied: boolean;
  courses: string[];
  options: string[];
  /** Capstone-dependent electives (DSCT): which branch is being checked */
  branch?: string;
  detail?: string;
}

export interface GraduationProgress {
  program: {
    code: string;
    name: string;
    admitYear: string;
    templateYear: string | null;
    school: string;
    cohort: string;
    homeAreas: string[];
  };
  commonCore: CommonCoreProgress;
  programRequirements: {
    groups: ProgressGroup[];
    satisfied: boolean | null;
    track: string | null;
    tracks: string[];
    trackRequired: boolean;
  };
  electives: ElectiveProgress[];
  freeElectives: { required: number; completed: number; satisfied: boolean };
  summary: {
    totalRequired: number;
    totalCompleted: number;
    totalWithPlanned: number;
    remaining: number;
    graduationReady: boolean;
  };
  unmatchedCompleted: string[];
  warnings: string[];
}

export type AppMode = 'manual' | 'smart';
