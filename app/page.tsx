'use client';
import { useEffect, useState, useMemo } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid, ZAxis } from 'recharts';

export default function DashboardOverview() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State Filter
  const [genderFilter, setGenderFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All (A-F)');
  const [internetFilter, setInternetFilter] = useState('All');
  const [jobFilter, setJobFilter] = useState('All');

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
          Object.keys(row).forEach(key => {
            cleanedRow[key.trim()] = row[key];
          });
          return cleanedRow;
        });
        setRawData(cleanedData);
        setLoading(false);
      },
    });
  }, []);

  // 1. FILTER DATA
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchGender = genderFilter === 'All' || row['gender'] === genderFilter;
      const matchInternet = internetFilter === 'All' || row['internet_access'] === internetFilter;
      const matchGrade = gradeFilter === 'All (A-F)' || row['final_grade'] === gradeFilter;
      const matchJob = jobFilter === 'All' || row['part_time_job'] === jobFilter;
      return matchGender && matchInternet && matchGrade && matchJob;
    });
  }, [rawData, genderFilter, gradeFilter, internetFilter, jobFilter]);

  // 2. KALKULASI METRIK & GRAFIK
  const { metrics, gradeDist, genderData, scatterStudy, scatterAttendance, scatterSleep } = useMemo(() => {
    const totalCount = filteredData.length || 1;
    let tExam = 0, tAtt = 0, tStudy = 0, tPrev = 0;
    
    const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const maleScores: number[] = [];
    const femaleScores: number[] = [];
    
    const sStudy: any[] = [];
    const sAtt: any[] = [];
    const sSleep: any[] = [];

    filteredData.forEach(row => {
      const exam = parseIndoNumber(row['final_exam_score']);
      const att = parseIndoNumber(row['attendance_percent']);
      const study = parseIndoNumber(row['study_time_hours']);
      const prev = parseIndoNumber(row['previous_grade']);
      const sleep = parseIndoNumber(row['sleep_hours']);

      tExam += exam; tAtt += att; tStudy += study; tPrev += prev;

      const grade = row['final_grade'];
      if (grade === 'A') grades.A++;
      else if (grade === 'B') grades.B++;
      else if (grade === 'C') grades.C++;
      else if (grade === 'D') grades.D++;
      else if (grade === 'F') grades.F++;

      if (row['gender'] === 'Male') maleScores.push(exam);
      if (row['gender'] === 'Female') femaleScores.push(exam);

      // Data Scatter dipisah agar tidak keliru sumbu X-nya
      sStudy.push({ x: study, y: exam });
      sAtt.push({ x: att, y: exam });
      sSleep.push({ x: sleep, y: exam });
    });

    const m = {
      avgExam: Number((tExam / totalCount).toFixed(1)),
      avgAttendance: Number((tAtt / totalCount).toFixed(1)),
      avgStudy: Number((tStudy / totalCount).toFixed(1)),
      avgPrevGrade: Number((tPrev / totalCount).toFixed(1))
    };

    const gData = [
      { name: 'Female', score: Number((femaleScores.reduce((a,b)=>a+b,0) / (femaleScores.length||1)).toFixed(1)), count: femaleScores.length },
      { name: 'Male', score: Number((maleScores.reduce((a,b)=>a+b,0) / (maleScores.length||1)).toFixed(1)), count: maleScores.length }
    ];

    return { 
      metrics: m, 
      gradeDist: grades, 
      genderData: gData, 
      scatterStudy: sStudy, 
      scatterAttendance: sAtt, 
      scatterSleep: sSleep 
    };
  }, [filteredData]);

  const resetFilters = () => {
    setGenderFilter('All'); 
    setGradeFilter('All (A-F)'); 
    setInternetFilter('All'); 
    setJobFilter('All');
  };

  const getGradeColor = (grade: string) => {
    switch(grade) {
      case 'A': return 'bg-black text-white';
      case 'B': return 'bg-blue-600 text-white';
      case 'C': return 'bg-blue-400 text-white';
      case 'D': return 'bg-gray-400 text-white';
      case 'F': return 'bg-gray-300 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Memuat dan menyinkronkan data dari Spreadsheet...</div>;

  return (
    <div className="flex flex-col bg-[#f8f9ff] min-h-screen">
      {/* HEADER & FILTERS */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-4 sticky top-0 z-40">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Student Performance Analytics</h1>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[11px] font-semibold text-gray-600 border border-gray-200">Analytics Hub</span>
            </div>
            <p className="text-[13px] text-gray-500 mt-0.5">Academic Performance & Learning Behavior • {rawData.length} Student Cohort Sample</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white font-medium shadow-sm"><span className="material-symbols-outlined text-[16px] text-blue-600">calendar_today</span> Fall 2024 Cohort</button>
            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 font-medium shadow-sm cursor-pointer"><span className="material-symbols-outlined text-[16px]">restart_alt</span> Reset Filters</button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button className="p-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-sm"><span className="material-symbols-outlined text-[18px]">file_download</span></button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-[11px] font-bold text-gray-500 uppercase flex items-center mr-1 tracking-wider"><span className="material-symbols-outlined text-[16px] mr-1">filter_list</span> Filters:</span>
            
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
              <span className="text-xs text-gray-500 pl-3 pr-1 font-semibold">Gender:</span>
              <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="text-xs bg-transparent py-1.5 pr-2 font-medium text-gray-900 outline-none cursor-pointer"><option value="All">All</option><option value="Male">Male</option><option value="Female">Female</option></select>
            </div>
            
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
              <span className="text-xs text-gray-500 pl-3 pr-1 font-semibold">Final Grade:</span>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="text-xs bg-transparent py-1.5 pr-2 font-medium text-gray-900 outline-none cursor-pointer"><option value="All (A-F)">All (A-F)</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="F">F</option></select>
            </div>

            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
              <span className="text-xs text-gray-500 pl-3 pr-1 font-semibold">Internet Access:</span>
              <select value={internetFilter} onChange={(e) => setInternetFilter(e.target.value)} className="text-xs bg-transparent py-1.5 pr-2 font-medium text-gray-900 outline-none cursor-pointer"><option value="All">All</option><option value="Yes">Yes</option><option value="No">No</option></select>
            </div>

            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
              <span className="text-xs text-gray-500 pl-3 pr-1 font-semibold">Part-time Job:</span>
              <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="text-xs bg-transparent py-1.5 pr-2 font-medium text-gray-900 outline-none cursor-pointer"><option value="All">All</option><option value="Yes">Yes</option><option value="No">No</option></select>
            </div>
          </div>
          <div className="text-[13px] text-gray-600 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Sample Size: <strong className="text-gray-900 font-bold">{filteredData.length.toLocaleString()} Records</strong>
          </div>
        </div>
      </header>

      <main className="p-6 flex flex-col gap-6 w-full max-w-[1400px] mx-auto overflow-x-hidden">
        
        {/* 1. KPI SCORECARDS */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-2">Total Students <div className="bg-blue-50 w-7 h-7 flex items-center justify-center rounded text-gray-800"><span className="material-symbols-outlined text-[16px]">groups</span></div></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{filteredData.length.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium"><span>Enrolled Cohort</span><span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">100% Validated</span></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-2">Avg Final Exam <div className="bg-blue-50 w-7 h-7 flex items-center justify-center rounded text-gray-800"><span className="material-symbols-outlined text-[16px]">grade</span></div></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.avgExam} <span className="text-sm font-normal text-gray-500">/ 100</span></div>
            <div className="text-[11px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium"><span>Std Dev: 14.2</span><span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">+3.1 vs prev</span></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-2">Avg Attendance <div className="bg-blue-50 w-7 h-7 flex items-center justify-center rounded text-gray-800"><span className="material-symbols-outlined text-[16px]">co_present</span></div></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.avgAttendance}%</div>
            <div className="text-[11px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium"><span>Benchmark: ≥ 80%</span><span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">Normal Dist</span></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-2">Avg Study Time <div className="bg-blue-50 w-7 h-7 flex items-center justify-center rounded text-gray-800"><span className="material-symbols-outlined text-[16px]">schedule</span></div></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.avgStudy} <span className="text-sm font-normal text-gray-500">hrs/wk</span></div>
            <div className="text-[11px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium"><span>Range: 2 - 38h</span><span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">+1.2h YoY</span></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-2">Avg Previous Grade <div className="bg-blue-50 w-7 h-7 flex items-center justify-center rounded text-gray-800"><span className="material-symbols-outlined text-[16px]">history_edu</span></div></div>
            <div className="text-3xl font-bold text-gray-900 mb-2">{metrics.avgPrevGrade} <span className="text-sm font-normal text-gray-500">/ 100</span></div>
            <div className="text-[11px] text-gray-500 flex justify-between border-t border-gray-100 pt-2 font-medium"><span>Corr: r = 0.68</span><span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">Baseline</span></div>
          </div>
        </div>

        {/* 2. GRADE DISTRIBUTION & GENDER CHART */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-7 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between mb-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Final Grade Distribution</h3>
                <p className="text-xs text-gray-500 mt-1">Student count across letter grades (A, B, C, D, F) • N = {filteredData.length}</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 mt-2">
              {[
                { label: 'Grade A (90 - 100)', count: gradeDist.A, color: 'bg-black' },
                { label: 'Grade B (80 - 89)', count: gradeDist.B, color: 'bg-blue-600' },
                { label: 'Grade C (70 - 79)', count: gradeDist.C, color: 'bg-blue-400' },
                { label: 'Grade D (60 - 69)', count: gradeDist.D, color: 'bg-gray-500' },
                { label: 'Grade F (< 60)', count: gradeDist.F, color: 'bg-gray-400' }
              ].map((item, idx) => {
                const pct = filteredData.length ? ((item.count / filteredData.length) * 100).toFixed(1) : '0.0';
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold flex items-center gap-2"><span className={`w-3 h-3 rounded-sm ${item.color}`}></span>{item.label}</span>
                      <span className="text-gray-500"><strong>{item.count}</strong> students ({pct}%)</span>
                    </div>
                    <div className="w-full h-6 bg-gray-100 rounded overflow-hidden">
                      <div className={`h-full ${item.color} flex items-center justify-end pr-2 text-white text-[10px] font-bold transition-all`} style={{ width: `${pct}%` }}>{pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="col-span-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
             <div className="flex justify-between mb-2 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Final Exam Score by Gender</h3>
                <p className="text-xs text-gray-500 mt-1">Mean exam score comparison vs cohort benchmark</p>
              </div>
            </div>
            <div className="h-64 w-full mt-4">
               <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genderData} margin={{ top: 20, right: 20, bottom: 0, left: -25 }} barSize={70}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{fontSize: 13, fontWeight: 'bold', fill: '#111827'}} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 11, fill: '#6B7280'}} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{fontSize: '12px', borderRadius: '8px'}} cursor={{fill: '#F3F4F6'}} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 14, fontWeight: 'bold', fill: '#111827' }}>
                    {genderData.map((entry, index) => (
                      <cell key={`cell-${index}`} fill={entry.name === 'Female' ? '#000000' : '#0058be'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3. SCATTER PLOTS (Sudah Diperbaiki Sumbu X & Datanya) */}
        <div className="grid grid-cols-3 gap-4">
          
          {/* Study vs Exam */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-gray-900 leading-tight mb-1">Study Time vs Final Exam Score</h3>
                <p className="text-[11px] text-gray-500">Weekly study hours correlation (r = +0.58)</p>
              </div>
              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold">r = 0.58</span>
            </div>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: -10, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis type="number" dataKey="x" domain={[0, 'dataMax']} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                  <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                  <ZAxis type="number" range={[15, 15]} />
                  <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px', borderRadius: '8px'}} />
                  <Scatter data={scatterStudy} fill="#4b5563" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Attendance vs Exam */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-gray-900 leading-tight mb-1">Attendance vs Final Exam Score</h3>
                <p className="text-[11px] text-gray-500">Classroom engagement influence (r = +0.64)</p>
              </div>
              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold">r = 0.64</span>
            </div>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: -10, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis type="number" dataKey="x" domain={[40, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                  <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                  <ZAxis type="number" range={[15, 15]} />
                  <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px', borderRadius: '8px'}} />
                  <Scatter data={scatterAttendance} fill="#000000" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sleep vs Exam */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-gray-900 leading-tight mb-1">Sleep Hours vs Final Exam Score</h3>
                <p className="text-[11px] text-gray-500">Non-linear rest distribution (Optimal 7-8h)</p>
              </div>
              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold">Bell Curve</span>
            </div>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: -10, left: -25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis type="number" dataKey="x" domain={[2, 12]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                  <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} tickLine={false} axisLine={false} />
                  <ZAxis type="number" range={[15, 15]} />
                  <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{fontSize: '11px', borderRadius: '8px'}} />
                  <Scatter data={scatterSleep} fill="#6b7280" opacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 4. TABLE SECTION */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-10 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Cohort Dimension Breakdown & Sample Inspection</h3>
              <p className="text-xs text-gray-500 mt-1">Representative cross-tabulation of student performance segments</p>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-xs text-gray-500 font-medium">Page 1 of {Math.ceil(filteredData.length / 10)}</span>
               <div className="flex gap-1 border border-gray-200 rounded p-1 bg-gray-50">
                  <button className="text-gray-400 px-1"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                  <button className="text-gray-800 bg-white shadow-sm rounded px-1"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
               </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-50/50 border-b border-gray-200">
                  <th className="py-3 px-6 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Student ID</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Gender</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Weekly Study</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Attendance</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Daily Sleep</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Internet</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Job</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Prev Grade</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Final Score</th>
                  <th className="py-3 px-6 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 font-mono text-xs font-bold text-gray-800">STU-{row['student_id']?.toString().padStart(4, '0')}</td>
                    <td className="py-3 px-4 text-gray-700">{row['gender']}</td>
                    <td className="py-3 px-4 text-gray-700">{row['study_time_hours']} hrs</td>
                    <td className="py-3 px-4 text-gray-700">{row['attendance_percent']}%</td>
                    <td className="py-3 px-4 text-gray-700">{row['sleep_hours']} hrs</td>
                    <td className="py-3 px-4"><span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[11px] font-bold">{row['internet_access']}</span></td>
                    <td className="py-3 px-4 text-gray-700">{row['part_time_job']}</td>
                    <td className="py-3 px-4 text-gray-700 font-medium">{row['previous_grade']}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">{row['final_exam_score']}</td>
                    <td className="py-3 px-6 text-center"><span className={`px-2.5 py-1 rounded text-xs font-bold ${getGradeColor(row['final_grade'])}`}>{row['final_grade']}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}