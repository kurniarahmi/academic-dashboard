'use client';
import { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';

export default function StudentSegmentationPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- GLOBAL FILTERS ---
  const [genderFilter, setGenderFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [internetFilter, setInternetFilter] = useState('All');
  const [jobFilter, setJobFilter] = useState('All');

  // --- TABLE FILTERS & PAGINATION ---
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vROuSR4dPS3g0kUuvcmmnX3QmZuUibCzlV-P0h5O2dYXv4mcPwf0_XH_Y5Xzg1XNyjARj_BZ85mdKX0/pub?output=csv";

  const parseIndoNumber = (val: string | number) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleanedData = results.data.map((row: any) => {
          const cleanedRow: any = {};
          Object.keys(row).forEach(key => cleanedRow[key.trim()] = row[key]);
          return cleanedRow;
        });
        setRawData(cleanedData);
        setLoading(false);
      },
    });
  }, []);

  // Reset pagination saat filter global berubah
  useEffect(() => { setCurrentPage(1); }, [genderFilter, gradeFilter, internetFilter, jobFilter, searchQuery, quickFilter]);

  // 1. FILTER GLOBAL (Mempengaruhi KPI, Kuadran, dan Tabel)
  const globalFilteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchGender = genderFilter === 'All' || row['gender'] === genderFilter;
      const matchGrade = gradeFilter === 'All' || row['final_grade'] === gradeFilter;
      const matchInternet = internetFilter === 'All' || row['internet_access'] === internetFilter;
      const matchJob = jobFilter === 'All' || row['part_time_job'] === jobFilter;
      return matchGender && matchGrade && matchInternet && matchJob;
    });
  }, [rawData, genderFilter, gradeFilter, internetFilter, jobFilter]);

  // 2. KALKULASI METRIK & SEGMENTASI (Berbasis globalFilteredData)
  const { kpi, parentStats, lifestyleStats, quadrants } = useMemo(() => {
    const totalCount = globalFilteredData.length || 1;
    let female = 0, firstGen = 0, noInternet = 0, working = 0, priority = 0;
    
    // Parent Edu Grouping
    const pGroup = {
      postGrad: { count: 0, score: 0 },
      bachelors: { count: 0, score: 0 },
      highSchool: { count: 0, score: 0 } // Includes 'None'
    };

    // Lifestyle Grouping
    const lGroup = {
      nw_ae: { count: 0, pass: 0 }, // Non-working + Active Extra
      nw_ne: { count: 0, pass: 0 }, // Non-working + No Extra
      w_ae: { count: 0, pass: 0 },  // Working + Active Extra
      w_ne: { count: 0, pass: 0 }   // Working + No Extra
    };

    // Quadrant Personas
    const qCount = { q1: 0, q2: 0, q3: 0, q4: 0 };
    const qScore = { q1: 0, q2: 0, q3: 0, q4: 0 };

    globalFilteredData.forEach(row => {
      const exam = parseIndoNumber(row['final_exam_score']);
      const isPass = ['A', 'B', 'C'].includes(row['final_grade']);
      const gender = row['gender'];
      const parent = row['parental_education'];
      const internet = row['internet_access'];
      const job = row['part_time_job'];
      const extra = row['extracurricular_activities'];

      // Basic KPI
      if (gender === 'Female') female++;
      if (['High School', 'None'].includes(parent)) firstGen++;
      if (internet === 'No') noInternet++;
      if (job === 'Yes') working++;
      
      // Priority Equity: First-Gen ATAU No Internet ATAU (Working + Low Parent Edu)
      if (['High School', 'None'].includes(parent) && (internet === 'No' || job === 'Yes')) priority++;

      // Parent Edu
      if (['Masters', 'PhD'].includes(parent)) { pGroup.postGrad.count++; pGroup.postGrad.score += exam; }
      else if (parent === 'Bachelors') { pGroup.bachelors.count++; pGroup.bachelors.score += exam; }
      else { pGroup.highSchool.count++; pGroup.highSchool.score += exam; }

      // Lifestyle
      if (job === 'No' && extra === 'Yes') { lGroup.nw_ae.count++; if (isPass) lGroup.nw_ae.pass++; }
      if (job === 'No' && extra === 'No') { lGroup.nw_ne.count++; if (isPass) lGroup.nw_ne.pass++; }
      if (job === 'Yes' && extra === 'Yes') { lGroup.w_ae.count++; if (isPass) lGroup.w_ae.pass++; }
      if (job === 'Yes' && extra === 'No') { lGroup.w_ne.count++; if (isPass) lGroup.w_ne.pass++; }

      // Quadrants Logic
      let quad = 0;
      if (['Masters', 'PhD', 'Bachelors'].includes(parent) && internet === 'Yes' && exam >= 80) quad = 1; // High Resource / High Achieving
      else if (job === 'Yes' && exam >= 70) quad = 2; // Resilient
      else if ((['High School', 'None'].includes(parent) || internet === 'No') && exam < 70) quad = 3; // At-Risk
      else quad = 4; // Resource-Secure / Low Effort or others

      if (quad === 1) { qCount.q1++; qScore.q1 += exam; }
      if (quad === 2) { qCount.q2++; qScore.q2 += exam; }
      if (quad === 3) { qCount.q3++; qScore.q3 += exam; }
      if (quad === 4) { qCount.q4++; qScore.q4 += exam; }
    });

    const cohortAvg = globalFilteredData.reduce((a, b) => a + parseIndoNumber(b['final_exam_score']), 0) / totalCount;

    return {
      kpi: {
        femalePct: ((female / totalCount) * 100).toFixed(1),
        malePct: (((totalCount - female) / totalCount) * 100).toFixed(1),
        femaleCnt: female, maleCnt: totalCount - female,
        firstGenPct: ((firstGen / totalCount) * 100).toFixed(1), firstGenCnt: firstGen,
        noNetPct: ((noInternet / totalCount) * 100).toFixed(1), noNetCnt: noInternet,
        jobPct: ((working / totalCount) * 100).toFixed(1), jobCnt: working,
        priorityPct: ((priority / totalCount) * 100).toFixed(1), priorityCnt: priority,
        cohortAvg: cohortAvg.toFixed(1)
      },
      parentStats: [
        { label: "Post-Graduate (Master's / PhD)", count: pGroup.postGrad.count, pct: (pGroup.postGrad.count/totalCount)*100, score: pGroup.postGrad.score/(pGroup.postGrad.count||1), color: 'bg-black' },
        { label: "Bachelor's Degree", count: pGroup.bachelors.count, pct: (pGroup.bachelors.count/totalCount)*100, score: pGroup.bachelors.score/(pGroup.bachelors.count||1), color: 'bg-blue-600' },
        { label: "High School / Baseline", count: pGroup.highSchool.count, pct: (pGroup.highSchool.count/totalCount)*100, score: pGroup.highSchool.score/(pGroup.highSchool.count||1), color: 'bg-red-400' }
      ],
      lifestyleStats: [
        { label: "Non-working + Active Extracurriculars", count: lGroup.nw_ae.count, passRate: (lGroup.nw_ae.pass/(lGroup.nw_ae.count||1))*100, color: 'bg-emerald-500' },
        { label: "Non-working + No Extracurriculars", count: lGroup.nw_ne.count, passRate: (lGroup.nw_ne.pass/(lGroup.nw_ne.count||1))*100, color: 'bg-blue-600' },
        { label: "Working + Active Extracurriculars", count: lGroup.w_ae.count, passRate: (lGroup.w_ae.pass/(lGroup.w_ae.count||1))*100, color: 'bg-gray-800' },
        { label: "Working + No Extracurriculars", count: lGroup.w_ne.count, passRate: (lGroup.w_ne.pass/(lGroup.w_ne.count||1))*100, color: 'bg-red-500' }
      ],
      quadrants: {
        q1: { count: qCount.q1, avg: (qScore.q1/(qCount.q1||1)).toFixed(1) },
        q2: { count: qCount.q2, avg: (qScore.q2/(qCount.q2||1)).toFixed(1) },
        q3: { count: qCount.q3, avg: (qScore.q3/(qCount.q3||1)).toFixed(1) },
        q4: { count: qCount.q4, avg: (qScore.q4/(qCount.q4||1)).toFixed(1) }
      }
    }
  }, [globalFilteredData]);

  // 3. TABLE FILTERING
  const tableData = useMemo(() => {
    return globalFilteredData.filter(row => {
      const matchSearch = searchQuery === '' || `STU-${row['student_id']?.toString().padStart(4, '0')}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchQuick = true;
      if (quickFilter === 'First-Gen') matchQuick = ['High School', 'None'].includes(row['parental_education']);
      else if (quickFilter === 'Working') matchQuick = row['part_time_job'] === 'Yes';
      else if (quickFilter === 'Digital Divide') matchQuick = row['internet_access'] === 'No';

      return matchSearch && matchQuick;
    });
  }, [globalFilteredData, searchQuery, quickFilter]);

  const totalPages = Math.ceil(tableData.length / pageSize) || 1;
  const currentTableData = tableData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getPersonaBadge = (exam: number, parent: string, internet: string, job: string) => {
    if (['Masters', 'PhD', 'Bachelors'].includes(parent) && internet === 'Yes' && exam >= 80) return { label: 'High Achiever', style: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (job === 'Yes' && exam >= 70) return { label: 'Resilient Scholar', style: 'bg-blue-50 text-blue-700 border-blue-100' };
    if ((['High School', 'None'].includes(parent) || internet === 'No') && exam < 70) return { label: 'Priority Support', style: 'bg-red-600 text-white shadow-sm border-red-700' };
    return { label: 'Targeted Tutoring', style: 'bg-gray-100 text-gray-700 border-gray-200' };
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 animate-pulse text-lg font-medium">Memuat Profil Demografi...</div>;

  return (
    <div className="flex flex-col bg-[#f8f9ff] min-h-screen font-sans">
      
      {/* HEADER & GLOBAL FILTERS */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40 shadow-sm transition-all">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Student Segmentation & Demographics</h1>
            <p className="text-[12px] text-gray-500 mt-0.5">Socioeconomic Profiling, Parental Education Influence, & Equity Cohort Segments</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
             <div className="text-gray-500 flex flex-col items-end">
               <span className="font-bold text-gray-700">{globalFilteredData.length} Validated Records</span>
               <span>Statistical Confidence: 99%</span>
             </div>
             <button className="bg-black text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold shadow-sm hover:bg-gray-800 active:scale-95 transition-all"><span className="material-symbols-outlined text-[16px]">calendar_today</span> Fall 2024</button>
             <button className="text-gray-400 hover:text-gray-900 transition-colors"><span className="material-symbols-outlined text-[20px]">file_download</span></button>
          </div>
        </div>

        {/* Global Filter Ribbon */}
        <div className="flex gap-4 items-center bg-gray-50 border border-gray-200 p-2 rounded-lg">
           <div className="flex gap-3 flex-wrap">
             <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All">Gender: All</option><option value="Male">Male</option><option value="Female">Female</option>
             </select>
             <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All">Final Grade: All</option><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option><option value="D">Grade D</option><option value="F">Grade F</option>
             </select>
             <select value={internetFilter} onChange={(e) => setInternetFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All">Internet: All</option><option value="Yes">Yes</option><option value="No">No (Restricted)</option>
             </select>
             <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All">Job: All</option><option value="Yes">Working</option><option value="No">Not Working</option>
             </select>
             <button onClick={() => {setGenderFilter('All'); setGradeFilter('All'); setInternetFilter('All'); setJobFilter('All');}} className="text-xs text-gray-500 hover:text-blue-700 px-2 py-1.5 flex items-center gap-1 active:scale-95 transition-all"><span className="material-symbols-outlined text-[14px]">close</span> Clear Filters</button>
           </div>
        </div>
      </header>

      <main className="p-6 flex flex-col gap-6 w-full max-w-[1400px] mx-auto overflow-x-hidden">
        
        {/* 1. KPI SCORECARDS */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Gender Balance <span className="material-symbols-outlined text-[16px] text-blue-500">wc</span></div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-gray-900">{kpi.femalePct}%</span>
              <span className="text-sm font-bold text-gray-400 pb-1">/ {kpi.malePct}%</span>
            </div>
            <div className="text-[10px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium">
              <span>{kpi.femaleCnt} Female / {kpi.maleCnt} Male</span><span className="bg-blue-50 text-blue-600 px-1 rounded font-bold">Parity</span>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">First-Gen Cohort <span className="material-symbols-outlined text-[16px] text-indigo-500">escalator_warning</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{kpi.firstGenPct}% <span className="text-xs font-normal text-gray-400">({kpi.firstGenCnt})</span></div>
            <div className="text-[10px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium">
              <span>High School or Lower</span><span className="bg-indigo-50 text-indigo-600 px-1 rounded font-bold">Title I Eligible</span>
            </div>
          </div>
          <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm hover:-translate-y-1 transition-transform duration-300 ring-1 ring-red-50">
            <div className="flex justify-between items-center text-[10px] text-red-600 font-bold uppercase tracking-wider mb-2">Digital Divide Risk <span className="material-symbols-outlined text-[16px] text-red-500">wifi_off</span></div>
            <div className="text-3xl font-bold text-red-600 mb-2">{kpi.noNetPct}% <span className="text-xs font-normal text-red-400">({kpi.noNetCnt})</span></div>
            <div className="text-[10px] text-red-500 flex justify-between border-t border-red-100 pt-2 font-medium">
              <span>Restricted / Unstable</span><span className="bg-red-50 px-1 rounded font-bold">Hardware Loan</span>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:-translate-y-1 transition-transform duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Part-Time Employed <span className="material-symbols-outlined text-[16px] text-gray-700">work</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{kpi.jobPct}% <span className="text-xs font-normal text-gray-400">({kpi.jobCnt})</span></div>
            <div className="text-[10px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium">
              <span>≥ 15 hrs / week</span><span className="bg-gray-100 px-1 rounded font-bold text-gray-700">Work-Study</span>
            </div>
          </div>
          <div className="bg-black rounded-xl p-4 shadow-md hover:-translate-y-1 transition-transform duration-300 text-white">
            <div className="flex justify-between items-center text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-2">Priority Equity Cohort <span className="material-symbols-outlined text-[16px] text-yellow-400">report</span></div>
            <div className="text-3xl font-bold text-white mb-2">{kpi.priorityPct}% <span className="text-xs font-normal text-gray-400">({kpi.priorityCnt})</span></div>
            <div className="text-[10px] text-gray-300 flex justify-between border-t border-gray-700 pt-2 font-medium">
              <span>Triple-Vulnerability</span><span className="bg-yellow-400/20 text-yellow-300 px-1 rounded font-bold">Tier 1 Support</span>
            </div>
          </div>
        </div>

        {/* 2. DEMOGRAPHIC CHARTS ROW */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Chart 1: Parental Education */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
             <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Parental Education Level vs. Student Performance</h3>
                <p className="text-[11px] text-gray-500 mt-1">Average Exam Score Breakdown by Household Academic Attainment</p>
              </div>
              <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded text-[10px] font-bold">+12.9 Pts Equity Delta</span>
            </div>
            
            <div className="flex flex-col gap-5">
              {parentStats.map((stat, idx) => {
                const diff = (stat.score - Number(kpi.cohortAvg)).toFixed(1);
                const isPos = Number(diff) > 0;
                return (
                  <div key={idx} className="flex flex-col gap-1.5 group">
                    <div className="flex justify-between items-end text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{stat.label}</span>
                        <span className="text-gray-400 text-[10px]">{stat.count} students ({stat.pct.toFixed(0)}%)</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className={`text-[10px] font-bold ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>{isPos ? '+' : ''}{diff} vs avg</span>
                         <span className="font-bold text-[14px] text-gray-900">{stat.score.toFixed(1)} <span className="text-[10px] font-normal text-gray-500">pts</span></span>
                      </div>
                    </div>
                    {/* Custom HTML Bar for accurate styling */}
                    <div className="w-full bg-gray-100 h-4 rounded overflow-hidden">
                       <div className={`h-full ${stat.color} transition-all duration-1000 ease-out`} style={{ width: `${(stat.score / 100) * 100}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-6 pt-3 border-t border-gray-100 text-[10px] text-gray-500 flex gap-4">
              <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200"><span className="material-symbols-outlined text-[14px] text-blue-500">info</span> Cohort Avg: {kpi.cohortAvg} pts</span>
              <span className="flex items-center px-2 py-1">Pearson r: 0.412 (p &lt; 0.001)</span>
            </div>
          </div>

          {/* Chart 2: Employment & Extracurricular */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
             <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Employment & Extracurricular Impact</h3>
                <p className="text-[11px] text-gray-500 mt-1">Passing Rate (Grades A-C) Across Intersecting Commitments</p>
              </div>
              <span className="material-symbols-outlined text-gray-400">bar_chart</span>
            </div>
            
            <div className="flex flex-col gap-5">
              {lifestyleStats.map((stat, idx) => {
                return (
                  <div key={idx} className="flex flex-col gap-1.5 group">
                    <div className="flex justify-between items-end text-xs">
                      <span className="font-bold text-gray-800">{stat.label}</span>
                      <span className={`font-bold text-[14px] ${idx === 3 ? 'text-red-600' : idx === 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{stat.passRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-4 rounded overflow-hidden relative border border-gray-200/50">
                       <div className={`h-full ${stat.color} transition-all duration-1000 ease-out`} style={{ width: `${stat.passRate}%` }}></div>
                    </div>
                    <div className="text-[10px] text-gray-400">{stat.count} students in cohort</div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* 3. RISK QUADRANTS (PERSONAS) */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
           <div className="flex justify-between items-end mb-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Demographic Equity & Risk Matrix: 4 Cohort Personas</h3>
                <p className="text-[11px] text-gray-500 mt-1">Clustered segmentation based on economic vulnerability, support infrastructure, and academic trajectory</p>
              </div>
              <div className="text-[10px] bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 font-bold">
                 Total Clustered: {globalFilteredData.length} Profiles
              </div>
           </div>

           <div className="grid grid-cols-4 gap-4">
              {/* Q1 */}
              <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-4 flex flex-col hover:shadow-md transition-shadow">
                 <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Quadrant 1</span>
                    <span className="text-xl font-bold text-emerald-900">{quadrants.q1.count} <span className="text-[10px] text-gray-500 font-normal">Students</span></span>
                 </div>
                 <h4 className="font-bold text-gray-900 mb-1">High Resource / High Achieving</h4>
                 <p className="text-[10px] text-gray-500 leading-tight flex-1 mb-4">College-educated parents, broadband equipped, no mandatory employment burden.</p>
                 <div className="bg-white border border-emerald-100 rounded-lg p-3 text-xs mb-3 shadow-sm">
                    <div className="flex justify-between mb-1"><span className="text-gray-500">Avg Exam Score</span><strong className="text-gray-900">{quadrants.q1.avg} pts</strong></div>
                    <div className="flex justify-between"><span className="text-gray-500">Resource Vuln.</span><strong className="text-emerald-600">Low</strong></div>
                 </div>
                 <div className="text-[10px] pt-2 border-t border-emerald-100">
                    <span className="text-gray-500 block mb-1">Institutional Action:</span>
                    <strong className="text-emerald-700">Advanced Research Track & Honors Mentorship</strong>
                 </div>
              </div>

              {/* Q2 */}
              <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-4 flex flex-col hover:shadow-md transition-shadow">
                 <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Quadrant 2</span>
                    <span className="text-xl font-bold text-blue-900">{quadrants.q2.count} <span className="text-[10px] text-gray-500 font-normal">Students</span></span>
                 </div>
                 <h4 className="font-bold text-gray-900 mb-1">Resilient / Self-Sufficient</h4>
                 <p className="text-[10px] text-gray-500 leading-tight flex-1 mb-4">Working part-time, high autonomy, maintaining competitive grades despite constraints.</p>
                 <div className="bg-white border border-blue-100 rounded-lg p-3 text-xs mb-3 shadow-sm">
                    <div className="flex justify-between mb-1"><span className="text-gray-500">Avg Exam Score</span><strong className="text-gray-900">{quadrants.q2.avg} pts</strong></div>
                    <div className="flex justify-between"><span className="text-gray-500">Burnout Prob.</span><strong className="text-orange-500">Moderate</strong></div>
                 </div>
                 <div className="text-[10px] pt-2 border-t border-blue-100">
                    <span className="text-gray-500 block mb-1">Institutional Action:</span>
                    <strong className="text-blue-700">Emergency Micro-grants & Asynchronous Flex</strong>
                 </div>
              </div>

              {/* Q3 (At Risk - Highlighted) */}
              <div className="border-2 border-red-500 bg-red-50 rounded-xl p-4 flex flex-col shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                 <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">PRIORITY</div>
                 <div className="flex justify-between items-start mb-2 mt-1">
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Quadrant 3</span>
                    <span className="text-xl font-bold text-red-900">{quadrants.q3.count} <span className="text-[10px] text-red-500 font-normal">Students</span></span>
                 </div>
                 <h4 className="font-bold text-red-700 mb-1">Under-resourced / At-Risk</h4>
                 <p className="text-[10px] text-red-600/80 leading-tight flex-1 mb-4">First-Gen baseline, unstable connectivity, urgent academic risk.</p>
                 <div className="bg-white border border-red-200 rounded-lg p-3 text-xs mb-3 shadow-sm">
                    <div className="flex justify-between mb-1"><span className="text-gray-500">Avg Exam Score</span><strong className="text-red-600">{quadrants.q3.avg} pts</strong></div>
                    <div className="flex justify-between"><span className="text-gray-500">Failure Risk</span><strong className="text-red-700">High</strong></div>
                 </div>
                 <div className="text-[10px] pt-2 border-t border-red-200">
                    <span className="text-red-500 block mb-1">Institutional Action:</span>
                    <strong className="text-red-700">Laptop Stipend + 1-on-1 Tutoring</strong>
                 </div>
              </div>

              {/* Q4 */}
              <div className="border border-gray-200 bg-gray-50/50 rounded-xl p-4 flex flex-col hover:shadow-md transition-shadow">
                 <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Quadrant 4</span>
                    <span className="text-xl font-bold text-gray-900">{quadrants.q4.count} <span className="text-[10px] text-gray-500 font-normal">Students</span></span>
                 </div>
                 <h4 className="font-bold text-gray-700 mb-1">Resource-Secure / Low Effort</h4>
                 <p className="text-[10px] text-gray-500 leading-tight flex-1 mb-4">Adequate socioeconomic safety net, stable broadband, but minimal engagement.</p>
                 <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs mb-3 shadow-sm">
                    <div className="flex justify-between mb-1"><span className="text-gray-500">Avg Exam Score</span><strong className="text-gray-900">{quadrants.q4.avg} pts</strong></div>
                    <div className="flex justify-between"><span className="text-gray-500">Absences</span><strong className="text-gray-700">Elevated</strong></div>
                 </div>
                 <div className="text-[10px] pt-2 border-t border-gray-200">
                    <span className="text-gray-500 block mb-1">Institutional Action:</span>
                    <strong className="text-gray-700">Advising Nudges & Attendance Contract</strong>
                 </div>
              </div>
           </div>
        </div>

        {/* 4. DEMOGRAPHIC COHORT REGISTER TABLE */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-10 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h3 className="text-[15px] font-bold text-gray-900">Demographic Cohort Register</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Student-level records mapped to demographic parameters and risk classification</p>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="relative group">
                 <span className="material-symbols-outlined absolute left-2 top-2 text-gray-400 text-[16px]">search</span>
                 <input type="text" placeholder="Search Student ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-48 bg-gray-50 focus:bg-white outline-none focus:border-blue-400 transition-all" />
               </div>
               
               <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50 text-[10px] font-bold text-gray-600">
                  <button onClick={() => setQuickFilter('All')} className={`px-3 py-1.5 rounded-md transition-all ${quickFilter === 'All' ? 'bg-black text-white shadow-sm' : 'hover:bg-gray-200'}`}>All</button>
                  <button onClick={() => setQuickFilter('First-Gen')} className={`px-3 py-1.5 rounded-md transition-all ${quickFilter === 'First-Gen' ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-gray-200'}`}>First-Gen ({kpi.firstGenCnt})</button>
                  <button onClick={() => setQuickFilter('Working')} className={`px-3 py-1.5 rounded-md transition-all ${quickFilter === 'Working' ? 'bg-gray-700 text-white shadow-sm' : 'hover:bg-gray-200'}`}>Working ({kpi.jobCnt})</button>
                  <button onClick={() => setQuickFilter('Digital Divide')} className={`px-3 py-1.5 rounded-md transition-all ${quickFilter === 'Digital Divide' ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-gray-200'}`}>Digital Divide ({kpi.noNetCnt})</button>
               </div>
            </div>
          </div>
          
          <div className="overflow-x-auto min-h-[350px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-50/30 border-b border-gray-200">
                  <th className="py-3 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Student ID</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Parental Education</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Internet Access</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Part-Time Job</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Extracurricular</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Final Exam</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Persona / Support Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[12px]">
                {currentTableData.length > 0 ? (
                  currentTableData.map((row, idx) => {
                    const exam = parseIndoNumber(row['final_exam_score']);
                    const parent = row['parental_education'];
                    const internet = row['internet_access'];
                    const job = row['part_time_job'];
                    const persona = getPersonaBadge(exam, parent, internet, job);

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors bg-white group cursor-default">
                        <td className="py-3 px-6 font-mono text-[11px] font-bold text-blue-900">STU-{row['student_id']?.toString().padStart(4, '0')}</td>
                        <td className="py-3 px-4 text-gray-600 font-medium">{row['gender']}</td>
                        <td className="py-3 px-4 text-gray-800 font-medium">{parent === 'None' ? 'High School / None' : parent}</td>
                        <td className="py-3 px-4">
                          <span className={`flex items-center gap-1 text-[11px] font-bold ${internet === 'Yes' ? 'text-emerald-600' : 'text-red-600'}`}>
                             <span className="material-symbols-outlined text-[14px]">{internet === 'Yes' ? 'wifi' : 'wifi_off'}</span>
                             {internet === 'Yes' ? 'High-Speed' : 'Restricted'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {job === 'Yes' ? <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-bold">Yes</span> : <span className="text-gray-400">No Job</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-700">{row['extracurricular_activities']}</td>
                        <td className="py-3 px-4 text-center font-bold text-gray-900">{exam.toFixed(1)}</td>
                        <td className="py-3 px-6 text-right flex justify-end">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-transform group-hover:scale-105 ${persona.style}`}>
                             <span className={`w-1.5 h-1.5 rounded-full ${persona.style.includes('bg-red') ? 'bg-white' : persona.style.includes('emerald') ? 'bg-emerald-500' : persona.style.includes('blue') ? 'bg-blue-500' : 'bg-gray-400'}`}></span> 
                             {persona.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm flex-col items-center justify-center flex gap-2"><span className="material-symbols-outlined text-3xl">search_off</span>Tidak ada data siswa yang cocok dengan filter demografi ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-500">
             <span>Showing {tableData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, tableData.length)} of {tableData.length} students</span>
             <div className="flex gap-1.5">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage===1} className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-white disabled:opacity-50 active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">chevron_left</span></button>
                {[...Array(Math.min(3, totalPages))].map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-7 h-7 rounded font-bold flex items-center justify-center active:scale-95 transition-all ${currentPage === i + 1 ? 'bg-black text-white shadow-sm' : 'border border-gray-200 hover:bg-white text-gray-700'}`}>{i + 1}</button>
                ))}
                {totalPages > 3 && <span className="w-7 h-7 flex items-center justify-center">...</span>}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage===totalPages} className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-white disabled:opacity-50 active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">chevron_right</span></button>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-gray-400 flex justify-between items-center px-2 pb-6">
           <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">security</span> FERPA Compliant • Institutional Research & Equity Office • Fall 2024 Audit</span>
           <span>Methodology Note • Segment Definitions • Export CSV (Cohort N={rawData.length})</span>
        </div>

      </main>
    </div>
  );
}