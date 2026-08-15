import { create } from 'zustand';
import type {
  AcademicTerm,
  AppMode,
  AppView,
  Course,
  CourseCheckResult,
  Language,
  ProfessorRating,
  ScheduleResult,
  UserConstraint,
  UserProfile,
} from '@/types';
import { checkCourses, fetchRatingsForInstructors } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { translate } from '@/i18n/dict';
import { saveTimetable, saveFavorites, savePreferences, loadTimetables, loadFavorites, loadPreferences, saveProfile, loadProfile } from '@/lib/db';

/* ── Default constraints ── */
const defaultConstraints: UserConstraint = {
  avoidNoonBackToBack: false,
  noonStart: '11:00',
  noonEnd: '14:00',
  noEveningClasses: false,
  eveningCutoff: '18:00',
  dayOff: null,
  avoidedInstructors: [],
  minProfessorRating: 0,
  preferredStartTime: '',
  preferredEndTime: '',
  maxConsecutiveHours: 0,
};

/* ── Available terms ── */
const DEFAULT_TERMS: AcademicTerm[] = [
  { year: '2026-27', season: 'Fall', label: '2026-27 Fall' },
  { year: '2026-27', season: 'Spring', label: '2026-27 Spring' },
  { year: '2025-26', season: 'Spring', label: '2025-26 Spring' },
  { year: '2025-26', season: 'Fall', label: '2025-26 Fall' },
];

/* ── Timetable tab ── */
interface TimetableTab {
  id: string;
  name: string;
}

interface TimetableSnapshot {
  courses: Course[];
  selections: Record<string, string[]>;
}

const defaultProfile: UserProfile = {
  major: null,
  extendedMajor: null,
  minor: null,
  school: null,
  admissionYear: null,
  completedCourses: [],
  creditsAdjustment: 0,
  track: null,
};

let _tabCounter = 1;
function nextTabId() { return `tab_${_tabCounter++}`; }

/* ── UI language (persisted to localStorage, default English) ── */
const LANG_KEY = 'cp_language';
function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'zh' || saved === 'en' ? saved : 'en';
  } catch {
    return 'en';
  }
}

/** Localized default tab name (e.g. "Timetable 1" / "时间表 1"). */
function tabName(num: number): string {
  return translate('layout.timetableName', getInitialLanguage(), { n: num });
}

/* ── Store shape ── */
interface AppState {
  /* Current term */
  terms: AcademicTerm[];
  currentTerm: AcademicTerm;
  setCurrentTerm: (term: AcademicTerm) => void;

  /* Mode */
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  /* Selected courses */
  selectedCourses: Course[];
  addCourse: (course: Course) => void;
  removeCourse: (courseCode: string) => void;

  /* Course detail panel (manual mode) */
  detailCourse: Course | null;
  openDetail: (course: Course) => void;
  closeDetail: () => void;

  /* Manually chosen sections per course */
  manualSelections: Record<string, string[]>; // courseCode -> sectionId[]
  setCourseSections: (courseCode: string, sectionIds: string[]) => void;

  /* Smart-mode state */
  constraints: UserConstraint;
  updateConstraint: <K extends keyof UserConstraint>(key: K, value: UserConstraint[K]) => void;
  scheduleResults: ScheduleResult[];
  setScheduleResults: (results: ScheduleResult[]) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  currentScheduleIdx: number;
  setCurrentScheduleIdx: (idx: number) => void;

  /* Favorites for comparison */
  favorites: string[]; // schedule IDs
  toggleFavorite: (id: string) => void;
  showComparison: boolean;
  setShowComparison: (v: boolean) => void;

  /* Search */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  schoolFilter: string | null;
  setSchoolFilter: (s: string | null) => void;

  /* UI */
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  /* UI language */
  language: Language;
  setLanguage: (language: Language) => void;

  /* Professor ratings cache */
  professorRatings: Record<string, ProfessorRating>;
  loadRatingsForCourses: (courses: Course[]) => Promise<void>;

  /* Auth / cloud sync */
  syncToCloud: () => Promise<boolean>;
  loadFromCloud: () => Promise<void>;
  clearUserData: () => void;

  /* View navigation */
  view: AppView;
  setView: (v: AppView) => void;

  /* User profile */
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  addCompletedCourse: (code: string) => void;
  removeCompletedCourse: (code: string) => void;

  /* Prerequisite checking */
  prereqStatus: Record<string, CourseCheckResult>;
  refreshPrereqStatus: () => Promise<void>;

  /* Multi-timetable support (basic mode) */
  timetableTabs: TimetableTab[];
  activeTimetableId: string;
  timetableSnapshots: Record<string, TimetableSnapshot>;
  addTimetable: () => void;
  removeTimetable: (id: string) => void;
  switchTimetable: (id: string) => void;
  renameTimetable: (id: string, name: string) => void;
}

function snapshot(s: { selectedCourses: Course[]; manualSelections: Record<string, string[]> }): TimetableSnapshot {
  return { courses: [...s.selectedCourses], selections: { ...s.manualSelections } };
}

const defaultTabId = nextTabId();

export const useAppStore = create<AppState>((set) => ({
  /* Current term */
  terms: DEFAULT_TERMS,
  currentTerm: DEFAULT_TERMS[0],
  setCurrentTerm: (term) => set({ currentTerm: term }),

  /* Mode */
  mode: 'manual',
  setMode: (mode) => set({ mode }),

  /* Selected courses */
  selectedCourses: [],
  addCourse: (course) =>
    set((s) => {
      if (s.selectedCourses.find((c) => c.code === course.code)) return s;
      // Auto-select first L + first T section for immediate timetable preview
      const sections = course.sections || []
      const lec = sections.find((sec) => sec.sectionType === 'L')
      const tut = sections.find((sec) => sec.sectionType === 'T')
      const autoIds = [lec?.sectionId, tut?.sectionId].filter(Boolean) as string[]
      return {
        selectedCourses: [...s.selectedCourses, course],
        manualSelections: { ...s.manualSelections, [course.code]: autoIds },
      };
    }),
  removeCourse: (code) =>
    set((s) => ({
      selectedCourses: s.selectedCourses.filter((c) => c.code !== code),
      manualSelections: { ...s.manualSelections, [code]: [] },
    })),

  /* Course detail */
  detailCourse: null,
  openDetail: (course) => set({ detailCourse: course }),
  closeDetail: () => set({ detailCourse: null }),

  /* Manual section selections */
  manualSelections: {},
  setCourseSections: (code, sectionIds) =>
    set((s) => ({
      manualSelections: { ...s.manualSelections, [code]: sectionIds },
    })),

  /* Smart-mode */
  constraints: defaultConstraints,
  updateConstraint: (key, value) =>
    set((s) => ({ constraints: { ...s.constraints, [key]: value } })),
  scheduleResults: [],
  setScheduleResults: (results) => set({ scheduleResults: results, currentScheduleIdx: 0 }),
  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),
  currentScheduleIdx: 0,
  setCurrentScheduleIdx: (idx) => set({ currentScheduleIdx: idx }),

  /* Favorites */
  favorites: [],
  toggleFavorite: (id) =>
    set((s) => {
      const exists = s.favorites.includes(id);
      return {
        favorites: exists
          ? s.favorites.filter((f) => f !== id)
          : [...s.favorites, id],
      };
    }),
  showComparison: false,
  setShowComparison: (v) => set({ showComparison: v }),

  /* Search */
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  schoolFilter: null,
  setSchoolFilter: (f) => set({ schoolFilter: f }),

  /* UI */
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  /* UI language */
  language: getInitialLanguage(),
  setLanguage: (language) => {
    try { localStorage.setItem(LANG_KEY, language); } catch { /* ignore */ }
    set({ language });
  },

  /* View navigation */
  view: 'planner' as AppView,
  setView: (v) => set({ view: v }),

  /* User profile */
  profile: defaultProfile,
  setProfile: (p) => set({ profile: p }),
  updateProfile: (partial) =>
    set((s) => ({ profile: { ...s.profile, ...partial } })),
  addCompletedCourse: (code) =>
    set((s) => {
      if (s.profile.completedCourses.includes(code)) return s;
      return {
        profile: {
          ...s.profile,
          completedCourses: [...s.profile.completedCourses, code],
        },
      };
    }),
  removeCompletedCourse: (code) =>
    set((s) => ({
      profile: {
        ...s.profile,
        completedCourses: s.profile.completedCourses.filter((c) => c !== code),
      },
    })),

  /* Prerequisite checking */
  prereqStatus: {},
  refreshPrereqStatus: async () => {
    const state = useAppStore.getState()
    const allCodes = state.selectedCourses.map((c) => c.code)
    const completed = state.profile.completedCourses
    if (allCodes.length === 0) {
      set({ prereqStatus: {} })
      return
    }
    try {
      const results = await checkCourses(allCodes, completed)
      const statusMap: Record<string, CourseCheckResult> = {}
      for (const r of results) {
        statusMap[r.courseCode] = r
      }
      set({ prereqStatus: statusMap })
    } catch {
      // Silently fail — prerequisite checking is advisory
    }
  },

  /* Professor ratings cache */
  professorRatings: {},
  loadRatingsForCourses: async (courses: Course[]) => {
    const names = new Set<string>()
    for (const c of courses) {
      for (const sec of c.sections || []) {
        const inst = sec.instructor?.trim()
        if (inst && inst.toUpperCase() !== 'TBA') {
          names.add(inst)
        }
      }
    }
    if (names.size === 0) return

    try {
      const ratings = await fetchRatingsForInstructors([...names])
      set((s) => ({
        professorRatings: { ...s.professorRatings, ...ratings },
      }))
    } catch {
      // Silently fail — ratings are optional
    }
  },

  /* Auth / cloud sync */
  syncToCloud: async () => {
    const state = useAppStore.getState()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      // Sync active timetable (pass cloud ID if loaded from cloud)
      const activeTab = state.timetableTabs.find(t => t.id === state.activeTimetableId)
      const cloudId = activeTab?.id.startsWith('cloud_') ? activeTab.id.replace('cloud_', '') : undefined
      await saveTimetable(
        user.id,
        activeTab?.name || translate('layout.timetableName', state.language, { n: 1 }),
        state.selectedCourses,
        state.manualSelections,
        cloudId,
      )

      // Sync favorites
      const { scheduleResults, favorites } = state
      const favSchedules = scheduleResults.filter(r => favorites.includes(r.id))
      await saveFavorites(user.id, favSchedules)

      // Sync preferences
      await savePreferences(user.id, state.constraints)

      // Sync profile — the return value reports the profile save result
      // (the explicit 保存 button depends on it).
      const profileSaved = await saveProfile(user.id, state.profile)
      return profileSaved
    } catch {
      // Silently fail — cloud sync is optional
      return false
    }
  },

  loadFromCloud: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load preferences
      const prefs = await loadPreferences(user.id)
      if (prefs) {
        set((s) => ({ constraints: { ...s.constraints, ...prefs } }))
      }

      // Load favorites (schedule results)
      const favs = await loadFavorites(user.id)
      if (favs.length > 0) {
        set(() => ({
          scheduleResults: favs,
          favorites: favs.map((f) => f.id),
        }))
      }

      // Load profile
      const profile = await loadProfile(user.id)
      if (profile) {
        set((s) => ({ profile: { ...s.profile, ...profile } }))
      }

      // Load timetables
      const timetables = await loadTimetables(user.id)
      if (timetables.length > 0) {
        const tabs = timetables.map((t) => ({
          id: `cloud_${t.id}`,
          name: t.name,
        }))
        const snapshots: Record<string, TimetableSnapshot> = {}
        for (const t of timetables) {
          snapshots[`cloud_${t.id}`] = {
            courses: (t.courses || []) as Course[],
            selections: (t.selections || {}) as Record<string, string[]>,
          }
        }
        set((s) => ({
          timetableTabs: tabs,
          activeTimetableId: tabs[0]?.id ?? s.activeTimetableId,
          timetableSnapshots: { ...s.timetableSnapshots, ...snapshots },
          selectedCourses: (timetables[0]?.courses || []) as Course[],
          manualSelections: (timetables[0]?.selections || {}) as Record<string, string[]>,
        }))
      }
    } catch {
      // Silently fail — cloud sync is optional
    }
  },

  clearUserData: () => {
    const freshTabId = nextTabId()
    set({
      profile: defaultProfile,
      prereqStatus: {},
      view: 'planner' as AppView,
      selectedCourses: [],
      manualSelections: {},
      scheduleResults: [],
      favorites: [],
      constraints: defaultConstraints,
      timetableTabs: [{ id: freshTabId, name: tabName(1) }],
      activeTimetableId: freshTabId,
      timetableSnapshots: { [freshTabId]: { courses: [], selections: {} } },
      professorRatings: {},
    })
  },

  /* Multi-timetable support */
  timetableTabs: [{ id: defaultTabId, name: tabName(1) }],
  activeTimetableId: defaultTabId,
  timetableSnapshots: { [defaultTabId]: { courses: [], selections: {} } },

  addTimetable: () =>
    set((s) => {
      // Save current state before switching
      const newSnapshots = { ...s.timetableSnapshots, [s.activeTimetableId]: snapshot(s) };
      const id = nextTabId();
      const num = s.timetableTabs.length + 1;
      return {
        timetableTabs: [...s.timetableTabs, { id, name: tabName(num) }],
        activeTimetableId: id,
        timetableSnapshots: { ...newSnapshots, [id]: { courses: [], selections: {} } },
        selectedCourses: [],
        manualSelections: {},
      };
    }),

  removeTimetable: (id) =>
    set((s) => {
      if (s.timetableTabs.length <= 1) return s; // keep at least one tab
      const newTabs = s.timetableTabs.filter((t) => t.id !== id);
      const newSnapshots = { ...s.timetableSnapshots };
      delete newSnapshots[id];

      // If removing the active tab, switch to the first remaining
      const newActiveId = s.activeTimetableId === id ? newTabs[0].id : s.activeTimetableId;
      const snap = newSnapshots[newActiveId] || { courses: [], selections: {} };

      return {
        timetableTabs: newTabs,
        activeTimetableId: newActiveId,
        timetableSnapshots: newSnapshots,
        selectedCourses: snap.courses,
        manualSelections: snap.selections,
      };
    }),

  switchTimetable: (id) =>
    set((s) => {
      if (id === s.activeTimetableId) return s;
      // Save current state to the tab we're leaving
      const newSnapshots = { ...s.timetableSnapshots, [s.activeTimetableId]: snapshot(s) };
      // Load the target tab's state
      const snap = newSnapshots[id] || { courses: [], selections: {} };
      return {
        timetableSnapshots: newSnapshots,
        activeTimetableId: id,
        selectedCourses: snap.courses,
        manualSelections: snap.selections,
      };
    }),

  renameTimetable: (id, name) =>
    set((s) => ({
      timetableTabs: s.timetableTabs.map((t) => (t.id === id ? { ...t, name } : t)),
    })),
}));
