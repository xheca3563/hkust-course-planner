/**
 * HKUST Undergraduate Major and Minor Programs
 *
 * AUTO-GENERATED from https://prog-crs.hkust.edu.hk/ugprog
 * Source: official HKUST Program & Course Catalog
 *
 * DO NOT EDIT MANUALLY — regenerate with:
 *   python3 scripts/scrape_programs.py
 */

export interface ProgramInfo {
  code: string
  name: string
}

export interface SchoolPrograms {
  schoolCode: string
  schoolName: string
  majors: ProgramInfo[]
}

export interface YearPrograms {
  year: string
  schools: SchoolPrograms[]
  minors: ProgramInfo[]
  extendedMajors: ProgramInfo[]
}

// =============================================================================
// ALL YEARS DATA
// =============================================================================

export const ALL_YEARS_PROGRAMS: YearPrograms[] = [
  {
    year: "2022-23",
    schools: [
      {
        schoolCode: "AIS",
        schoolName: "Academy of Interdisciplinary Studies",
        majors: [
          { code: "EVMT", name: "BSc in Environmental Management and Technology" },
          { code: "IDT", name: "BSc in Innovation, Design and Technology" },
          { code: "IIM", name: "BSc in Individualized Interdisciplinary Major" },
          { code: "T&M-DDP", name: "BEng/BSc & BBA Dual Degree Program in Technology & Management" },
        ],
      },
      {
        schoolCode: "SBM",
        schoolName: "School of Business and Management",
        majors: [
          { code: "ACCT", name: "BBA in Professional Accounting" },
          { code: "EABU", name: "BBA in Eurasian Business ※" },
          { code: "ECOF", name: "BSc in Economics and Finance" },
          { code: "ECON", name: "BBA in Economics" },
          { code: "FINA", name: "BBA in Finance" },
          { code: "GBM", name: "BBA in General Business Management" },
          { code: "GBUS", name: "BBA in Global Business" },
          { code: "IS", name: "BBA in Information Systems" },
          { code: "MARK", name: "BBA in Marketing" },
          { code: "MGMT", name: "BBA in Management" },
          { code: "OM", name: "BBA in Operations Management" },
          { code: "QFIN", name: "BSc in Quantitative Finance" },
          { code: "RMBI", name: "BSc in Risk Management and Business Intelligence %" },
          { code: "SGFN", name: "BSc in Sustainable and Green Finance §" },
          { code: "WBB", name: "BBA in World Business *" },
        ],
      },
      {
        schoolCode: "SENG",
        schoolName: "School of Engineering",
        majors: [
          { code: "AE", name: "BEng in Aerospace Engineering" },
          { code: "AI", name: "BEng in Artificial Intelligence" },
          { code: "BIEN", name: "BEng in Bioengineering" },
          { code: "CENG", name: "BEng in Chemical Engineering" },
          { code: "CIEV", name: "BEng in Civil and Environmental Engineering" },
          { code: "CIVL", name: "BEng in Civil Engineering" },
          { code: "COMP", name: "BEng in Computer Science" },
          { code: "COSC", name: "BSc in Computer Science" },
          { code: "CPEG", name: "BEng in Computer Engineering" },
          { code: "DA", name: "BEng in Decision Analytics" },
          { code: "EEEN", name: "BEng in Energy and Environmental Engineering" },
          { code: "ELEC", name: "BEng in Electronic Engineering" },
          { code: "IEEM", name: "BEng in Industrial Engineering and Engineering Management" },
          { code: "MECH", name: "BEng in Mechanical Engineering" },
          { code: "MEIC", name: "BEng in Microelectronics and Integrated Circuits" },
        ],
      },
      {
        schoolCode: "SHSS",
        schoolName: "School of Humanities and Social Science",
        majors: [
          { code: "GCS", name: "BSc in Global China Studies" },
          { code: "QSA", name: "BSc in Quantitative Social Analysis" },
        ],
      },
      {
        schoolCode: "SSCI",
        schoolName: "School of Science",
        majors: [
          { code: "BCB", name: "BSc in Biochemistry and Cell Biology" },
          { code: "BIBU", name: "BSc in Biotechnology and Business #" },
          { code: "BIOT", name: "BSc in Biotechnology" },
          { code: "BMH", name: "BSc in Biomedical and Health Sciences" },
          { code: "CHEM", name: "BSc in Chemistry" },
          { code: "DASC", name: "BSc in Data Analytics and Artificial Intelligence in Science" },
          { code: "DSCT", name: "BSc in Data Science and Technology @" },
          { code: "MAEC", name: "BSc in Mathematics and Economics #" },
          { code: "MATH", name: "BSc in Mathematics" },
          { code: "OST", name: "BSc in Ocean Science and Technology" },
          { code: "PHYS", name: "BSc in Physics" },
        ],
      },
    ],
    minors: [
      { code: "ACTM", name: "Minor Program in Actuarial Mathematics" },
      { code: "AERO", name: "Minor Program in Aeronautical Engineering" },
      { code: "ASCO", name: "Minor Program in Astrophysics and Cosmology" },
      { code: "BDT", name: "Minor Program in Big Data Technology" },
      { code: "BIEN", name: "Minor Program in Bioengineering" },
      { code: "BUS", name: "Minor Program in Business" },
      { code: "CHEM", name: "Minor Program in Chemistry" },
      { code: "DESN", name: "Minor Program in Design" },
      { code: "ENTR", name: "Minor Program in Entrepreneurship" },
      { code: "ENVS", name: "Minor Program in Environmental Science" },
      { code: "HUMA", name: "Minor Program in Humanities" },
      { code: "IT", name: "Minor Program in Information Technology" },
      { code: "MATH", name: "Minor Program in Mathematics" },
      { code: "PBS", name: "Minor Program in Psychological and Behavioral Science" },
      { code: "PHYS", name: "Minor Program in Physics" },
      { code: "ROBO", name: "Minor Program in Robotics" },
      { code: "SC", name: "Minor Program in Smart City" },
      { code: "SOSC", name: "Minor Program in Social Science" },
      { code: "SUST", name: "Minor Program in Sustainability" },
    ],
    extendedMajors: [
      { code: "EXTM-AI", name: "Extended Major Program in Artificial Intelligence (Major+AI)" },
      { code: "EXTM-CADH", name: "Extended Major Program in Creative Arts and Digital Humanities (Major+CADH)" },
      { code: "EXTM-SUST", name: "Extended Major Program in Sustainability (Major+SUST)" },
    ],
  },
  {
    year: "2023-24",
    schools: [
      {
        schoolCode: "AIS",
        schoolName: "Academy of Interdisciplinary Studies",
        majors: [
          { code: "EVMT", name: "BSc in Environmental Management and Technology" },
          { code: "IIM", name: "BSc in Individualized Interdisciplinary Major" },
          { code: "T&M-DDP", name: "BEng/BSc & BBA Dual Degree Program in Technology & Management" },
        ],
      },
      {
        schoolCode: "SBM",
        schoolName: "School of Business and Management",
        majors: [
          { code: "ACCT", name: "BBA in Professional Accounting" },
          { code: "ECOF", name: "BSc in Economics and Finance" },
          { code: "ECON", name: "BBA in Economics" },
          { code: "FINA", name: "BBA in Finance" },
          { code: "GBM", name: "BBA in General Business Management" },
          { code: "GBUS", name: "BBA in Global Business" },
          { code: "IS", name: "BBA in Information Systems" },
          { code: "MARK", name: "BBA in Marketing" },
          { code: "MGMT", name: "BBA in Management" },
          { code: "OM", name: "BBA in Operations Management" },
          { code: "QFIN", name: "BSc in Quantitative Finance" },
          { code: "RMBI", name: "BSc in Risk Management and Business Intelligence %" },
          { code: "SGFN", name: "BSc in Sustainable and Green Finance §" },
          { code: "WBB", name: "BBA in World Business *" },
        ],
      },
      {
        schoolCode: "SENG",
        schoolName: "School of Engineering",
        majors: [
          { code: "AE", name: "BEng in Aerospace Engineering" },
          { code: "BIEN", name: "BEng in Bioengineering" },
          { code: "CEEV", name: "BEng in Chemical and Environmental Engineering" },
          { code: "CENG", name: "BEng in Chemical Engineering" },
          { code: "CIEV", name: "BEng in Civil and Environmental Engineering" },
          { code: "CIVL", name: "BEng in Civil Engineering" },
          { code: "COMP", name: "BEng in Computer Science" },
          { code: "COSC", name: "BSc in Computer Science" },
          { code: "CPEG", name: "BEng in Computer Engineering" },
          { code: "DA", name: "BEng in Decision Analytics" },
          { code: "ELEC", name: "BEng in Electronic Engineering" },
          { code: "IEEM", name: "BEng in Industrial Engineering and Engineering Management" },
          { code: "ISDN", name: "BSc in Integrative Systems and Design" },
          { code: "MECH", name: "BEng in Mechanical Engineering" },
          { code: "SUSEE", name: "BEng in Sustainable Energy Engineering" },
        ],
      },
      {
        schoolCode: "SHSS",
        schoolName: "School of Humanities and Social Science",
        majors: [
          { code: "GCS", name: "BSc in Global China Studies" },
          { code: "QSA", name: "BSc in Quantitative Social Analysis" },
        ],
      },
      {
        schoolCode: "SSCI",
        schoolName: "School of Science",
        majors: [
          { code: "BCB", name: "BSc in Biochemistry and Cell Biology" },
          { code: "BIBU", name: "BSc in Biotechnology and Business #" },
          { code: "BIOT", name: "BSc in Biotechnology" },
          { code: "CHEM", name: "BSc in Chemistry" },
          { code: "DASC", name: "BSc in Data Analytics in Science" },
          { code: "DSCT", name: "BSc in Data Science and Technology @" },
          { code: "MAEC", name: "BSc in Mathematics and Economics #" },
          { code: "MATH", name: "BSc in Mathematics" },
          { code: "OST", name: "BSc in Ocean Science and Technology" },
          { code: "PHYS", name: "BSc in Physics" },
        ],
      },
    ],
    minors: [
      { code: "ACTM", name: "Minor Program in Actuarial Mathematics" },
      { code: "AERO", name: "Minor Program in Aeronautical Engineering" },
      { code: "ASCO", name: "Minor Program in Astrophysics and Cosmology" },
      { code: "BDT", name: "Minor Program in Big Data Technology" },
      { code: "BIEN", name: "Minor Program in Bioengineering" },
      { code: "BIOT", name: "Minor Program in Biotechnology" },
      { code: "BUS", name: "Minor Program in Business" },
      { code: "CHEM", name: "Minor Program in Chemistry" },
      { code: "CS", name: "Minor Program in China Studies" },
      { code: "DESN", name: "Minor Program in Design" },
      { code: "ENTR", name: "Minor Program in Entrepreneurship" },
      { code: "ENVS", name: "Minor Program in Environmental Science" },
      { code: "HUMA", name: "Minor Program in Humanities" },
      { code: "IT", name: "Minor Program in Information Technology" },
      { code: "MATH", name: "Minor Program in Mathematics" },
      { code: "PBS", name: "Minor Program in Psychological and Behavioral Science" },
      { code: "PHYS", name: "Minor Program in Physics" },
      { code: "ROBO", name: "Minor Program in Robotics" },
      { code: "SC", name: "Minor Program in Smart City" },
      { code: "SOSC", name: "Minor Program in Social Science" },
      { code: "SUSEE", name: "Minor Program in Sustainable Energy Engineering" },
      { code: "SUST", name: "Minor Program in Sustainability" },
    ],
    extendedMajors: [
      { code: "EXTM-AI", name: "Extended Major Program in Artificial Intelligence (Major+AI)" },
      { code: "EXTM-DMCA", name: "Extended Major Program in Digital Media and Creative Arts (Major+DMCA)" },
    ],
  },
  {
    year: "2024-25",
    schools: [
      {
        schoolCode: "AIS",
        schoolName: "Academy of Interdisciplinary Studies",
        majors: [
          { code: "EVMT", name: "BSc in Environmental Management and Technology" },
          { code: "IIM", name: "BSc in Individualized Interdisciplinary Major" },
          { code: "ISDN", name: "BSc in Integrative Systems and Design" },
          { code: "T&M-DDP", name: "BEng/BSc & BBA Dual Degree Program in Technology & Management" },
        ],
      },
      {
        schoolCode: "SBM",
        schoolName: "School of Business and Management",
        majors: [
          { code: "ACCT", name: "BBA in Professional Accounting" },
          { code: "ECOF", name: "BSc in Economics and Finance" },
          { code: "ECON", name: "BBA in Economics" },
          { code: "FINA", name: "BBA in Finance" },
          { code: "GBM", name: "BBA in General Business Management" },
          { code: "GBUS", name: "BBA in Global Business" },
          { code: "IS", name: "BBA in Information Systems" },
          { code: "MARK", name: "BBA in Marketing" },
          { code: "MGMT", name: "BBA in Management" },
          { code: "OM", name: "BBA in Operations Management" },
          { code: "QFIN", name: "BSc in Quantitative Finance" },
          { code: "RMBI", name: "BSc in Risk Management and Business Intelligence %" },
          { code: "SGFN", name: "BSc in Sustainable and Green Finance §" },
          { code: "WBB", name: "BBA in World Business *" },
        ],
      },
      {
        schoolCode: "SENG",
        schoolName: "School of Engineering",
        majors: [
          { code: "AE", name: "BEng in Aerospace Engineering" },
          { code: "BIEN", name: "BEng in Bioengineering" },
          { code: "CEEV", name: "BEng in Chemical and Environmental Engineering" },
          { code: "CENG", name: "BEng in Chemical Engineering" },
          { code: "CIEV", name: "BEng in Civil and Environmental Engineering" },
          { code: "CIVL", name: "BEng in Civil Engineering" },
          { code: "COMP", name: "BEng in Computer Science" },
          { code: "COSC", name: "BSc in Computer Science" },
          { code: "CPEG", name: "BEng in Computer Engineering" },
          { code: "DA", name: "BEng in Decision Analytics" },
          { code: "ELEC", name: "BEng in Electronic Engineering" },
          { code: "IEEM", name: "BEng in Industrial Engineering and Engineering Management" },
          { code: "MECH", name: "BEng in Mechanical Engineering" },
          { code: "SUSEE", name: "BEng in Sustainable Energy Engineering" },
        ],
      },
      {
        schoolCode: "SHSS",
        schoolName: "School of Humanities and Social Science",
        majors: [
          { code: "GCS", name: "BSc in Global China Studies" },
          { code: "QSA", name: "BSc in Quantitative Social Analysis" },
        ],
      },
      {
        schoolCode: "SSCI",
        schoolName: "School of Science",
        majors: [
          { code: "BCB", name: "BSc in Biochemistry and Cell Biology" },
          { code: "BIBU", name: "BSc in Biotechnology and Business #" },
          { code: "BIOT", name: "BSc in Biotechnology" },
          { code: "CHEM", name: "BSc in Chemistry" },
          { code: "DASC", name: "BSc in Data Analytics in Science" },
          { code: "DSCT", name: "BSc in Data Science and Technology @" },
          { code: "MAEC", name: "BSc in Mathematics and Economics #" },
          { code: "MATH", name: "BSc in Mathematics" },
          { code: "OST", name: "BSc in Ocean Science and Technology" },
          { code: "PHYS", name: "BSc in Physics" },
        ],
      },
    ],
    minors: [
      { code: "ACTM", name: "Minor Program in Actuarial Mathematics" },
      { code: "AERO", name: "Minor Program in Aeronautical Engineering" },
      { code: "ASCO", name: "Minor Program in Astrophysics and Cosmology" },
      { code: "BDT", name: "Minor Program in Big Data Technology" },
      { code: "BIEN", name: "Minor Program in Bioengineering" },
      { code: "BIOT", name: "Minor Program in Biotechnology" },
      { code: "BUS", name: "Minor Program in Business" },
      { code: "CHEM", name: "Minor Program in Chemistry" },
      { code: "CS", name: "Minor Program in China Studies" },
      { code: "DESN", name: "Minor Program in Design" },
      { code: "ENTR", name: "Minor Program in Entrepreneurship" },
      { code: "ENVS", name: "Minor Program in Environmental Science" },
      { code: "HUMA", name: "Minor Program in Humanities" },
      { code: "IT", name: "Minor Program in Information Technology" },
      { code: "MATH", name: "Minor Program in Mathematics" },
      { code: "PBS", name: "Minor Program in Psychological and Behavioral Science" },
      { code: "PHYS", name: "Minor Program in Physics" },
      { code: "ROBO", name: "Minor Program in Robotics" },
      { code: "SC", name: "Minor Program in Smart City" },
      { code: "SOSC", name: "Minor Program in Social Science" },
      { code: "SUSEE", name: "Minor Program in Sustainable Energy Engineering" },
      { code: "SUST", name: "Minor Program in Sustainability" },
    ],
    extendedMajors: [
      { code: "EXTM-AI", name: "Extended Major Program in Artificial Intelligence (Major+AI)" },
      { code: "EXTM-DMCA", name: "Extended Major Program in Digital Media and Creative Arts (Major+DMCA)" },
    ],
  },
  {
    year: "2025-26",
    schools: [
      {
        schoolCode: "AIS",
        schoolName: "Academy of Interdisciplinary Studies",
        majors: [
          { code: "EVMT", name: "BSc in Environmental Management and Technology" },
          { code: "IIM", name: "BSc in Individualized Interdisciplinary Major" },
          { code: "ISDN", name: "BSc in Integrative Systems and Design" },
          { code: "T&M-DDP", name: "BEng/BSc & BBA Dual Degree Program in Technology & Management" },
        ],
      },
      {
        schoolCode: "SBM",
        schoolName: "School of Business and Management",
        majors: [
          { code: "ACCT", name: "BBA in Professional Accounting" },
          { code: "ECOF", name: "BSc in Economics and Finance" },
          { code: "ECON", name: "BBA in Economics" },
          { code: "FINA", name: "BBA in Finance" },
          { code: "GBM", name: "BBA in General Business Management" },
          { code: "GBUS", name: "BBA in Global Business" },
          { code: "IS", name: "BBA in Information Systems" },
          { code: "MARK", name: "BBA in Marketing" },
          { code: "MGMT", name: "BBA in Management" },
          { code: "OM", name: "BBA in Operations Management" },
          { code: "QFIN", name: "BSc in Quantitative Finance" },
          { code: "RMBI", name: "BSc in Risk Management and Business Intelligence %" },
          { code: "SGFN", name: "BSc in Sustainable and Green Finance §" },
          { code: "WBB", name: "BBA in World Business *" },
        ],
      },
      {
        schoolCode: "SENG",
        schoolName: "School of Engineering",
        majors: [
          { code: "AE", name: "BEng in Aerospace Engineering" },
          { code: "AI", name: "BEng in Artificial Intelligence" },
          { code: "BIEN", name: "BEng in Bioengineering" },
          { code: "CENG", name: "BEng in Chemical Engineering" },
          { code: "CIEV", name: "BEng in Civil and Environmental Engineering" },
          { code: "CIVL", name: "BEng in Civil Engineering" },
          { code: "COMP", name: "BEng in Computer Science" },
          { code: "COSC", name: "BSc in Computer Science" },
          { code: "CPEG", name: "BEng in Computer Engineering" },
          { code: "DA", name: "BEng in Decision Analytics" },
          { code: "EEEN", name: "BEng in Energy and Environmental Engineering" },
          { code: "ELEC", name: "BEng in Electronic Engineering" },
          { code: "IEEM", name: "BEng in Industrial Engineering and Engineering Management" },
          { code: "MECH", name: "BEng in Mechanical Engineering" },
          { code: "MEIC", name: "BEng in Microelectronics and Integrated Circuits" },
        ],
      },
      {
        schoolCode: "SHSS",
        schoolName: "School of Humanities and Social Science",
        majors: [
          { code: "GCS", name: "BSc in Global China Studies" },
          { code: "QSA", name: "BSc in Quantitative Social Analysis" },
        ],
      },
      {
        schoolCode: "SSCI",
        schoolName: "School of Science",
        majors: [
          { code: "BCB", name: "BSc in Biochemistry and Cell Biology" },
          { code: "BIBU", name: "BSc in Biotechnology and Business #" },
          { code: "BIOT", name: "BSc in Biotechnology" },
          { code: "BMH", name: "BSc in Biomedical and Health Sciences" },
          { code: "CHEM", name: "BSc in Chemistry" },
          { code: "DASC", name: "BSc in Data Analytics and Artificial Intelligence in Science" },
          { code: "DSCT", name: "BSc in Data Science and Technology @" },
          { code: "MAEC", name: "BSc in Mathematics and Economics #" },
          { code: "MATH", name: "BSc in Mathematics" },
          { code: "OST", name: "BSc in Ocean Science and Technology" },
          { code: "PHYS", name: "BSc in Physics" },
        ],
      },
    ],
    minors: [
      { code: "ACTM", name: "Minor Program in Actuarial Mathematics" },
      { code: "AERO", name: "Minor Program in Aeronautical Engineering" },
      { code: "ASCO", name: "Minor Program in Astrophysics and Cosmology" },
      { code: "BDT", name: "Minor Program in Big Data Technology" },
      { code: "BIEN", name: "Minor Program in Bioengineering" },
      { code: "BIOT", name: "Minor Program in Biotechnology" },
      { code: "BUS", name: "Minor Program in Business" },
      { code: "CHEM", name: "Minor Program in Chemistry" },
      { code: "DESN", name: "Minor Program in Design" },
      { code: "ENTR", name: "Minor Program in Entrepreneurship" },
      { code: "ENVS", name: "Minor Program in Environmental Science" },
      { code: "HUMA", name: "Minor Program in Humanities" },
      { code: "IT", name: "Minor Program in Information Technology" },
      { code: "MATH", name: "Minor Program in Mathematics" },
      { code: "PBS", name: "Minor Program in Psychological and Behavioral Science" },
      { code: "PHYS", name: "Minor Program in Physics" },
      { code: "ROBO", name: "Minor Program in Robotics" },
      { code: "SC", name: "Minor Program in Smart City" },
      { code: "SOSC", name: "Minor Program in Social Science" },
      { code: "SUST", name: "Minor Program in Sustainability" },
    ],
    extendedMajors: [
      { code: "EXTM-AI", name: "Extended Major Program in Artificial Intelligence (Major+AI)" },
      { code: "EXTM-DMCA", name: "Extended Major Program in Digital Media and Creative Arts (Major+DMCA)" },
      { code: "EXTM-SUST", name: "Extended Major Program in Sustainability (Major+SUST)" },
    ],
  },
  {
    year: "2026-27",
    schools: [
      {
        schoolCode: "AIS",
        schoolName: "Academy of Interdisciplinary Studies",
        majors: [
          { code: "EVMT", name: "BSc in Environmental Management and Technology" },
          { code: "IDT", name: "BSc in Innovation, Design and Technology" },
          { code: "IIM", name: "BSc in Individualized Interdisciplinary Major" },
          { code: "T&M-DDP", name: "BEng/BSc & BBA Dual Degree Program in Technology & Management" },
        ],
      },
      {
        schoolCode: "SBM",
        schoolName: "School of Business and Management",
        majors: [
          { code: "ACCT", name: "BBA in Professional Accounting" },
          { code: "EABU", name: "BBA in Eurasian Business ※" },
          { code: "ECOF", name: "BSc in Economics and Finance" },
          { code: "ECON", name: "BBA in Economics" },
          { code: "FINA", name: "BBA in Finance" },
          { code: "GBM", name: "BBA in General Business Management" },
          { code: "GBUS", name: "BBA in Global Business" },
          { code: "IS", name: "BBA in Information Systems" },
          { code: "MARK", name: "BBA in Marketing" },
          { code: "MGMT", name: "BBA in Management" },
          { code: "OM", name: "BBA in Operations Management" },
          { code: "QFIN", name: "BSc in Quantitative Finance" },
          { code: "RMBI", name: "BSc in Risk Management and Business Intelligence %" },
          { code: "SGFN", name: "BSc in Sustainable and Green Finance §" },
          { code: "WBB", name: "BBA in World Business *" },
        ],
      },
      {
        schoolCode: "SENG",
        schoolName: "School of Engineering",
        majors: [
          { code: "AE", name: "BEng in Aerospace Engineering" },
          { code: "AI", name: "BEng in Artificial Intelligence" },
          { code: "BIEN", name: "BEng in Bioengineering" },
          { code: "CENG", name: "BEng in Chemical Engineering" },
          { code: "CIEV", name: "BEng in Civil and Environmental Engineering" },
          { code: "CIVL", name: "BEng in Civil Engineering" },
          { code: "COMP", name: "BEng in Computer Science" },
          { code: "COSC", name: "BSc in Computer Science" },
          { code: "CPEG", name: "BEng in Computer Engineering" },
          { code: "DA", name: "BEng in Decision Analytics" },
          { code: "EEEN", name: "BEng in Energy and Environmental Engineering" },
          { code: "ELEC", name: "BEng in Electronic Engineering" },
          { code: "IEEM", name: "BEng in Industrial Engineering and Engineering Management" },
          { code: "MECH", name: "BEng in Mechanical Engineering" },
          { code: "MEIC", name: "BEng in Microelectronics and Integrated Circuits" },
        ],
      },
      {
        schoolCode: "SHSS",
        schoolName: "School of Humanities and Social Science",
        majors: [
          { code: "GCS", name: "BSc in Global China Studies" },
          { code: "QSA", name: "BSc in Quantitative Social Analysis" },
        ],
      },
      {
        schoolCode: "SSCI",
        schoolName: "School of Science",
        majors: [
          { code: "BCB", name: "BSc in Biochemistry and Cell Biology" },
          { code: "BIBU", name: "BSc in Biotechnology and Business #" },
          { code: "BIOT", name: "BSc in Biotechnology" },
          { code: "BMH", name: "BSc in Biomedical and Health Sciences" },
          { code: "CHEM", name: "BSc in Chemistry" },
          { code: "DASC", name: "BSc in Data Analytics and Artificial Intelligence in Science" },
          { code: "DSCT", name: "BSc in Data Science and Technology @" },
          { code: "MAEC", name: "BSc in Mathematics and Economics #" },
          { code: "MATH", name: "BSc in Mathematics" },
          { code: "OST", name: "BSc in Ocean Science and Technology" },
          { code: "PHYS", name: "BSc in Physics" },
        ],
      },
    ],
    minors: [
      { code: "ACTM", name: "Minor Program in Actuarial Mathematics" },
      { code: "AERO", name: "Minor Program in Aeronautical Engineering" },
      { code: "ASCO", name: "Minor Program in Astrophysics and Cosmology" },
      { code: "BDT", name: "Minor Program in Big Data Technology" },
      { code: "BIEN", name: "Minor Program in Bioengineering" },
      { code: "BUS", name: "Minor Program in Business" },
      { code: "CHEM", name: "Minor Program in Chemistry" },
      { code: "DESN", name: "Minor Program in Design" },
      { code: "ENTR", name: "Minor Program in Entrepreneurship" },
      { code: "ENVS", name: "Minor Program in Environmental Science" },
      { code: "HUMA", name: "Minor Program in Humanities" },
      { code: "IT", name: "Minor Program in Information Technology" },
      { code: "MATH", name: "Minor Program in Mathematics" },
      { code: "PBS", name: "Minor Program in Psychological and Behavioral Science" },
      { code: "PHYS", name: "Minor Program in Physics" },
      { code: "ROBO", name: "Minor Program in Robotics" },
      { code: "SC", name: "Minor Program in Smart City" },
      { code: "SOSC", name: "Minor Program in Social Science" },
      { code: "SUST", name: "Minor Program in Sustainability" },
    ],
    extendedMajors: [
      { code: "EXTM-AI", name: "Extended Major Program in Artificial Intelligence (Major+AI)" },
      { code: "EXTM-CADH", name: "Extended Major Program in Creative Arts and Digital Humanities (Major+CADH)" },
      { code: "EXTM-SUST", name: "Extended Major Program in Sustainability (Major+SUST)" },
    ],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Get programs for a specific intake year */
export function getProgramsForYear(year: string): YearPrograms | undefined {
  return ALL_YEARS_PROGRAMS.find((p) => p.year === year);
}

/** Get available intake years */
export function getAvailableYears(): string[] {
  return ALL_YEARS_PROGRAMS.map((p) => p.year);
}

/** Joint-school majors that can be entered from any of their co-offering
 *  schools (e.g. DSCT is offered jointly by SSCI and SENG). */
export const JOINT_MAJOR_SCHOOLS: Record<string, string[]> = {
  DSCT: ["SSCI", "SENG"],
  RMBI: ["SBM", "SSCI"],
};

/** Get majors for a school in a given year, including joint-school majors
 *  offered with this school. */
export function getMajorsForSchool(schoolCode: string | null, year?: string): ProgramInfo[] {
  if (!schoolCode) return [];
  const yp = year ? getProgramsForYear(year) : ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1];
  if (!yp) return [];
  const school = yp.schools.find((s) => s.schoolCode === schoolCode);
  const majors = [...(school?.majors ?? [])];
  for (const [code, schools] of Object.entries(JOINT_MAJOR_SCHOOLS)) {
    if (!schools.includes(schoolCode)) continue;
    if (majors.some((m) => m.code === code)) continue;
    // Look up the major from its primary (first-listed) school
    const sourceSchool = yp.schools.find((s) => s.schoolCode === schools[0]);
    const info = sourceSchool?.majors.find((m) => m.code === code);
    if (info) majors.push(info);
  }
  return majors;
}

/** Get minors for a given year */
export function getMinors(year?: string): ProgramInfo[] {
  const yp = year ? getProgramsForYear(year) : ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1];
  return yp?.minors ?? [];
}

/** Get extended majors for a given year */
export function getExtendedMajors(year?: string): ProgramInfo[] {
  const yp = year ? getProgramsForYear(year) : ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1];
  return yp?.extendedMajors ?? [];
}

/** Get latest year available */
export function getLatestYear(): string {
  return ALL_YEARS_PROGRAMS[ALL_YEARS_PROGRAMS.length - 1]?.year ?? "2026-27";
}
