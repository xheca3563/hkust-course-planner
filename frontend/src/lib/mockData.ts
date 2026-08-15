/** Mock course data for development. Replace with API calls. */
import type { Course } from '@/types'

export const ALL_COURSES: Course[] = [
  {
    code: 'COMP 1021', department: 'COMP', title: 'Introduction to Computer Science',
    credits: 3, school: 'SENG',
    description: 'An introductory course covering fundamental concepts of computer science including algorithms, programming basics, data representation, and problem-solving techniques using Python.',
    prerequisites: '', corequisites: '', exclusions: 'COMP 1022P, COMP 1022Q', rating: 3.8,
    sections: [
      { sectionId: 'COMP1021-L1', sectionType: 'L', courseCode: 'COMP 1021', instructor: 'Prof. WONG Kam Fai', timeSlots: [{ day: 'Mon', startTime: '09:00', endTime: '10:20', venue: 'LT-A' }, { day: 'Wed', startTime: '09:00', endTime: '10:20', venue: 'LT-A' }], quota: 180, enrol: 145, remarks: '' },
      { sectionId: 'COMP1021-T1A', sectionType: 'T', courseCode: 'COMP 1021', instructor: 'TA', timeSlots: [{ day: 'Fri', startTime: '10:00', endTime: '10:50', venue: 'Rm 2404' }], quota: 30, enrol: 25, remarks: '' },
      { sectionId: 'COMP1021-T1B', sectionType: 'T', courseCode: 'COMP 1021', instructor: 'TA', timeSlots: [{ day: 'Fri', startTime: '11:00', endTime: '11:50', venue: 'Rm 2404' }], quota: 30, enrol: 28, remarks: '' },
    ],
  },
  {
    code: 'COMP 2011', department: 'COMP', title: 'Data Structures and Algorithms',
    credits: 4, school: 'SENG',
    description: 'This course introduces fundamental data structures (arrays, linked lists, trees, graphs, hash tables) and algorithms (sorting, searching, graph traversal, dynamic programming). Students learn to analyze algorithm complexity and implement efficient solutions.',
    prerequisites: 'COMP 1021 / COMP 1022P / COMP 1022Q', corequisites: '', exclusions: 'COMP 2012H, ISOM 3320', rating: 4.2,
    sections: [
      { sectionId: 'COMP2011-L1', sectionType: 'L', courseCode: 'COMP 2011', instructor: 'Prof. ZHANG Tong', timeSlots: [{ day: 'Mon', startTime: '10:30', endTime: '11:50', venue: 'LT-B' }, { day: 'Thu', startTime: '10:30', endTime: '11:50', venue: 'LT-B' }], quota: 150, enrol: 132, remarks: '' },
      { sectionId: 'COMP2011-L2', sectionType: 'L', courseCode: 'COMP 2011', instructor: 'Prof. LI Wei', timeSlots: [{ day: 'Tue', startTime: '09:00', endTime: '10:20', venue: 'LT-C' }, { day: 'Fri', startTime: '09:00', endTime: '10:20', venue: 'LT-C' }], quota: 120, enrol: 95, remarks: '' },
      { sectionId: 'COMP2011-L3', sectionType: 'L', courseCode: 'COMP 2011', instructor: 'Prof. CHEN Xiaoming', timeSlots: [{ day: 'Wed', startTime: '15:00', endTime: '16:20', venue: 'LT-C' }, { day: 'Fri', startTime: '15:00', endTime: '16:20', venue: 'LT-C' }], quota: 80, enrol: 78, remarks: 'Priority for COMP majors' },
      { sectionId: 'COMP2011-T1A', sectionType: 'T', courseCode: 'COMP 2011', instructor: 'TA', timeSlots: [{ day: 'Mon', startTime: '13:00', endTime: '13:50', venue: 'Rm 2404' }], quota: 50, enrol: 43, remarks: '' },
      { sectionId: 'COMP2011-T1B', sectionType: 'T', courseCode: 'COMP 2011', instructor: 'TA', timeSlots: [{ day: 'Tue', startTime: '13:00', endTime: '13:50', venue: 'Rm 2405' }], quota: 50, enrol: 38, remarks: '' },
      { sectionId: 'COMP2011-T2A', sectionType: 'T', courseCode: 'COMP 2011', instructor: 'TA', timeSlots: [{ day: 'Wed', startTime: '16:30', endTime: '17:20', venue: 'Rm 2404' }], quota: 50, enrol: 30, remarks: '' },
    ],
  },
  {
    code: 'COMP 2012', department: 'COMP', title: 'Object-Oriented Programming and Data Structures',
    credits: 4, school: 'SENG',
    description: 'Advanced object-oriented programming in C++ covering classes, inheritance, polymorphism, templates, STL, and advanced data structures.',
    prerequisites: 'COMP 2011', corequisites: '', exclusions: 'COMP 2012H', rating: 3.9,
    sections: [
      { sectionId: 'COMP2012-L1', sectionType: 'L', courseCode: 'COMP 2012', instructor: 'Prof. CHEN Xiaoming', timeSlots: [{ day: 'Tue', startTime: '12:00', endTime: '13:20', venue: 'LT-D' }, { day: 'Thu', startTime: '12:00', endTime: '13:20', venue: 'LT-D' }], quota: 140, enrol: 120, remarks: '' },
      { sectionId: 'COMP2012-T1A', sectionType: 'T', courseCode: 'COMP 2012', instructor: 'TA', timeSlots: [{ day: 'Thu', startTime: '14:00', endTime: '14:50', venue: 'Rm 2406' }], quota: 45, enrol: 40, remarks: '' },
      { sectionId: 'COMP2012-T1B', sectionType: 'T', courseCode: 'COMP 2012', instructor: 'TA', timeSlots: [{ day: 'Thu', startTime: '15:00', endTime: '15:50', venue: 'Rm 2406' }], quota: 45, enrol: 35, remarks: '' },
    ],
  },
  {
    code: 'COMP 2611', department: 'COMP', title: 'Computer Organization',
    credits: 4, school: 'SENG',
    description: 'Introduction to computer organization and architecture. Topics include digital logic, instruction set architecture (RISC-V), processor datapath and control, pipelining, memory hierarchy, and I/O systems.',
    prerequisites: 'COMP 1021 / COMP 1022P / COMP 1022Q', corequisites: '', exclusions: 'ELEC 2300, COMP 2611H', rating: 3.6,
    sections: [
      { sectionId: 'COMP2611-L1', sectionType: 'L', courseCode: 'COMP 2611', instructor: 'Prof. SHI Bertram', timeSlots: [{ day: 'Wed', startTime: '15:00', endTime: '16:20', venue: 'LT-E' }, { day: 'Fri', startTime: '15:00', endTime: '16:20', venue: 'LT-E' }], quota: 130, enrol: 110, remarks: '' },
      { sectionId: 'COMP2611-T1A', sectionType: 'T', courseCode: 'COMP 2611', instructor: 'TA', timeSlots: [{ day: 'Fri', startTime: '16:30', endTime: '17:20', venue: 'Rm 2502' }], quota: 40, enrol: 35, remarks: '' },
    ],
  },
  {
    code: 'COMP 3511', department: 'COMP', title: 'Operating Systems',
    credits: 3, school: 'SENG',
    description: 'Operating system principles including process management, memory management, file systems, I/O systems, concurrency, deadlocks, and security.',
    prerequisites: 'COMP 2611', corequisites: '', exclusions: 'COMP 3511H', rating: 4.1,
    sections: [
      { sectionId: 'COMP3511-L1', sectionType: 'L', courseCode: 'COMP 3511', instructor: 'Prof. WANG Shuai', timeSlots: [{ day: 'Mon', startTime: '13:30', endTime: '14:50', venue: 'LT-F' }, { day: 'Wed', startTime: '13:30', endTime: '14:50', venue: 'LT-F' }], quota: 120, enrol: 98, remarks: '' },
      { sectionId: 'COMP3511-T1A', sectionType: 'T', courseCode: 'COMP 3511', instructor: 'TA', timeSlots: [{ day: 'Mon', startTime: '15:00', endTime: '15:50', venue: 'Rm 3501' }], quota: 40, enrol: 33, remarks: '' },
    ],
  },
  {
    code: 'ELEC 1100', department: 'ELEC', title: 'Introduction to Electronic and Computer Engineering',
    credits: 3, school: 'SENG',
    description: 'Survey of electronic and computer engineering disciplines. Topics include circuits, signals, digital systems, communications, and professional ethics.',
    prerequisites: '', corequisites: '', exclusions: '', rating: 3.6,
    sections: [
      { sectionId: 'ELEC1100-L1', sectionType: 'L', courseCode: 'ELEC 1100', instructor: 'Prof. CHIU Yun', timeSlots: [{ day: 'Mon', startTime: '14:00', endTime: '15:20', venue: 'LT-Q' }, { day: 'Wed', startTime: '14:00', endTime: '15:20', venue: 'LT-Q' }], quota: 150, enrol: 120, remarks: '' },
      { sectionId: 'ELEC1100-LA1A', sectionType: 'LA', courseCode: 'ELEC 1100', instructor: 'TA', timeSlots: [{ day: 'Tue', startTime: '09:00', endTime: '11:50', venue: 'Lab 2202' }], quota: 30, enrol: 25, remarks: '' },
    ],
  },
  {
    code: 'MATH 1013', department: 'MATH', title: 'Calculus IB',
    credits: 3, school: 'SSCI',
    description: 'One-variable calculus: limits, continuity, derivatives, applications of derivatives, definite integrals, fundamental theorem of calculus.',
    prerequisites: 'Level 3 or above in HKDSE Mathematics Extended Module M1/M2', corequisites: '', exclusions: 'MATH 1012, MATH 1020, MATH 1023, MATH 1024', rating: 3.5,
    sections: [
      { sectionId: 'MATH1013-L1', sectionType: 'L', courseCode: 'MATH 1013', instructor: 'Prof. HO Man Ho', timeSlots: [{ day: 'Tue', startTime: '10:30', endTime: '11:50', venue: 'LT-G' }, { day: 'Thu', startTime: '10:30', endTime: '11:50', venue: 'LT-G' }], quota: 200, enrol: 180, remarks: '' },
      { sectionId: 'MATH1013-L2', sectionType: 'L', courseCode: 'MATH 1013', instructor: 'Prof. CHAN Kin Yiu', timeSlots: [{ day: 'Mon', startTime: '15:00', endTime: '16:20', venue: 'LT-H' }, { day: 'Wed', startTime: '15:00', endTime: '16:20', venue: 'LT-H' }], quota: 180, enrol: 155, remarks: '' },
      { sectionId: 'MATH1013-T1A', sectionType: 'T', courseCode: 'MATH 1013', instructor: 'TA', timeSlots: [{ day: 'Fri', startTime: '09:00', endTime: '09:50', venue: 'Rm 3502' }], quota: 60, enrol: 52, remarks: '' },
    ],
  },
  {
    code: 'MATH 2111', department: 'MATH', title: 'Linear Algebra',
    credits: 3, school: 'SSCI',
    description: 'Vector spaces, linear transformations, matrices, systems of linear equations, determinants, eigenvalues and eigenvectors.',
    prerequisites: 'MATH 1012 / MATH 1013 / MATH 1023', corequisites: '', exclusions: 'MATH 2121, MATH 2131', rating: 3.7,
    sections: [
      { sectionId: 'MATH2111-L1', sectionType: 'L', courseCode: 'MATH 2111', instructor: 'Prof. WANG Fang', timeSlots: [{ day: 'Tue', startTime: '12:00', endTime: '13:20', venue: 'LT-J' }, { day: 'Thu', startTime: '12:00', endTime: '13:20', venue: 'LT-J' }], quota: 160, enrol: 140, remarks: '' },
      { sectionId: 'MATH2111-L2', sectionType: 'L', courseCode: 'MATH 2111', instructor: 'Prof. LIU Gang', timeSlots: [{ day: 'Mon', startTime: '09:00', endTime: '10:20', venue: 'LT-K' }, { day: 'Wed', startTime: '09:00', endTime: '10:20', venue: 'LT-K' }], quota: 140, enrol: 95, remarks: '' },
      { sectionId: 'MATH2111-T1A', sectionType: 'T', courseCode: 'MATH 2111', instructor: 'TA', timeSlots: [{ day: 'Thu', startTime: '14:00', endTime: '14:50', venue: 'Rm 3502' }], quota: 50, enrol: 42, remarks: '' },
      { sectionId: 'MATH2111-T1B', sectionType: 'T', courseCode: 'MATH 2111', instructor: 'TA', timeSlots: [{ day: 'Mon', startTime: '10:30', endTime: '11:20', venue: 'Rm 3503' }], quota: 50, enrol: 38, remarks: '' },
    ],
  },
  {
    code: 'MATH 2411', department: 'MATH', title: 'Probability',
    credits: 3, school: 'SSCI',
    description: 'Probability theory including random variables, distributions, expectation, moment generating functions, limit theorems.',
    prerequisites: 'MATH 1012 / MATH 1013 / MATH 1023', corequisites: '', exclusions: '', rating: 3.4,
    sections: [
      { sectionId: 'MATH2411-L1', sectionType: 'L', courseCode: 'MATH 2411', instructor: 'Prof. YU Xiang', timeSlots: [{ day: 'Mon', startTime: '12:00', endTime: '13:20', venue: 'LT-L' }, { day: 'Wed', startTime: '12:00', endTime: '13:20', venue: 'LT-L' }], quota: 120, enrol: 100, remarks: '' },
      { sectionId: 'MATH2411-T1A', sectionType: 'T', courseCode: 'MATH 2411', instructor: 'TA', timeSlots: [{ day: 'Mon', startTime: '13:30', endTime: '14:20', venue: 'Rm 3601' }], quota: 40, enrol: 35, remarks: '' },
    ],
  },
  {
    code: 'PHYS 1112', department: 'PHYS', title: 'General Physics with Calculus',
    credits: 3, school: 'SSCI',
    description: 'Mechanics, thermodynamics, and waves for physical science and engineering students. Uses calculus extensively.',
    prerequisites: 'MATH 1012 / MATH 1013 / MATH 1023 (may be taken concurrently)', corequisites: '', exclusions: 'PHYS 1111, PHYS 1312', rating: 3.5,
    sections: [
      { sectionId: 'PHYS1112-L1', sectionType: 'L', courseCode: 'PHYS 1112', instructor: 'Prof. CHEN Yiming', timeSlots: [{ day: 'Mon', startTime: '15:00', endTime: '16:20', venue: 'LT-M' }, { day: 'Wed', startTime: '15:00', endTime: '16:20', venue: 'LT-M' }], quota: 200, enrol: 175, remarks: '' },
      { sectionId: 'PHYS1112-T1A', sectionType: 'T', courseCode: 'PHYS 1112', instructor: 'TA', timeSlots: [{ day: 'Mon', startTime: '16:30', endTime: '17:20', venue: 'Rm 1504' }], quota: 60, enrol: 55, remarks: '' },
      { sectionId: 'PHYS1112-LA1A', sectionType: 'LA', courseCode: 'PHYS 1112', instructor: 'TA', timeSlots: [{ day: 'Thu', startTime: '14:00', endTime: '16:50', venue: 'Lab 3101' }], quota: 30, enrol: 28, remarks: '' },
    ],
  },
  {
    code: 'HUMA 1000', department: 'HUMA', title: 'Introduction to Humanities',
    credits: 3, school: 'SHSS',
    description: 'An interdisciplinary introduction to the humanities, exploring literature, philosophy, art, and history from a global perspective.',
    prerequisites: '', corequisites: '', exclusions: '', rating: 4.0,
    sections: [
      { sectionId: 'HUMA1000-L1', sectionType: 'L', courseCode: 'HUMA 1000', instructor: 'Prof. WONG Mei Ling', timeSlots: [{ day: 'Tue', startTime: '14:00', endTime: '15:20', venue: 'LT-N' }, { day: 'Thu', startTime: '14:00', endTime: '15:20', venue: 'LT-N' }], quota: 100, enrol: 65, remarks: '' },
      { sectionId: 'HUMA1000-L2', sectionType: 'L', courseCode: 'HUMA 1000', instructor: 'Prof. CHAN Siu Ming', timeSlots: [{ day: 'Mon', startTime: '10:30', endTime: '11:50', venue: 'Rm 3301' }, { day: 'Wed', startTime: '10:30', endTime: '11:50', venue: 'Rm 3301' }], quota: 80, enrol: 55, remarks: '' },
      { sectionId: 'HUMA1000-T1A', sectionType: 'T', courseCode: 'HUMA 1000', instructor: 'TA', timeSlots: [{ day: 'Fri', startTime: '11:00', endTime: '11:50', venue: 'Rm 2501' }], quota: 30, enrol: 22, remarks: '' },
    ],
  },
  {
    code: 'LANG 1403', department: 'LANG', title: 'English for Academic Purposes',
    credits: 3, school: 'SHSS',
    description: 'Develops academic English skills including essay writing, critical reading, research skills, and oral presentations.',
    prerequisites: '', corequisites: '', exclusions: 'LANG 1401, LANG 1402', rating: 3.8,
    sections: [
      { sectionId: 'LANG1403-L1', sectionType: 'L', courseCode: 'LANG 1403', instructor: 'Prof. SMITH John', timeSlots: [{ day: 'Wed', startTime: '11:00', endTime: '12:20', venue: 'Rm 2203' }, { day: 'Fri', startTime: '11:00', endTime: '12:20', venue: 'Rm 2203' }], quota: 25, enrol: 22, remarks: '' },
      { sectionId: 'LANG1403-L2', sectionType: 'L', courseCode: 'LANG 1403', instructor: 'Prof. LEE Ka Man', timeSlots: [{ day: 'Tue', startTime: '09:00', endTime: '10:20', venue: 'Rm 2204' }, { day: 'Thu', startTime: '09:00', endTime: '10:20', venue: 'Rm 2204' }], quota: 25, enrol: 20, remarks: '' },
    ],
  },
  {
    code: 'SOSC 1850', department: 'SOSC', title: 'Understanding Society',
    credits: 3, school: 'SHSS',
    description: 'Introduction to sociological perspectives on modern society. Topics include social structure, culture, inequality, globalization, and social change.',
    prerequisites: '', corequisites: '', exclusions: 'SOSC 1000', rating: 3.9,
    sections: [
      { sectionId: 'SOSC1850-L1', sectionType: 'L', courseCode: 'SOSC 1850', instructor: 'Prof. TANG Hei Wa', timeSlots: [{ day: 'Thu', startTime: '16:30', endTime: '17:50', venue: 'LT-P' }, { day: 'Fri', startTime: '14:00', endTime: '15:20', venue: 'LT-P' }], quota: 90, enrol: 72, remarks: '' },
      { sectionId: 'SOSC1850-T1A', sectionType: 'T', courseCode: 'SOSC 1850', instructor: 'TA', timeSlots: [{ day: 'Fri', startTime: '15:30', endTime: '16:20', venue: 'Rm 2601' }], quota: 30, enrol: 25, remarks: '' },
    ],
  },
  {
    code: 'ACCT 2010', department: 'ACCT', title: 'Financial Accounting',
    credits: 3, school: 'SBM',
    description: 'Introduction to financial accounting principles and practices. Covers the accounting cycle, preparation and analysis of financial statements.',
    prerequisites: '', corequisites: '', exclusions: 'ACCT 1010', rating: 3.3,
    sections: [
      { sectionId: 'ACCT2010-L1', sectionType: 'L', courseCode: 'ACCT 2010', instructor: 'Prof. HUNG Ming', timeSlots: [{ day: 'Tue', startTime: '09:00', endTime: '10:20', venue: 'LSK 1001' }, { day: 'Thu', startTime: '09:00', endTime: '10:20', venue: 'LSK 1001' }], quota: 100, enrol: 80, remarks: '' },
      { sectionId: 'ACCT2010-T1A', sectionType: 'T', courseCode: 'ACCT 2010', instructor: 'TA', timeSlots: [{ day: 'Thu', startTime: '10:30', endTime: '11:20', venue: 'LSK 2001' }], quota: 35, enrol: 30, remarks: '' },
    ],
  },
  {
    code: 'ECON 2103', department: 'ECON', title: 'Principles of Microeconomics',
    credits: 3, school: 'SBM',
    description: 'Theory of consumer behavior, production and costs, market structures, factor markets, and market failure. Applications to public policy and business decisions.',
    prerequisites: '', corequisites: '', exclusions: 'ECON 2113', rating: 3.5,
    sections: [
      { sectionId: 'ECON2103-L1', sectionType: 'L', courseCode: 'ECON 2103', instructor: 'Prof. PARK Albert', timeSlots: [{ day: 'Mon', startTime: '10:30', endTime: '11:50', venue: 'LSK 1003' }, { day: 'Wed', startTime: '10:30', endTime: '11:50', venue: 'LSK 1003' }], quota: 120, enrol: 105, remarks: '' },
      { sectionId: 'ECON2103-T1A', sectionType: 'T', courseCode: 'ECON 2103', instructor: 'TA', timeSlots: [{ day: 'Fri', startTime: '14:00', endTime: '14:50', venue: 'LSK 2002' }], quota: 40, enrol: 35, remarks: '' },
    ],
  },
]
