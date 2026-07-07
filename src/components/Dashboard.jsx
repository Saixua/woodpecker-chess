import React, { useState, useEffect } from 'react';
import { Trash2, Play, PlusCircle, Clock, CheckCircle, Info, X, Target, Brain, Calendar, ArrowLeft, Settings, Upload } from 'lucide-react';
import { Chess } from 'chess.js';
import SettingsModal from './SettingsModal';
import ProgressCharts from './ProgressCharts';
import { formatTheme } from '../utils';

export default function Dashboard({ 
  programs, 
  onCreateProgram, 
  onStartNextCycle, 
  onResumeProgram, 
  onDeleteProgram, 
  onClearHistory, 
  onDeleteHistoryItem, 
  onStartDebug,
  onStartDrillCycle,
  onStartDynamic,
  profile,
  puzzles,
  loading
}) {
  const [mode, setMode] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [filteredPuzzlesCount, setFilteredPuzzlesCount] = useState(0);
  
  const [dynamicLength, setDynamicLength] = useState(() => {
    return localStorage.getItem('dynamicLength') || '20';
  });
  
  // New program state
  const [programName, setProgramName] = useState('');
  const [puzzleCount, setPuzzleCount] = useState(100);
  const [startIndex, setStartIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState('All Themes');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All Difficulties');
  const [excludeMates, setExcludeMates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [classicTab, setClassicTab] = useState('database'); // 'database' or 'pgn'
  const [pgnText, setPgnText] = useState('');
  const [pgnProgramName, setPgnProgramName] = useState('My Custom Puzzles');
  const [pgnError, setPgnError] = useState('');
  const [parseProgress, setParseProgress] = useState(null);

  const handleParseTextAsync = (text, customName) => {
    setPgnError('');
    if (!text.trim()) return;
    
    let rawGames = [];
    if (text.includes('[Event ')) {
      rawGames = text.split('[Event ').filter(c => c.trim().length > 0).map(c => '[Event ' + c);
    } else if (text.includes('[FEN ')) {
      rawGames = text.split('[FEN ').filter(c => c.trim().length > 0).map(c => '[FEN ' + c);
    } else {
      rawGames = [text];
    }
    
    setParseProgress({ current: 0, total: rawGames.length });
    const parsedPuzzles = [];
    let i = 0;
    
    const parseChunk = () => {
      const chunkEnd = Math.min(i + 100, rawGames.length);
      for (; i < chunkEnd; i++) {
        const gText = rawGames[i];
        try {
          const g = new Chess();
          g.loadPgn(gText);
          const history = g.history({verbose: true});
          if (history.length > 0) {
            const uciMoves = history.map(m => m.from + m.to + (m.promotion || '')).join(' ');
            const initialFen = g.header().FEN || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            parsedPuzzles.push({
              puzzle_id: 'custom_' + Date.now() + '_' + i,
              fen: initialFen,
              moves: uciMoves
            });
          }
        } catch (err) {
           console.error('Failed to parse game', i, err);
        }
      }
      
      setParseProgress({ current: i, total: rawGames.length });
      
      if (i < rawGames.length) {
        requestAnimationFrame(() => setTimeout(parseChunk, 0));
      } else {
        setTimeout(() => {
          setParseProgress(null);
          if (parsedPuzzles.length === 0) {
            setPgnError('Failed to parse any valid puzzles from the text provided. Make sure it contains valid PGN move sequences.');
            return;
          }
          
          onCreateProgram(customName || 'Custom Puzzles', parsedPuzzles);
          setPgnText('');
        }, 100);
      }
    };
    
    parseChunk();
  };

  const handleCreatePgnProgram = () => {
    handleParseTextAsync(pgnText, pgnProgramName.trim());
  };

  
  const THEMES = [
    "All Themes", "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5",
    "smotheredMate", "backRankMate", "anastasiaMate", "arabianMate", 
    "hookMate", "bodenMate", "fork", "pin", "skewer", "discoveredAttack", "doubleCheck",
    "crushing", "advantage"
  ];
  
  const DIFFICULTIES = [
    "All Difficulties",
    "Beginner (< 1200)",
    "Intermediate (1200 - 1800)",
    "Advanced (1800+)"
  ];



  useEffect(() => {
    if (puzzles.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const puzzleId = urlParams.get('puzzle');
      if (puzzleId) {
        const found = puzzles.find(p => p.puzzle_id === puzzleId || p.id === puzzleId || p.puzzle_number == puzzleId);
        if (found) {
          onStartDebug([found]);
          window.history.replaceState(null, '', window.location.pathname);
        } else {
          alert(`Puzzle ID ${puzzleId} not found in database.`);
        }
      }
    }
  }, [puzzles, onStartDebug]);

  useEffect(() => {
    let count = 0;
    for (let p of puzzles) {
      const matchTheme = selectedTheme === 'All Themes' || (p.themes && p.themes.includes(selectedTheme));
      let matchDiff = true;
      if (selectedDifficulty === 'Beginner (< 1200)') matchDiff = p.rating < 1200;
      else if (selectedDifficulty === 'Intermediate (1200 - 1800)') matchDiff = p.rating >= 1200 && p.rating < 1800;
      else if (selectedDifficulty === 'Advanced (1800+)') matchDiff = p.rating >= 1800;
      
      let matchMate = true;
      if (excludeMates) {
        matchMate = !(p.themes && p.themes.some(t => t.toLowerCase().includes('mate')));
      }
      
      if (matchTheme && matchDiff && matchMate) count++;
    }
    setFilteredPuzzlesCount(count);
    setPuzzleCount(count);
    setStartIndex(0);
  }, [selectedTheme, selectedDifficulty, excludeMates, puzzles]);

  const handleCreateProgram = () => {
    if (puzzles.length === 0) return;
    
    let filteredPuzzles = puzzles.filter(p => {
      const matchTheme = selectedTheme === 'All Themes' || (p.themes && p.themes.includes(selectedTheme));
      let matchDiff = true;
      if (selectedDifficulty === 'Beginner (< 1200)') matchDiff = p.rating < 1200;
      else if (selectedDifficulty === 'Intermediate (1200 - 1800)') matchDiff = p.rating >= 1200 && p.rating < 1800;
      else if (selectedDifficulty === 'Advanced (1800+)') matchDiff = p.rating >= 1800;
      
      let matchMate = true;
      if (excludeMates) {
        matchMate = !(p.themes && p.themes.some(t => t.toLowerCase().includes('mate')));
      }
      
      return matchTheme && matchDiff && matchMate;
    });

    if (filteredPuzzles.length === 0) {
      alert("No puzzles match your selected filters. Please try different filters.");
      return;
    }

    
    const start = Math.min(Math.max(0, startIndex), Math.max(0, filteredPuzzles.length - 1));
    const end = Math.min(start + puzzleCount, filteredPuzzles.length);
    let subset = filteredPuzzles.slice(start, end);
    subset.sort((a, b) => a.rating - b.rating); // Sort by rating ascending
    
    let finalName = programName.trim() || 'Custom Program';
    if (selectedTheme !== 'All Themes' && !programName.trim()) {
      finalName = `${formatTheme(selectedTheme)} (${selectedDifficulty})`;
    }
    
    onCreateProgram(finalName, subset);
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getFormatDate = (ts) => new Date(ts).toLocaleString();

  return (
    <div style={{maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px'}}>
        <h1 style={{color: '#fff', margin: 0, fontSize: '28px'}}>Woodpecker Method Training</h1>
        <div style={{display: 'flex', gap: '8px'}}>
          <button 
            onClick={() => setShowSettings(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', 
              backgroundColor: 'transparent', border: '1px solid #4a4a4a', 
              color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            <Settings size={16} /> Settings
          </button>
          <button 
            onClick={() => setShowAbout(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', 
              backgroundColor: 'transparent', border: '1px solid #4a4a4a', 
              color: '#fff', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            <Info size={16} /> How it works
          </button>
        </div>
      </div>
      
      {loading ? (
        <p style={{color: '#aaa'}}>Loading puzzle database...</p>
      ) : mode === null ? (
        <>
          <div style={{display: 'flex', gap: '20px', marginBottom: '40px', flexWrap: 'wrap'}}>
            <button 
              onClick={() => setMode('classic')}
              style={{flex: 1, minWidth: '300px', padding: '40px 24px', backgroundColor: '#1e1c19', border: '1px solid #4a4a4a', borderRadius: '12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'}}
            >
              <Target size={48} color="var(--accent-primary)" style={{marginBottom: '16px'}} />
              <h2 style={{color: '#fff', fontSize: '24px', margin: '0 0 8px 0'}}>Classic Mode</h2>
              <p style={{color: 'var(--text-muted)', margin: 0, fontSize: '14px', lineHeight: '1.4'}}>Build your own cycle with custom themes and difficulties. Traditional Woodpecker Method training.</p>
            </button>
            
            <button 
              onClick={() => onStartDynamic(puzzles, dynamicLength)}
              style={{flex: 1, minWidth: '300px', padding: '40px 24px', backgroundColor: '#1a221a', border: '1px solid var(--accent-success)', borderRadius: '12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(46, 160, 67, 0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center'}}
            >
              <Brain size={48} color="var(--accent-success)" style={{marginBottom: '16px'}} />
              <h2 style={{color: '#fff', fontSize: '24px', margin: '0 0 8px 0'}}>Dynamic Coach</h2>
              <p style={{color: 'var(--text-muted)', margin: 0, fontSize: '14px', lineHeight: '1.4', marginBottom: '24px'}}>Just hit start. AI-driven spaced repetition tailored to your current Elo: <strong style={{color: '#fff'}}>{profile?.rating || 1200}</strong></p>
              
              <div style={{marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px'}} onClick={(e) => e.stopPropagation()}>
                 <span style={{color: 'var(--text-muted)', fontSize: '14px'}}>Puzzles:</span>
                 <select 
                    value={dynamicLength} 
                    onChange={(e) => {
                       setDynamicLength(e.target.value);
                       localStorage.setItem('dynamicLength', e.target.value);
                    }}
                    style={{backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid var(--accent-success)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', outline: 'none', fontSize: '14px', fontWeight: 'bold'}}
                 >
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="unlimited">Unlimited</option>
                 </select>
              </div>
            </button>
          </div>

          <div style={{backgroundColor: '#1e1c19', padding: '24px', borderRadius: '12px', border: '1px solid #4a4a4a', marginBottom: '40px'}}>
            <h3 style={{color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px'}}>
              <Calendar size={20} color="#aaa" /> Training Activity
              <span title="Each square represents a day. Darker green means more puzzles solved!&#10;&#10;0 puzzles&#10;1-4 puzzles&#10;5-14 puzzles&#10;15-29 puzzles&#10;30+ puzzles" style={{cursor: 'help', color: '#888', display: 'flex', alignItems: 'center', marginLeft: '4px'}}>
                 <Info size={14} />
              </span>
            </h3>
            <div style={{display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '8px', flexWrap: 'wrap'}}>
               {Array.from({length: 60}).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (59 - i));
                  const dateStr = d.toISOString().split('T')[0];
                  const count = profile?.activity?.[dateStr] || 0;
                  let color = '#2b2b2b';
                  if (count > 0 && count < 5) color = '#0e4429';
                  else if (count >= 5 && count < 15) color = '#006d32';
                  else if (count >= 15 && count < 30) color = '#26a641';
                  else if (count >= 30) color = '#39d353';
                  
                  // Simple tooltip via title
                  return (
                    <div 
                       key={dateStr} 
                       title={`${dateStr}: ${count} puzzles solved`}
                       style={{
                          width: '14px', height: '14px', backgroundColor: color, 
                          borderRadius: '2px', flexShrink: 0
                       }} 
                    />
                  )
               })}
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '4px', alignItems: 'center', marginTop: '12px', fontSize: '12px', color: '#888'}}>
               Less
               <div style={{width: '12px', height: '12px', backgroundColor: '#2b2b2b', borderRadius: '2px'}}/>
               <div style={{width: '12px', height: '12px', backgroundColor: '#0e4429', borderRadius: '2px'}}/>
               <div style={{width: '12px', height: '12px', backgroundColor: '#006d32', borderRadius: '2px'}}/>
               <div style={{width: '12px', height: '12px', backgroundColor: '#26a641', borderRadius: '2px'}}/>
               <div style={{width: '12px', height: '12px', backgroundColor: '#39d353', borderRadius: '2px'}}/>
               More
            </div>
          </div>
        </>
      ) : (
        <>
          <button 
            onClick={() => setMode(null)}
            style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0, marginBottom: '24px', fontSize: '15px'}}
          >
            <ArrowLeft size={16} /> Back to Modes
          </button>
          <div style={{display: 'flex', gap: '32px', flexWrap: 'wrap'}}>
            {/* Left Column: Create New Program */}
            <div style={{flex: '1', minWidth: '300px'}}>
              <h2 style={{color: '#fff', fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <PlusCircle size={20} color="var(--accent-primary)" />
                Create New Program
              </h2>
              


            
            <div style={{backgroundColor: '#1e1c19', padding: '24px', borderRadius: '12px', border: '1px solid #4a4a4a', flex: 1}}>
            <div style={{display: 'flex', gap: '24px', marginBottom: '24px'}}>
               <button 
                  onClick={() => setClassicTab('database')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: classicTab === 'database' ? '2px solid #fff' : '2px solid transparent',
                    color: classicTab === 'database' ? '#fff' : '#888',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: '0 0 8px 0'
                  }}
               >Database</button>
               <button 
                  onClick={() => setClassicTab('pgn')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: classicTab === 'pgn' ? '2px solid #fff' : '2px solid transparent',
                    color: classicTab === 'pgn' ? '#fff' : '#888',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: '0 0 8px 0'
                  }}
               >Import PGN</button>
            </div>
            
            {classicTab === 'database' && (
              <>
                <div style={{marginBottom: '24px'}}>
                  <label style={{display: 'block', marginBottom: '8px', color: '#fff', fontWeight: 'bold'}}>
                    Program Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. My Advantage Puzzles"
                    value={programName}
                    onChange={e => setProgramName(e.target.value)}
                    style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #4a4a4a', backgroundColor: '#1e1c19', color: '#fff'}}
                  />
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px'}}>
                  <div>
                    <label style={{display: 'block', color: '#fff', marginBottom: '8px', fontWeight: 'bold'}}>Theme</label>
                    <select 
                      value={selectedTheme} 
                      onChange={e => setSelectedTheme(e.target.value)}
                      className="input-field"
                      style={{width: '100%'}}
                    >
                      {THEMES.map(t => <option key={t} value={t}>{formatTheme(t)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{display: 'block', color: '#fff', marginBottom: '8px', fontWeight: 'bold'}}>Difficulty</label>
                    <select 
                      value={selectedDifficulty} 
                      onChange={e => setSelectedDifficulty(e.target.value)}
                      className="input-field"
                      style={{width: '100%'}}
                    >
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{marginBottom: '24px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid #4a4a4a'}}>
                  <label style={{display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer'}}>
                    <input 
                      type="checkbox" 
                      checked={excludeMates} 
                      onChange={e => setExcludeMates(e.target.checked)}
                      style={{marginTop: '4px', width: '20px', height: '20px'}}
                    />
                    <div>
                      <strong style={{color: '#fff', display: 'block', marginBottom: '4px', fontSize: '16px'}}>Exclude Checkmate Puzzles</strong>
                      <span style={{color: '#aaa', fontSize: '14px', lineHeight: '1.4'}}>
                        Highly recommended for beginners! This forces you to practice discovering pure tactics (Forks, Pins, Skewers, etc) instead of just grinding checkmates.
                      </span>
                    </div>
                  </label>
                </div>
                
                <p style={{color: '#aaa', marginBottom: '24px'}}>
                  You currently have <strong style={{color: '#fff'}}>{filteredPuzzlesCount}</strong> puzzles matching your filters in the local database.
                </p>
                
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', alignItems: 'flex-end'}}>
                  <div>
                    <label style={{display: 'block', color: '#fff', marginBottom: '8px', fontWeight: 'bold'}}>Start Index (0 - {Math.max(0, filteredPuzzlesCount - 1)})</label>
                    <input 
                      type="number" 
                      min="0"
                      max={Math.max(0, filteredPuzzlesCount - 1)}
                      value={startIndex} 
                      onChange={e => setStartIndex(parseInt(e.target.value) || 0)}
                      className="input-field"
                      style={{width: '100%'}}
                    />
                  </div>
                  <div>
                    <label style={{display: 'block', color: '#fff', marginBottom: '8px', fontWeight: 'bold'}}>Puzzle Count</label>
                    <input 
                      type="number" 
                      min="1"
                      max={filteredPuzzlesCount}
                      value={puzzleCount} 
                      onChange={e => setPuzzleCount(parseInt(e.target.value) || 1)}
                      className="input-field"
                      style={{width: '100%'}}
                    />
                  </div>
                </div>

                <button 
                  className="btn-primary"
                  onClick={handleCreateProgram}
                  disabled={filteredPuzzlesCount === 0}
                  style={{width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}
                >
                  <PlusCircle size={20} /> Create & Start Program
                </button>
              </>
            )}

            {classicTab === 'pgn' && (
              <>
                <div style={{marginBottom: '16px'}}>
                  <label style={{display: 'block', color: '#fff', marginBottom: '8px', fontWeight: 'bold'}}>Program Name</label>
                  <input 
                    type="text" 
                    value={pgnProgramName} 
                    onChange={e => setPgnProgramName(e.target.value)}
                    className="input-field"
                    style={{width: '100%'}}
                    placeholder="My Custom Puzzles"
                  />
                </div>
                <div style={{marginBottom: '16px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                    <label style={{color: '#fff', fontWeight: 'bold'}}>Paste PGN String(s)</label>
                    <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#a0855b', backgroundColor: '#2a2622', padding: '4px 8px', borderRadius: '4px'}}>
                      <Upload size={14} /> Upload .pgn File
                      <input 
                        type="file" 
                        accept=".pgn" 
                        style={{display: 'none'}} 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (!pgnProgramName.trim() && file.name) {
                            setPgnProgramName(file.name.replace('.pgn', ''));
                          }
                          const reader = new FileReader();
                          reader.onload = (e) => handleParseTextAsync(e.target.result, pgnProgramName.trim() || file.name.replace('.pgn', ''));
                          reader.readAsText(file);
                        }} 
                      />
                    </label>
                  </div>
                  <textarea 
                    value={pgnText}
                    onChange={e => setPgnText(e.target.value)}
                    className="input-field"
                    style={{width: '100%', height: '200px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px'}}
                    placeholder="[FEN &quot;rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1&quot;]&#10;1. e4 e5 2. Nf3 Nc6"
                  ></textarea>
                </div>
                
                {pgnError && (
                  <div style={{color: 'var(--accent-danger)', backgroundColor: 'rgba(255, 107, 107, 0.1)', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px', border: '1px solid var(--accent-danger)'}}>
                    {pgnError}
                  </div>
                )}
                
                {parseProgress ? (
                  <div style={{width: '100%', backgroundColor: '#2a2622', padding: '16px', borderRadius: '4px', textAlign: 'center'}}>
                    <div style={{color: '#fff', marginBottom: '8px', fontWeight: 'bold'}}>
                      Parsing Puzzles: {parseProgress.current} / {parseProgress.total}
                    </div>
                    <div style={{width: '100%', height: '8px', backgroundColor: '#161512', borderRadius: '4px', overflow: 'hidden'}}>
                      <div style={{height: '100%', backgroundColor: 'var(--accent-success)', width: `${(parseProgress.current / Math.max(1, parseProgress.total)) * 100}%`, transition: 'width 0.1s'}} />
                    </div>
                  </div>
                ) : (
                  <button 
                    className="btn-primary"
                    onClick={handleCreatePgnProgram}
                    disabled={!pgnText.trim()}
                    style={{width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}
                  >
                    <PlusCircle size={20} /> Parse & Create Program
                  </button>
                )}
                <p style={{color: '#888', fontSize: '13px', marginTop: '16px', lineHeight: '1.4'}}>
                  You can paste multiple games from a database export. Ensure each puzzle includes its starting FEN (if custom) and the correct solution move sequence.
                </p>
              </>
            )}
          </div>
          </div>

            {/* Right Column: Existing Programs */}
            <div style={{flex: '1', minWidth: '300px'}}>
              <h2 style={{color: '#fff', fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <Clock size={20} color="#aaa" />
                Your Saved Programs
              </h2>
              
              {programs.length === 0 ? (
                <div style={{padding: '32px', textAlign: 'center', backgroundColor: '#1e1c19', borderRadius: '8px', border: '1px solid #333'}}>
                  <p style={{color: '#888', margin: 0}}>You don't have any saved programs yet. Create one on the left!</p>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                  {programs.map(program => (
                    <div key={program.id} style={{backgroundColor: '#1e1c19', borderRadius: '8px', border: '1px solid #333', overflow: 'hidden'}}>
                      <div style={{padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                          <h3 style={{margin: '0 0 4px 0', color: '#fff', fontSize: '16px'}}>{program.name}</h3>
                          <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '13px'}}>
                            {program.history.length > 0 ? program.history[0].puzzles.length : (program.activeCycle ? program.activeCycle.puzzles.length : 0)} puzzles • Completed {program.history.length} cycles
                          </p>
                        </div>
                        <button 
                          onClick={() => onDeleteProgram(program.id)}
                          style={{background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px'}}
                          title="Delete Program"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div style={{padding: '12px 16px', backgroundColor: 'rgba(0,0,0,0.2)'}}>
                        {program.activeCycle && !program.activeCycle.completed ? (
                          <button 
                            className="btn-primary" 
                            onClick={() => onResumeProgram(program.id)}
                            style={{width: '100%', padding: '10px', fontSize: '14px', backgroundColor: 'var(--accent-success)', color: '#000', fontWeight: 'bold'}}
                          >
                            Resume Cycle {program.activeCycle.cycleNum}
                          </button>
                        ) : (
                          <>
                            <button 
                              className="btn-secondary" 
                              onClick={() => onStartNextCycle(program.id)}
                              style={{width: '100%', padding: '10px', fontSize: '14px'}}
                            >
                              Start Cycle {program.history.length + 1}
                            </button>
                            {program.history.length > 0 && program.history[program.history.length - 1].failedPuzzles && program.history[program.history.length - 1].failedPuzzles.length > 0 && (
                              <button
                                className="btn-secondary"
                                onClick={() => onStartDrillCycle(program.id, program.history[program.history.length - 1].failedPuzzles)}
                                style={{width: '100%', padding: '10px', fontSize: '14px', marginTop: '8px', border: '1px solid var(--accent-danger)', color: '#ffb3b3'}}
                              >
                                Drill Mistakes ({program.history[program.history.length - 1].failedPuzzles.length})
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      
                      {program.history.length > 0 && (
                        <div style={{padding: '12px 16px', borderTop: '1px solid #333'}}>
                          <details>
                            <summary style={{color: 'var(--accent-primary)', fontSize: '13px', cursor: 'pointer', userSelect: 'none'}}>View History</summary>
                            <ProgressCharts history={program.history} />
                            <div style={{marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                              {program.history.map((cycle, i) => (
                                <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px'}}>
                                  <div>
                                    <strong style={{color: '#fff'}}>Cycle {cycle.cycleNum}</strong>
                                    <div style={{color: '#aaa', marginTop: '2px'}}>{getFormatDate(cycle.startTime)}</div>
                                    <div style={{color: 'var(--accent-success)', marginTop: '2px'}}>Time: {formatTime(cycle.totalTimeSpent)} • Fails: {cycle.fails}</div>
                                  </div>
                                  <button onClick={() => onDeleteHistoryItem(program.id, i)} style={{background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: '4px'}}><Trash2 size={14}/></button>
                                </div>
                              ))}
                              <button onClick={() => onClearHistory(program.id)} style={{background: 'none', border: 'none', color: 'var(--accent-danger)', fontSize: '12px', marginTop: '8px', cursor: 'pointer', textAlign: 'left', padding: 0}}>Clear All History for this Program</button>
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
            </div>
          </div>

          <div style={{marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #333', textAlign: 'center', color: '#666', fontSize: '12px'}}>
            <p style={{margin: 0}}>Puzzles provided by the <a href="https://database.lichess.org/" target="_blank" rel="noopener noreferrer" style={{color: '#888', textDecoration: 'underline'}}>Lichess open database</a>.</p>
          </div>
        </>
      )}

      {/* About Modal */}
      {showAbout && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, 
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1e1c19', border: '1px solid #4a4a4a', 
            borderRadius: '8px', maxWidth: '500px', width: '100%', 
            padding: '24px', position: 'relative'
          }}>
            <button 
              onClick={() => setShowAbout(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px', 
                background: 'transparent', border: 'none', color: '#888', cursor: 'pointer'
              }}
            >
              <X size={24} />
            </button>
            <h2 style={{color: '#fff', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Info size={24} color="var(--accent-primary)" /> About The Woodpecker Method
            </h2>
            <div style={{color: '#ccc', lineHeight: '1.5', fontSize: '15px'}}>
              <p>
                The <strong>Woodpecker Method</strong> is a chess training system based on <em>spaced repetition</em>. The goal is to build deep subconscious pattern recognition by solving the exact same set of puzzles multiple times.
              </p>
              <h4 style={{color: '#fff', marginBottom: '8px'}}>How to train:</h4>
              <ol style={{margin: '0 0 16px 0', paddingLeft: '24px'}}>
                <li style={{marginBottom: '8px'}}><strong>Cycle 1:</strong> Create a new program and solve all the puzzles. Take as much time as you need to get them right. This might take weeks!</li>
                <li style={{marginBottom: '8px'}}><strong>Cycle 2:</strong> Solve the exact same set of puzzles again. Your goal is to finish them in <strong>half the time</strong> it took you in Cycle 1.</li>
                <li style={{marginBottom: '8px'}}><strong>Cycle 3-7:</strong> Repeat the process! Keep halving your time. By Cycle 7, you should be solving the entire set almost instantly.</li>
              </ol>
              <p style={{margin: 0}}>
                When you see the pattern instantly without calculating, the method is working!
              </p>
            </div>
          </div>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} showDataManagement={true} />}
    </div>
  );
}
