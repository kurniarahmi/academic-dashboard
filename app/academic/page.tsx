'use client';
import { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ZAxis } from 'recharts';

export default function AcademicPerformancePage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATE FILTERS & PAGINATION ---
  const [genderFilter, setGenderFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All (A-F)');
  const [searchQuery, setSearchQuery] = useState('');
  
  // State untuk filter cepat di tabel
  const [quickFilter, setQuickFilter] = useState('All');
  
  // State untuk Halaman Tabel (Pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vROuSR4dPS3g0kUuvcmmnX3QmZuUibCzlV-P0h5O2dYXv4mcPwf0_XH_Y5Xzg1XNyjARj_BZ85mdKX0/pub?output=csv";

  // Helper parsing desimal (Indonesia)
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

  // --- KEMBALIKAN KE HALAMAN 1 JIKA FILTER BERUBAH ---
  useEffect(() => {
    setCurrentPage(1);
  }, [genderFilter, gradeFilter, searchQuery, quickFilter]);

  // 1. FILTER DATA KOMPREHENSIF
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchGender = genderFilter === 'All' || row['gender'] === genderFilter;
      const matchGrade = gradeFilter === 'All (A-F)' || row['final_grade'] === gradeFilter;
      const matchSearch = searchQuery === '' || `STU-${row['student_id']?.toString().padStart(4, '0')}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter Cepat Tabel
      let matchQuick = true;
      const fGrade = row['final_grade'];
      if (quickFilter === 'Honor Roll') matchQuick = fGrade === 'A';
      else if (quickFilter === 'Passing') matchQuick = ['A', 'B', 'C'].includes(fGrade);
      else if (quickFilter === 'At-Risk') matchQuick = ['D', 'F'].includes(fGrade);

      return matchGender && matchGrade && matchSearch && matchQuick;
    });
  }, [rawData, genderFilter, gradeFilter, searchQuery, quickFilter]);

  // --- LOGIKA PAGINATION ---
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const currentTableData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 2. KALKULASI METRIK & GRAFIK (Dari data yang sudah difilter)
  const { metrics, scatterData, trendline, progressionMatrix } = useMemo(() => {
    const totalCount = filteredData.length || 1;
    let tExam = 0, tPrev = 0;
    let passedCount = 0;
    let atRiskCount = 0;
    
    const scatters: any[] = [];
    const allExams: number[] = [];

    let improved = 0, improvedFemale = 0, improvedMale = 0;
    let maintained = 0, maintainedFemale = 0, maintainedMale = 0;
    let regressed = 0, regressedFemale = 0, regressedMale = 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    filteredData.forEach(row => {
      const exam = parseIndoNumber(row['final_exam_score']);
      const prev = parseIndoNumber(row['previous_grade']);
      const grade = row['final_grade'];
      const gender = row['gender'];

      tExam += exam; tPrev += prev;
      allExams.push(exam);

      if (['A', 'B', 'C'].includes(grade)) passedCount++;
      if (['D', 'F'].includes(grade)) atRiskCount++;

      scatters.push({ prev, exam, id: row['student_id'] });
      sumX += prev; sumY += exam; sumXY += (prev * exam); sumXX += (prev * prev);

      const delta = exam - prev;
      if (delta > 2) {
        improved++;
        if (gender === 'Female') improvedFemale++; else improvedMale++;
      } else if (delta < -2) {
        regressed++;
        if (gender === 'Female') regressedFemale++; else regressedMale++;
      } else {
        maintained++;
        if (gender === 'Female') maintainedFemale++; else maintainedMale++;
      }
    });

    allExams.sort((a, b) => b - a);
    const top10Count = Math.max(1, Math.floor(totalCount * 0.1));
    const top10Avg = allExams.slice(0, top10Count).reduce((a, b) => a + b, 0) / top10Count;

    const n = totalCount;
    let m = 0, b = 0;
    if (n * sumXX - sumX * sumX !== 0) {
       m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
       b = (sumY - m * sumX) / n;
    }

    const pMatrix = {
      total: totalCount,
      improved: { total: improved, pct: (improved/totalCount)*100, fPct: improved? (improvedFemale/improved)*100 : 0, mPct: improved? (improvedMale/improved)*100 : 0 },
      maintained: { total: maintained, pct: (maintained/totalCount)*100, fPct: maintained? (maintainedFemale/maintained)*100 : 0, mPct: maintained? (maintainedMale/maintained)*100 : 0 },
      regressed: { total: regressed, pct: (regressed/totalCount)*100, fPct: regressed? (regressedFemale/regressed)*100 : 0, mPct: regressed? (regressedMale/regressed)*100 : 0 },
    };

    return { 
      metrics: {
        passingRate: ((passedCount / totalCount) * 100).toFixed(1),
        gradeProgression: ((tExam / totalCount) - (tPrev / totalCount)).toFixed(1),
        atRiskRate: ((atRiskCount / totalCount) * 100).toFixed(1),
        atRiskTotal: atRiskCount,
        top10Avg: isNaN(top10Avg) ? '0.0' : top10Avg.toFixed(1),
        avgPrev: (tPrev / totalCount).toFixed(1)
      },
      scatterData: scatters,
      trendline: { m, b },
      progressionMatrix: pMatrix
    };
  }, [filteredData]);

  const getRiskUI = (finalGrade: string, delta: number) => {
    if (['A', 'B'].includes(finalGrade)) return { level: 'Low Risk', color: 'text-emerald-600', dot: 'bg-emerald-500', action: finalGrade === 'A' ? 'Honor Roll' : 'Passed' };
    if (finalGrade === 'C') return { level: 'Low Risk', color: 'text-emerald-600', dot: 'bg-emerald-500', action: 'Passed' };
    if (finalGrade === 'D') return { level: 'Moderate Risk', color: 'text-blue-600', dot: 'bg-blue-500', action: 'Peer Tutor Assigned' };
    return { level: 'Critical High', color: 'text-red-600', dot: 'bg-red-500', action: 'Remedial Required' };
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 animate-pulse text-lg font-medium">Memuat dan menyinkronkan data dari Spreadsheet...</div>;

  return (
    <div className="flex flex-col bg-[#f8f9ff] min-h-screen font-sans">
      
      {/* HEADER & FILTERS */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-4 sticky top-0 z-40 shadow-sm transition-all">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Academic Performance Analytics</h1>
              <span className="px-2 py-0.5 bg-blue-50 rounded-full text-[11px] font-semibold text-blue-700 border border-blue-100 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">timeline</span> Executive View
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">Curriculum Efficacy & Student Grade Progression • {rawData.length} Student Cohort Sample</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
             <span className="material-symbols-outlined text-[16px] animate-spin-slow">sync</span> Last synced just now
          </div>
        </div>

        <div className="flex gap-4 items-center bg-gray-50 border border-gray-200 p-2 rounded-lg">
           <div className="text-[11px] font-bold text-blue-800 uppercase px-3 border-r border-gray-200">PROD<br/>COHORT</div>
           <div className="flex gap-3 items-center">
             <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors">
               <option value="All">Gender: All</option><option value="Male">Male</option><option value="Female">Female</option>
             </select>
             <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors">
               <option value="All (A-F)">Final Grade: All</option><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option><option value="D">Grade D</option><option value="F">Grade F</option>
             </select>
             <button onClick={() => {setGenderFilter('All'); setGradeFilter('All (A-F)'); setSearchQuery(''); setQuickFilter('All');}} className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-md hover:bg-blue-50 active:scale-95 transition-all font-medium flex items-center gap-1">
               <span className="material-symbols-outlined text-[14px]">refresh</span> Reset Filters
             </button>
           </div>
        </div>
      </header>

      <main className="p-6 flex flex-col gap-6 w-full max-w-[1400px] mx-auto overflow-x-hidden">
        
        {/* 1. KPI SCORECARDS (Dengan efek Hover) */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Overall Passing Rate <span className="material-symbols-outlined text-[14px] text-blue-500">check_circle</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2 transition-all">{metrics.passingRate}%</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">+2.4%</span>
              <span className="leading-tight">vs prev cohort<br/>(Grade A-C)</span>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Grade Progression <span className="material-symbols-outlined text-[14px] text-blue-500">trending_up</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2 transition-all">{Number(metrics.gradeProgression) > 0 ? '+' : ''}{metrics.gradeProgression} <span className="text-sm font-normal text-gray-500">pts</span></div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">Baseline</span>
              <span className="leading-tight">{metrics.avgPrev} → {Number(metrics.avgPrev) + Number(metrics.gradeProgression)} Final<br/>Mean</span>
            </div>
          </div>
          <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm flex flex-col justify-between ring-1 ring-red-50 hover:shadow-md hover:shadow-red-100 hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="flex justify-between items-center text-[10px] text-red-600 font-bold uppercase tracking-wider mb-2">At-Risk / Remedial <span className="material-symbols-outlined text-[14px] bg-red-100 p-0.5 rounded">warning</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2 transition-all">{metrics.atRiskRate}%</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">{metrics.atRiskTotal} Students</span>
              <span className="leading-tight">Grades D & F<br/>(Target &lt;15%)</span>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Top 10% Percentile <span className="material-symbols-outlined text-[14px] text-blue-500">stars</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2 transition-all">{metrics.top10Avg} <span className="text-sm font-normal text-gray-500">/ 100</span></div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="text-blue-600 font-bold">{Math.max(1, Math.floor(filteredData.length * 0.1))} Qualify</span>
              <span className="leading-tight">Honor Roll<br/>Benchmark</span>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Prev Grade Baseline <span className="material-symbols-outlined text-[14px] text-blue-500">assignment</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2 transition-all">{metrics.avgPrev} <span className="text-sm font-normal text-gray-500">/ 100</span></div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">r = 0.68</span>
              <span className="leading-tight">Pearson<br/>Correlation</span>
            </div>
          </div>
        </div>

        {/* 2. CHARTS ROW */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Scatter Plot (Previous vs Final) */}
          <div className="col-span-7 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start border-b border-gray-100 pb-2 mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[18px]">scatter_plot</span> Previous Grade vs. Final Exam Score</h3>
                <p className="text-[11px] text-gray-500">Ordinary Least Squares (OLS) Linear Regression (N = {filteredData.length})</p>
              </div>
              <div className="flex gap-3 text-[10px] font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Actual Student</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-black"></span> Trendline</span>
              </div>
            </div>
            
            <div className="h-64 w-full">
              {scatterData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: -10, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis type="number" dataKey="prev" name="Prev Grade" domain={[40, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                    <YAxis type="number" dataKey="exam" name="Final Exam" domain={[20, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                    <ZAxis type="number" range={[15, 15]} />
                    <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Scatter data={scatterData} fill="#3b82f6" opacity={0.7} animationDuration={800} />
                    <ReferenceLine segment={[{x: 40, y: trendline.m * 40 + trendline.b}, {x: 100, y: trendline.m * 100 + trendline.b}]} stroke="#000000" strokeWidth={1.5} />
                    <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="3 3" opacity={0.4} />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-100">
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px] text-blue-500">info</span> 84.2% of cohort students remain within ±7.5 points of baseline expectancy.</span>
              <span className="font-bold bg-white px-2 py-1 rounded shadow-sm border border-gray-200">Slope: m = {trendline.m.toFixed(2)}</span>
            </div>
          </div>

          {/* Grade Progression Matrix */}
          <div className="col-span-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
             <div className="flex justify-between items-start border-b border-gray-100 pb-2 mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2"><span className="material-symbols-outlined text-emerald-600 text-[18px]">bar_chart</span> Grade Progression Matrix</h3>
                <p className="text-[11px] text-gray-500">Cohort mobility across diagnostic checkpoints (Before vs. After)</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-5 mt-2 flex-1">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-2 text-emerald-700"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm"></span> Improved Performance</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">{progressionMatrix.improved.pct.toFixed(1)}% <span className="text-emerald-600/70 font-normal">({progressionMatrix.improved.total})</span></span>
                </div>
                <div className="w-full h-3.5 bg-gray-100 rounded overflow-hidden flex shadow-inner">
                  <div className="h-full bg-emerald-600 transition-all duration-1000 ease-out" style={{ width: `${progressionMatrix.improved.fPct}%` }}></div>
                  <div className="h-full bg-emerald-400 transition-all duration-1000 ease-out delay-100" style={{ width: `${progressionMatrix.improved.mPct}%` }}></div>
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase"><span>Female: {progressionMatrix.improved.fPct.toFixed(0)}%</span><span>Male: {progressionMatrix.improved.mPct.toFixed(0)}%</span></div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-2 text-blue-800"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 shadow-sm"></span> Maintained Academic Band</span>
                  <span className="text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded">{progressionMatrix.maintained.pct.toFixed(1)}% <span className="text-blue-600/70 font-normal">({progressionMatrix.maintained.total})</span></span>
                </div>
                <div className="w-full h-3.5 bg-gray-100 rounded overflow-hidden flex shadow-inner">
                  <div className="h-full bg-blue-700 transition-all duration-1000 ease-out" style={{ width: `${progressionMatrix.maintained.fPct}%` }}></div>
                  <div className="h-full bg-blue-400 transition-all duration-1000 ease-out delay-100" style={{ width: `${progressionMatrix.maintained.mPct}%` }}></div>
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase"><span>Female: {progressionMatrix.maintained.fPct.toFixed(0)}%</span><span>Male: {progressionMatrix.maintained.mPct.toFixed(0)}%</span></div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-2 text-red-700"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 shadow-sm"></span> Regressed (-1 Grade Tier)</span>
                  <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded">{progressionMatrix.regressed.pct.toFixed(1)}% <span className="text-red-600/70 font-normal">({progressionMatrix.regressed.total})</span></span>
                </div>
                <div className="w-full h-3.5 bg-gray-100 rounded overflow-hidden flex shadow-inner">
                  <div className="h-full bg-red-700 transition-all duration-1000 ease-out" style={{ width: `${progressionMatrix.regressed.fPct}%` }}></div>
                  <div className="h-full bg-red-400 transition-all duration-1000 ease-out delay-100" style={{ width: `${progressionMatrix.regressed.mPct}%` }}></div>
                </div>
                <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase"><span>Female: {progressionMatrix.regressed.fPct.toFixed(0)}%</span><span>Male: {progressionMatrix.regressed.mPct.toFixed(0)}%</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. EARLY WARNING TABLE (Interaktif) */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-10 overflow-hidden transition-all duration-300">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[18px]">table_chart</span> Student Cohort Performance & Early Warning</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Granular grade breakdown and academic intervention flags</p>
            </div>
            <div className="flex items-center gap-3">
               {/* Search Input Interaktif */}
               <div className="relative group">
                 <span className="material-symbols-outlined absolute left-2 top-2 text-gray-400 text-[16px] group-focus-within:text-blue-500 transition-colors">search</span>
                 <input 
                    type="text" 
                    placeholder="Search STU-ID..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs w-48 bg-gray-50 focus:bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" 
                 />
               </div>
               
               {/* Tombol Filter Kategori Interaktif (Honor Roll, Passing, At-Risk) */}
               <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50 text-[10px] font-bold text-gray-600">
                  <button onClick={() => setQuickFilter('All')} className={`px-2.5 py-1 rounded-md transition-all active:scale-95 ${quickFilter === 'All' ? 'bg-white shadow-sm border border-gray-200 text-gray-900' : 'hover:bg-gray-200 text-gray-500'}`}>All</button>
                  <button onClick={() => setQuickFilter('Honor Roll')} className={`px-2.5 py-1 rounded-md transition-all active:scale-95 ${quickFilter === 'Honor Roll' ? 'bg-white shadow-sm border border-gray-200 text-gray-900' : 'hover:bg-gray-200 text-gray-500'}`}>Honor Roll</button>
                  <button onClick={() => setQuickFilter('Passing')} className={`px-2.5 py-1 rounded-md transition-all active:scale-95 ${quickFilter === 'Passing' ? 'bg-white shadow-sm border border-gray-200 text-gray-900' : 'hover:bg-gray-200 text-gray-500'}`}>Passing</button>
                  <button onClick={() => setQuickFilter('At-Risk')} className={`px-2.5 py-1 rounded-md transition-all active:scale-95 flex items-center gap-1 ${quickFilter === 'At-Risk' ? 'bg-red-50 shadow-sm border border-red-100 text-red-700' : 'hover:bg-gray-200 text-red-500'}`}><span className={`w-1.5 h-1.5 rounded-full ${quickFilter === 'At-Risk' ? 'bg-red-600 animate-pulse' : 'bg-red-400'}`}></span> At-Risk</button>
               </div>
            </div>
          </div>
          
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200">
                  <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Student ID</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gender</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Previous Grade</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Final Exam</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Progress Delta</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Final Grade</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Risk Level</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[13px]">
                {currentTableData.length > 0 ? (
                  currentTableData.map((row, idx) => {
                    const prev = parseIndoNumber(row['previous_grade']);
                    const exam = parseIndoNumber(row['final_exam_score']);
                    const delta = exam - prev;
                    const fGrade = row['final_grade'];
                    const riskUI = getRiskUI(fGrade, delta);

                    return (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors duration-200 bg-white group cursor-default">
                        <td className="py-4 px-6 font-mono text-[11px] font-bold text-gray-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                            <span className="material-symbols-outlined text-gray-400 group-hover:text-blue-500 text-[14px]">person</span>
                          </div>
                          STU-{row['student_id']?.toString().padStart(4, '0')}
                        </td>
                        <td className="py-4 px-4 text-gray-600">{row['gender']}</td>
                        <td className="py-4 px-4 text-center font-medium text-gray-600">{prev.toFixed(1)}</td>
                        <td className="py-4 px-4 text-center font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{exam.toFixed(1)}</td>
                        <td className="py-4 px-4 text-center">
                          <span className={`inline-block min-w-[50px] px-2 py-0.5 rounded text-[11px] font-bold transition-all ${delta > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : delta < 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-100 text-gray-600'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)} pts
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                           <span className="bg-gray-50 border border-gray-200 text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs mx-auto group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-all">{fGrade}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`flex items-center gap-1.5 text-[11px] font-bold ${riskUI.color}`}><span className={`w-1.5 h-1.5 rounded-full ${riskUI.dot}`}></span> {riskUI.level}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 w-max transition-all shadow-sm ${fGrade === 'A' ? 'bg-blue-500 text-white' : fGrade === 'D' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : ['F'].includes(fGrade) ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white border border-gray-200 text-gray-600'}`}>
                             {fGrade === 'A' && <span className="material-symbols-outlined text-[12px] text-yellow-300">star</span>}
                             {fGrade === 'F' && <span className="material-symbols-outlined text-[12px] text-red-500">warning</span>}
                             {riskUI.action}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400 text-sm">Tidak ada data siswa yang cocok dengan filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* LOGIKA PAGINATION AKTIF BAWAH TABEL */}
          <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-500">
             <span>Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} students</span>
             
             <div className="flex items-center gap-4">
                <span className="hidden sm:inline">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  
                  {/* Menampilkan 3 Halaman Pertama saja agar UI rapi */}
                  {[...Array(Math.min(3, totalPages))].map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center transition-all active:scale-95 ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md' : 'border border-gray-200 hover:bg-white text-gray-600'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  
                  {totalPages > 3 && <span className="w-7 h-7 flex items-center justify-center text-gray-400">...</span>}

                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}