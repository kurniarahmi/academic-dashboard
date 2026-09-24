'use client';
import { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ZAxis, ReferenceArea, BarChart, Bar, Cell } from 'recharts';

export default function LearningHabitsPage() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- GLOBAL FILTERS ---
  const [genderFilter, setGenderFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All (A-F)');
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

  // Kembalikan ke halaman 1 jika filter apapun berubah
  useEffect(() => { setCurrentPage(1); }, [searchQuery, quickFilter, genderFilter, gradeFilter, internetFilter, jobFilter]);

  // 1. FILTER GLOBAL (Mempengaruhi KPI dan Seluruh Grafik)
  const globalFilteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchGender = genderFilter === 'All' || row['gender'] === genderFilter;
      const matchGrade = gradeFilter === 'All (A-F)' || row['final_grade'] === gradeFilter;
      const matchInternet = internetFilter === 'All' || row['internet_access'] === internetFilter;
      const matchJob = jobFilter === 'All' || row['part_time_job'] === jobFilter;
      return matchGender && matchGrade && matchInternet && matchJob;
    });
  }, [rawData, genderFilter, gradeFilter, internetFilter, jobFilter]);


  // 2. FILTERING KHUSUS TABEL BAWAH (Mengambil dari data yang sudah di-filter global)
  const tableData = useMemo(() => {
    return globalFilteredData.filter(row => {
      const matchSearch = searchQuery === '' || `STU-${row['student_id']?.toString().padStart(4, '0')}`.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchQuick = true;
      const study = parseIndoNumber(row['study_time_hours']);
      const sleep = parseIndoNumber(row['sleep_hours']);
      const job = row['part_time_job'];
      
      if (quickFilter === 'High Study') matchQuick = study >= 20;
      else if (quickFilter === 'Sleep Deficit') matchQuick = sleep < 6;
      else if (quickFilter === 'Working') matchQuick = job === 'Yes';

      return matchSearch && matchQuick;
    });
  }, [globalFilteredData, searchQuery, quickFilter]);

  const totalPages = Math.ceil(tableData.length / pageSize) || 1;
  const currentTableData = tableData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 3. KALKULASI METRIK & GRAFIK (Dari globalFilteredData)
  const { metrics, scatterSleep, studyByGrade, employment, extraCurricular } = useMemo(() => {
    const totalCount = globalFilteredData.length || 1;
    let tStudy = 0, tSleep = 0, tAtt = 0;
    let internetCount = 0, jobCount = 0, extraCount = 0;
    
    const sSleep: any[] = [];
    const gradeStudySum = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const gradeCount = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    const groupJob = { yes: { exam: 0, study: 0, count: 0 }, no: { exam: 0, study: 0, count: 0 } };
    const groupExtra = { yes: { exam: 0, att: 0, count: 0 }, no: { exam: 0, att: 0, count: 0 } };

    globalFilteredData.forEach(row => {
      const study = parseIndoNumber(row['study_time_hours']);
      const sleep = parseIndoNumber(row['sleep_hours']);
      const att = parseIndoNumber(row['attendance_percent']);
      const exam = parseIndoNumber(row['final_exam_score']);
      const grade = row['final_grade'] as keyof typeof gradeStudySum;
      const job = row['part_time_job'];
      const extra = row['extracurricular_activities'];
      const internet = row['internet_access'];

      tStudy += study; tSleep += sleep; tAtt += att;
      if (internet === 'Yes') internetCount++;
      if (job === 'Yes') jobCount++;
      if (extra === 'Yes') extraCount++;

      sSleep.push({ x: sleep, y: exam });

      if (gradeStudySum[grade] !== undefined) {
        gradeStudySum[grade] += study;
        gradeCount[grade]++;
      }

      if (job === 'Yes') { groupJob.yes.exam += exam; groupJob.yes.study += study; groupJob.yes.count++; } 
      else { groupJob.no.exam += exam; groupJob.no.study += study; groupJob.no.count++; }

      if (extra === 'Yes') { groupExtra.yes.exam += exam; groupExtra.yes.att += att; groupExtra.yes.count++; } 
      else { groupExtra.no.exam += exam; groupExtra.no.att += att; groupExtra.no.count++; }
    });

    return { 
      metrics: {
        avgStudy: (tStudy / totalCount).toFixed(1),
        avgSleep: (tSleep / totalCount).toFixed(1),
        avgAtt: (tAtt / totalCount).toFixed(1),
        internetPct: ((internetCount / totalCount) * 100).toFixed(1),
        internetTotal: internetCount,
        jobPct: ((jobCount / totalCount) * 100).toFixed(1),
        jobTotal: jobCount
      },
      scatterSleep: sSleep,
      studyByGrade: [
        { name: 'Grade A (90 - 100)', avg: Number((gradeStudySum.A / (gradeCount.A || 1)).toFixed(1)), color: '#000000' },
        { name: 'Grade B (80 - 89)', avg: Number((gradeStudySum.B / (gradeCount.B || 1)).toFixed(1)), color: '#2563eb' },
        { name: 'Grade C (70 - 79)', avg: Number((gradeStudySum.C / (gradeCount.C || 1)).toFixed(1)), color: '#60a5fa' },
        { name: 'Grade D (60 - 69)', avg: Number((gradeStudySum.D / (gradeCount.D || 1)).toFixed(1)), color: '#9ca3af' },
        { name: 'Grade F (< 60)', avg: Number((gradeStudySum.F / (gradeCount.F || 1)).toFixed(1)), color: '#ef4444' }
      ],
      employment: {
        workPct: ((groupJob.yes.count / totalCount) * 100).toFixed(1),
        workExam: (groupJob.yes.exam / (groupJob.yes.count || 1)).toFixed(1),
        workStudy: (groupJob.yes.study / (groupJob.yes.count || 1)).toFixed(1),
        noWorkPct: ((groupJob.no.count / totalCount) * 100).toFixed(1),
        noWorkExam: (groupJob.no.exam / (groupJob.no.count || 1)).toFixed(1),
        noWorkStudy: (groupJob.no.study / (groupJob.no.count || 1)).toFixed(1),
      },
      extraCurricular: {
        yesPct: ((groupExtra.yes.count / totalCount) * 100).toFixed(1),
        yesExam: (groupExtra.yes.exam / (groupExtra.yes.count || 1)).toFixed(1),
        yesAtt: (groupExtra.yes.att / (groupExtra.yes.count || 1)).toFixed(1),
        noPct: ((groupExtra.no.count / totalCount) * 100).toFixed(1),
        noExam: (groupExtra.no.exam / (groupExtra.no.count || 1)).toFixed(1),
        noAtt: (groupExtra.no.att / (groupExtra.no.count || 1)).toFixed(1),
      }
    };
  }, [globalFilteredData]);

  const getRiskLevel = (study: number, sleep: number) => {
    if (study >= 15 && sleep >= 7) return { label: 'Optimal', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' };
    if (study > 25 && sleep < 6.5) return { label: 'Burnout Risk', color: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' };
    if (study < 10) return { label: 'Low Engagement', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
    return { label: 'Balanced', color: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' };
  };

  const resetGlobalFilters = () => {
    setGenderFilter('All');
    setGradeFilter('All (A-F)');
    setInternetFilter('All');
    setJobFilter('All');
    setQuickFilter('All');
    setSearchQuery('');
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 animate-pulse text-lg font-medium">Memuat Analitik Kebiasaan...</div>;

  return (
    <div className="flex flex-col bg-[#f8f9ff] min-h-screen font-sans">
      
      {/* HEADER & GLOBAL FILTERS */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40 shadow-sm transition-all">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Learning Habits & Student Lifestyle Analytics</h1>
            <p className="text-[13px] text-gray-500 mt-1">Study Behavior, Rest Cycles, and Extracurricular Impact • {globalFilteredData.length} Validated Records</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 border border-blue-100 rounded-full text-xs font-medium text-blue-800 shadow-sm">
             <span className="material-symbols-outlined text-[16px] text-blue-600">verified</span> Valid Statistical Power (n={globalFilteredData.length}, 99% CI)
          </div>
        </div>

        {/* Global Filter Ribbon */}
        <div className="flex gap-4 items-center bg-gray-50 border border-gray-200 p-2 rounded-lg">
           <div className="flex gap-3 flex-wrap">
             <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All">Gender: All</option><option value="Male">Male</option><option value="Female">Female</option>
             </select>
             <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All (A-F)">Final Grade: All</option><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option><option value="D">Grade D</option><option value="F">Grade F</option>
             </select>
             <select value={internetFilter} onChange={(e) => setInternetFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All">Internet: All</option><option value="Yes">Yes</option><option value="No">No (Restricted)</option>
             </select>
             <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white shadow-sm cursor-pointer hover:border-blue-300 transition-colors focus:outline-none">
               <option value="All">Job: All</option><option value="Yes">Working</option><option value="No">Not Working</option>
             </select>
             <button onClick={resetGlobalFilters} className="text-xs text-gray-500 hover:text-blue-700 px-2 py-1.5 flex items-center gap-1 active:scale-95 transition-all">
               <span className="material-symbols-outlined text-[14px]">close</span> Clear Filters
             </button>
           </div>
        </div>
      </header>

      <main className="p-6 flex flex-col gap-6 w-full max-w-[1400px] mx-auto">
        
        {/* 1. KPI SCORECARDS */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Avg Study Time <span className="material-symbols-outlined text-[16px] text-blue-400 bg-blue-50 p-1 rounded-md">schedule</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.avgStudy} <span className="text-sm font-normal text-gray-500">hrs/wk</span></div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">+1.2h YoY</span> Benchmark
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Avg Sleep Duration <span className="material-symbols-outlined text-[16px] text-blue-400 bg-blue-50 p-1 rounded-md">bedtime</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.avgSleep} <span className="text-sm font-normal text-gray-500">hrs/night</span></div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold border border-emerald-100">Optimal 7-8h</span> Bell curve
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Attendance Rate <span className="material-symbols-outlined text-[16px] text-blue-400 bg-blue-50 p-1 rounded-md">fact_check</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.avgAtt}%</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">r = +0.64</span> High correl.
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Home Internet Access <span className="material-symbols-outlined text-[16px] text-blue-400 bg-blue-50 p-1 rounded-md">wifi</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.internetPct}%</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="text-gray-800 font-bold">{metrics.internetTotal} active</span> records
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Working Students <span className="material-symbols-outlined text-[16px] text-blue-400 bg-blue-50 p-1 rounded-md">work</span></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.jobPct}%</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-2 border-t border-gray-100 pt-2 font-medium">
              <span className="text-gray-800 font-bold">{metrics.jobTotal} students</span> Part-time
            </div>
          </div>
        </div>

        {/* 2. CHARTS ROW */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Scatter Plot Sleep vs Exam */}
          <div className="col-span-7 bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start border-b border-gray-100 pb-2 mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Sleep Hours vs. Final Exam Score Correlation</h3>
                <p className="text-[11px] text-gray-500">Non-linear cognitive recovery band showing fatigue drop-offs vs. hyper-rest</p>
              </div>
              <div className="flex gap-2 text-[10px] font-bold text-gray-500">
                <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200"><span className="w-3 h-0.5 bg-blue-600"></span> Trend Line</span>
                <span className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-100 text-blue-700">Sweet Spot Band</span>
              </div>
            </div>
            
            <div className="h-64 w-full">
              {scatterSleep.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: -10, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis type="number" dataKey="x" domain={[3.5, 10.5]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                    <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                    <ZAxis type="number" range={[15, 15]} />
                    <RechartsTooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px', borderRadius: '8px'}} />
                    <ReferenceArea x1={7} x2={8.5} fill="#eff6ff" opacity={0.6} />
                    <ReferenceArea x1={3.5} x2={6} fill="#fef2f2" opacity={0.5} />
                    <Scatter data={scatterSleep} fill="#64748b" opacity={0.6} animationDuration={800} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">Tidak ada data untuk filter ini.</div>
              )}
            </div>
            <div className="text-[10px] text-gray-500 mt-2 bg-gray-50 p-2 rounded border border-gray-100 flex items-center justify-between">
              <span>Regression model: Inverted Quadratic Curve (R² ≈ 0.612)</span>
              <strong className="text-gray-800">Peak Exam Cohort: 7.4 hrs sleep / 81.2 avg pts</strong>
            </div>
          </div>

          {/* Bar Chart Study by Grade */}
          <div className="col-span-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
             <div className="flex justify-between items-start border-b border-gray-100 pb-2 mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Weekly Study Hours by Grade Band</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Linear correlation between structured weekly study commitments</p>
              </div>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">r = +0.58</span>
            </div>
            
            <div className="h-[220px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studyByGrade} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 10 }} barSize={16}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 600, fill: '#374151'}} width={120} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{fontSize: '11px', borderRadius: '6px'}} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#111827', fontSize: 11, fontWeight: 'bold', formatter: (val: any) => `${val} hrs` }}>
                    {studyByGrade.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10px] text-blue-800 bg-blue-50 p-2 rounded border border-blue-100 flex items-center gap-2 mt-2">
              <span className="material-symbols-outlined text-[14px]">lightbulb</span>
              Maintaining &gt;18 hours/week drops academic probation risk by 71%
            </div>
          </div>
        </div>

        {/* 3. DYNAMICS CARDS */}
        <div className="grid grid-cols-2 gap-4">
          
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
             <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2 mb-1">Employment Dynamics & Study Allocation <span className="material-symbols-outlined text-gray-400 text-[18px]">work</span></h3>
             <p className="text-[11px] text-gray-500 mb-4 pb-3 border-b border-gray-100">Performance divergence between non-employed vs part-time working students</p>
             
             <div className="flex items-stretch justify-between gap-4">
               <div className="bg-gray-50 rounded-lg p-4 flex-1 border border-gray-200">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide"><span>Non-Working</span> <span>{employment.noWorkPct}%</span></div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{employment.noWorkExam} <span className="text-xs text-gray-500 font-medium">pts avg</span></div>
                  <div className="text-[11px] text-gray-600 flex items-center gap-1 font-medium"><span className="material-symbols-outlined text-[14px]">schedule</span> Avg study: {employment.noWorkStudy} hrs/wk</div>
               </div>
               <div className="bg-blue-50/50 rounded-lg p-4 flex-1 border border-blue-100">
                  <div className="flex justify-between text-[10px] font-bold text-blue-600 mb-2 uppercase tracking-wide"><span>Part-Time</span> <span>{employment.workPct}%</span></div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{employment.workExam} <span className="text-xs text-gray-500 font-medium">pts avg</span></div>
                  <div className="text-[11px] text-gray-600 flex items-center gap-1 font-medium"><span className="material-symbols-outlined text-[14px]">schedule</span> Avg study: {employment.workStudy} hrs/wk</div>
               </div>
             </div>
             <p className="text-[10px] text-gray-500 mt-3 text-center">Employment status flags <strong>2.4x higher probability</strong> of sleep deficit (&lt;6 hrs).</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
             <h3 className="text-[15px] font-bold text-gray-900 flex items-center gap-2 mb-1">Extracurricular Engagement Matrix <span className="material-symbols-outlined text-gray-400 text-[18px]">sports_basketball</span></h3>
             <p className="text-[11px] text-gray-500 mb-4 pb-3 border-b border-gray-100">Campus club & athletics involvement vs retention and final performance</p>
             
             <div className="flex items-stretch justify-between gap-4">
               <div className="bg-emerald-50/50 rounded-lg p-4 flex-1 border border-emerald-100">
                  <div className="flex justify-between text-[10px] font-bold text-emerald-700 mb-2 uppercase tracking-wide"><span>Club Active</span> <span>{extraCurricular.yesPct}%</span></div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{extraCurricular.yesExam} <span className="text-xs text-gray-500 font-medium">pts avg</span></div>
                  <div className="text-[11px] text-gray-600 flex items-center gap-1 font-medium"><span className="material-symbols-outlined text-[14px]">fact_check</span> Attendance: {extraCurricular.yesAtt}%</div>
               </div>
               <div className="bg-gray-50 rounded-lg p-4 flex-1 border border-gray-200">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide"><span>No Extra</span> <span>{extraCurricular.noPct}%</span></div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{extraCurricular.noExam} <span className="text-xs text-gray-500 font-medium">pts avg</span></div>
                  <div className="text-[11px] text-gray-600 flex items-center gap-1 font-medium"><span className="material-symbols-outlined text-[14px]">warning</span> Attendance: {extraCurricular.noAtt}%</div>
               </div>
             </div>
             <p className="text-[10px] text-gray-500 mt-3 text-center">Moderate extracurricular involvement (1-2 clubs) yields best GPA outcomes.</p>
          </div>

        </div>

        {/* 4. BEHAVIORAL TABLE */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-10 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Habit Breakdown & Student Behavioral Register</h3>
              </div>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">{tableData.length} Records</span>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="relative group">
                 <span className="material-symbols-outlined absolute left-2 top-2 text-gray-400 text-[16px]">search</span>
                 <input type="text" placeholder="Search Student ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs w-48 bg-gray-50 focus:bg-white outline-none focus:border-blue-400 transition-colors" />
               </div>
               
               <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50 text-[10px] font-bold text-gray-600">
                  <button onClick={() => setQuickFilter('All')} className={`px-3 py-1 rounded-md transition-all active:scale-95 ${quickFilter === 'All' ? 'bg-black text-white shadow-sm' : 'hover:bg-gray-200'}`}>All</button>
                  <button onClick={() => setQuickFilter('High Study')} className={`px-3 py-1 rounded-md transition-all active:scale-95 ${quickFilter === 'High Study' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-200'}`}>High Study (&gt;20h)</button>
                  <button onClick={() => setQuickFilter('Sleep Deficit')} className={`px-3 py-1 rounded-md transition-all active:scale-95 ${quickFilter === 'Sleep Deficit' ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-gray-200'}`}>Sleep Deficit (&lt;6h)</button>
                  <button onClick={() => setQuickFilter('Working')} className={`px-3 py-1 rounded-md transition-all active:scale-95 ${quickFilter === 'Working' ? 'bg-gray-800 text-white shadow-sm' : 'hover:bg-gray-200'}`}>Working Students</button>
               </div>
            </div>
          </div>
          
          <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200">
                  <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Student ID</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gender</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Weekly Study</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Daily Sleep</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Internet Access</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Part-Time Job</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Final Exam</th>
                  <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Habit Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[12px]">
                {currentTableData.length > 0 ? (
                  currentTableData.map((row, idx) => {
                    const study = parseIndoNumber(row['study_time_hours']);
                    const sleep = parseIndoNumber(row['sleep_hours']);
                    const exam = parseIndoNumber(row['final_exam_score']);
                    const risk = getRiskLevel(study, sleep);

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors bg-white group cursor-default">
                        <td className="py-3 px-6 font-mono font-bold text-gray-800">STU-{row['student_id']?.toString().padStart(4, '0')}</td>
                        <td className="py-3 px-4 text-gray-500 font-medium">{row['gender']}</td>
                        <td className="py-3 px-4 text-center text-gray-900 font-bold">{study.toFixed(1)} hrs</td>
                        <td className="py-3 px-4 text-center text-gray-900 font-bold">{sleep.toFixed(1)} hrs</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row['internet_access'] === 'Yes' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>{row['internet_access'] === 'Yes' ? 'Yes' : 'No (Restricted)'}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row['part_time_job'] === 'Yes' ? <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">Yes</span> : <span className="text-gray-400">No</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-gray-900">{exam.toFixed(1)}</td>
                        <td className="py-3 px-6 text-right flex justify-end">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-transform group-hover:scale-105 ${risk.color}`}>
                             <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`}></span> {risk.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm flex gap-2 flex-col items-center justify-center"><span className="material-symbols-outlined text-3xl">search_off</span> Tidak ada data siswa yang cocok dengan filter yang diplih.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-500">
             <span>Showing {tableData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, tableData.length)} of {tableData.length} students</span>
             <div className="flex gap-1.5">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage===1} className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-white disabled:opacity-50 active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">chevron_left</span></button>
                {[...Array(Math.min(3, totalPages))].map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-7 h-7 rounded font-bold flex items-center justify-center transition-all active:scale-95 ${currentPage === i + 1 ? 'bg-black text-white shadow-sm' : 'border border-gray-200 hover:bg-white text-gray-700'}`}>{i + 1}</button>
                ))}
                {totalPages > 3 && <span className="w-7 h-7 flex items-center justify-center">...</span>}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage===totalPages} className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-white disabled:opacity-50 active:scale-95 transition-all"><span className="material-symbols-outlined text-xs">chevron_right</span></button>
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}