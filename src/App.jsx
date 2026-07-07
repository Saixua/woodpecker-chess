import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import SolvingInterface from './components/SolvingInterface';
import { calculateRatingChange } from './utils';

function App() {
  const [programs, setPrograms] = useState([]);
  const [activeProgramId, setActiveProgramId] = useState(null); 
  
  const [puzzles, setPuzzles] = useState([]);
  const [loadingPuzzles, setLoadingPuzzles] = useState(true);

  useEffect(() => {
    fetch('./lichess_puzzles.json')
      .then(res => res.json())
      .then(data => {
        setPuzzles(data);
        setLoadingPuzzles(false);
      })
      .catch(err => {
        console.error("Failed to load puzzles", err);
        setLoadingPuzzles(false);
      });
  }, []);
  
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('woodpeckerProfile');
    if (saved) return JSON.parse(saved);
    return {
      rating: 1200,
      activity: {},
      srs: {}
    };
  });

  const updateProfile = (updaterFn) => {
    setProfile(prev => {
      const next = updaterFn(prev);
      localStorage.setItem('woodpeckerProfile', JSON.stringify(next));
      return next;
    });
  };

  const handlePuzzleCompleted = (puzzleId, puzzleRating, timeSpent, failed) => {
    updateProfile(prev => {
      const next = { ...prev };
      
      // Update Activity (Calendar)
      const today = new Date().toISOString().split('T')[0];
      next.activity = { ...next.activity };
      next.activity[today] = (next.activity[today] || 0) + 1;
      
      // Update Elo & SRS
      next.srs = { ...next.srs };
      const currentSrs = next.srs[puzzleId] || { interval: 0, failures: 0, mastered: false, nextReview: 0 };
      
      const rChange = calculateRatingChange(next.rating, puzzleRating, timeSpent, failed);
      next.rating = Math.max(400, next.rating + rChange);

      if (failed) {
        currentSrs.interval = 1; 
        currentSrs.failures += 1;
        currentSrs.mastered = false;
      } else {
        if (timeSpent <= 5) {
          currentSrs.interval = 180; 
          currentSrs.mastered = true;
        } else {
          currentSrs.interval = Math.max(3, currentSrs.interval * 2); 
          currentSrs.mastered = false;
        }
      }
      currentSrs.nextReview = Date.now() + (currentSrs.interval * 24 * 60 * 60 * 1000);
      next.srs[puzzleId] = currentSrs;
      
      return next;
    });
  };
  
  useEffect(() => {
    const savedPrograms = localStorage.getItem('woodpeckerPrograms');
    if (savedPrograms) {
      setPrograms(JSON.parse(savedPrograms));
    } else {
      // Migrate legacy data
      const legacyHistory = JSON.parse(localStorage.getItem('woodpeckerHistory') || '[]');
      const legacyActive = JSON.parse(localStorage.getItem('woodpeckerActiveCycle') || 'null');
      if (legacyHistory.length > 0 || legacyActive) {
        const legacyProgram = {
          id: 'legacy_program_1',
          name: 'My Training Program',
          history: legacyHistory,
          activeCycle: legacyActive
        };
        setPrograms([legacyProgram]);
        localStorage.setItem('woodpeckerPrograms', JSON.stringify([legacyProgram]));
        localStorage.removeItem('woodpeckerHistory');
        localStorage.removeItem('woodpeckerActiveCycle');
      }
    }
    
    const savedActiveId = localStorage.getItem('woodpeckerActiveProgramId');
    const urlParams = new URLSearchParams(window.location.search);
    const hasPuzzleQuery = urlParams.has('puzzle');
    
    if (savedActiveId && !hasPuzzleQuery) {
      setActiveProgramId(savedActiveId);
    }
  }, []);

  const savePrograms = (newPrograms) => {
    setPrograms(newPrograms);
    localStorage.setItem('woodpeckerPrograms', JSON.stringify(newPrograms));
  };
  
  const updateProgram = (programId, updaterFn) => {
    const newPrograms = programs.map(p => p.id === programId ? updaterFn(p) : p);
    savePrograms(newPrograms);
  };

  const createProgram = (name, puzzleSubset) => {
    const newProgram = {
      id: 'prog_' + Date.now(),
      name: name || 'Custom Program',
      history: [],
      activeCycle: null
    };
    
    const newCycle = {
      cycleNum: 1,
      puzzles: puzzleSubset,
      currentIndex: 0,
      completed: false,
      startTime: Date.now(),
      totalTimeSpent: 0,
      puzzleTimes: [],
      fails: 0,
      isDebug: false
    };
    newProgram.activeCycle = newCycle;
    
    savePrograms([...programs, newProgram]);
    setActiveProgramId(newProgram.id);
    localStorage.setItem('woodpeckerActiveProgramId', newProgram.id);
  };
  
  const startNextCycle = (programId) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;
    
    const cycleNum = program.history.length > 0 ? program.history[program.history.length - 1].cycleNum + 1 : 1;
    const subset = program.history.length > 0 ? program.history[program.history.length - 1].puzzles : [];
    
    const newCycle = {
      cycleNum,
      puzzles: subset,
      currentIndex: 0,
      completed: false,
      startTime: Date.now(),
      totalTimeSpent: 0,
      puzzleTimes: [],
      fails: 0,
      isDebug: false
    };
    
    updateProgram(programId, p => ({ ...p, activeCycle: newCycle }));
    setActiveProgramId(programId);
    localStorage.setItem('woodpeckerActiveProgramId', programId);
  };

  const resumeProgram = (programId) => {
    setActiveProgramId(programId);
    localStorage.setItem('woodpeckerActiveProgramId', programId);
  };

  const deleteProgram = (programId) => {
    if (window.confirm("Are you sure you want to permanently delete this training program?")) {
      savePrograms(programs.filter(p => p.id !== programId));
    }
  };
  
  const clearProgramHistory = (programId) => {
    if (window.confirm("Clear all cycle history for this program?")) {
      updateProgram(programId, p => ({ ...p, history: [] }));
    }
  };
  
  const deleteProgramHistoryItem = (programId, index) => {
    if (window.confirm("Delete this cycle from history?")) {
      updateProgram(programId, p => ({ ...p, history: p.history.filter((_, i) => i !== index) }));
    }
  };

  const saveActiveCycle = (cycle) => {
    updateProgram(activeProgramId, p => ({ ...p, activeCycle: cycle }));
  };

  const clearActiveCycle = () => {
    updateProgram(activeProgramId, p => ({ ...p, activeCycle: null }));
    setActiveProgramId(null);
    localStorage.removeItem('woodpeckerActiveProgramId');
  };

  const finishCycle = (finalCycleData) => {
    finalCycleData.completed = true;
    updateProgram(activeProgramId, p => {
      const cycleToSave = { ...finalCycleData };
      if (p.id === 'dynamic_prog') {
          cycleToSave.puzzles = []; // Prevent localStorage quota exceeded
      }
      let newHistory = !finalCycleData.isDebug ? [...p.history, cycleToSave] : p.history;
      if (p.id === 'dynamic_prog') {
          newHistory = newHistory.slice(-10);
      }
      return { ...p, history: newHistory, activeCycle: null };
    });
    if (finalCycleData.isDebug) {
      // Remove debug program entirely after finishing
      setPrograms(prev => prev.filter(p => p.id !== 'debug_prog'));
    }
    
    if (finalCycleData.isDynamic && finalCycleData.dynamicLength === 'unlimited') {
       setTimeout(() => {
          startDynamicCycle(puzzles, finalCycleData.dynamicLength, (finalCycleData.sessionOffset || 0) + finalCycleData.puzzles.length);
       }, 0);
       return;
    }
    
    setActiveProgramId(null);
    localStorage.removeItem('woodpeckerActiveProgramId');
  };
  
  const pauseCycle = () => {
    setActiveProgramId(null);
    localStorage.removeItem('woodpeckerActiveProgramId');
  };

  const startDrillCycle = (programId, failedPuzzles) => {
    const program = programs.find(p => p.id === programId);
    if (!program) return;
    
    const cycleNum = program.history.length > 0 ? program.history[program.history.length - 1].cycleNum + 1 : 1;
    
    const newCycle = {
      cycleNum,
      puzzles: failedPuzzles,
      currentIndex: 0,
      completed: false,
      startTime: Date.now(),
      totalTimeSpent: 0,
      puzzleTimes: [],
      fails: 0,
      isDebug: false,
      isDrill: true // Mark as drill cycle
    };
    
    updateProgram(programId, p => ({ ...p, activeCycle: newCycle }));
    setActiveProgramId(programId);
    localStorage.setItem('woodpeckerActiveProgramId', programId);
  };

  const startDynamicCycle = (allPuzzles, dynamicLength, sessionOffset = 0) => {
    const dueSrs = [];
    const now = Date.now();
    for (const puzzleId in profile.srs) {
       const p = profile.srs[puzzleId];
       if (p.nextReview <= now && !p.mastered) {
          dueSrs.push(puzzleId);
       }
    }
    
    dueSrs.sort((a, b) => profile.srs[a].nextReview - profile.srs[b].nextReview);
    
    let selectedPuzzles = [];
    const limit = dynamicLength === 'unlimited' ? 1000 : (parseInt(dynamicLength) || 20);
    const dueIds = new Set(dueSrs.slice(0, limit));
    
    for (const p of allPuzzles) {
       if (dueIds.has(p.puzzle_id)) {
          selectedPuzzles.push(p);
       }
    }
    
    if (selectedPuzzles.length < limit) {
       const needed = limit - selectedPuzzles.length;
       const targetRating = profile.rating;
       
       const candidates = allPuzzles.filter(p => !profile.srs[p.puzzle_id] && Math.abs(parseInt(p.rating || 1200) - targetRating) <= 150);
       candidates.sort(() => Math.random() - 0.5);
       selectedPuzzles = selectedPuzzles.concat(candidates.slice(0, needed));
       
       if (selectedPuzzles.length < limit) {
          const neededMore = limit - selectedPuzzles.length;
          const moreCandidates = allPuzzles.filter(p => !profile.srs[p.puzzle_id] && !candidates.includes(p) && Math.abs(parseInt(p.rating || 1200) - targetRating) <= 300);
          moreCandidates.sort(() => Math.random() - 0.5);
          selectedPuzzles = selectedPuzzles.concat(moreCandidates.slice(0, neededMore));
       }
       
       if (selectedPuzzles.length < limit) {
          const neededFinal = limit - selectedPuzzles.length;
          const finalCandidates = allPuzzles.filter(p => !profile.srs[p.puzzle_id] && !selectedPuzzles.includes(p));
          finalCandidates.sort(() => Math.random() - 0.5);
          selectedPuzzles = selectedPuzzles.concat(finalCandidates.slice(0, neededFinal));
       }
       
       if (selectedPuzzles.length < limit && selectedPuzzles.length < 20) {
           const neededUltimate = 20 - selectedPuzzles.length;
           const ultimateCandidates = allPuzzles.filter(p => !selectedPuzzles.includes(p));
           ultimateCandidates.sort(() => Math.random() - 0.5);
           selectedPuzzles = selectedPuzzles.concat(ultimateCandidates.slice(0, neededUltimate));
       }
    }
    
    selectedPuzzles.sort(() => Math.random() - 0.5);
    
    if (selectedPuzzles.length === 0) {
       alert("Could not find any puzzles for Dynamic Mode!");
       return;
    }
    
    const dynamicProgram = programs.find(p => p.id === 'dynamic_prog');
    
    const newCycle = {
      cycleNum: dynamicProgram && dynamicProgram.history.length > 0 ? dynamicProgram.history[dynamicProgram.history.length - 1].cycleNum + 1 : 1,
      puzzles: selectedPuzzles,
      currentIndex: 0,
      completed: false,
      startTime: Date.now(),
      totalTimeSpent: 0,
      puzzleTimes: [],
      fails: 0,
      isDebug: false,
      isDynamic: true,
      dynamicLength: dynamicLength,
      sessionOffset: sessionOffset
    };
    
    if (dynamicProgram) {
       updateProgram('dynamic_prog', p => ({ ...p, activeCycle: newCycle }));
    } else {
       const newProg = {
         id: 'dynamic_prog',
         name: 'Dynamic Coach',
         history: [],
         activeCycle: newCycle
       };
       savePrograms([...programs, newProg]);
    }
    
    setActiveProgramId('dynamic_prog');
    localStorage.setItem('woodpeckerActiveProgramId', 'dynamic_prog');
  };

  const activeProgram = programs.find(p => p.id === activeProgramId);

  return (
    <div className="app-container" style={{height: '100%'}}>
      {!activeProgramId && (
        <Dashboard 
          programs={programs}
          puzzles={puzzles}
          loading={loadingPuzzles}
          profile={profile}
          onCreateProgram={createProgram}
          onStartNextCycle={startNextCycle}
          onStartDrillCycle={startDrillCycle}
          onResumeProgram={resumeProgram}
          onDeleteProgram={deleteProgram}
          onClearHistory={clearProgramHistory}
          onDeleteHistoryItem={deleteProgramHistoryItem}
          onStartDynamic={startDynamicCycle}
          
          onStartDebug={(puzzleSubset) => {
            const tempId = 'debug_prog';
            const debugProg = {
              id: tempId, name: 'Debug', history: [], 
              activeCycle: {
                cycleNum: 1, puzzles: puzzleSubset, currentIndex: 0,
                completed: false, startTime: Date.now(), totalTimeSpent: 0, puzzleTimes: [], fails: 0, isDebug: true
              }
            };
            setPrograms(prev => {
              const withoutOld = prev.filter(p => p.id !== tempId);
              return [...withoutOld, debugProg];
            });
            setActiveProgramId(tempId);
          }}
        />
      )}
      
      {activeProgramId && activeProgram && activeProgram.activeCycle && !activeProgram.activeCycle.completed && (
        <SolvingInterface 
          cycle={activeProgram.activeCycle} 
          profile={profile}
          updateCycle={saveActiveCycle}
          onFinish={() => finishCycle(activeProgram.activeCycle)}
          onAbort={pauseCycle}
          onPuzzleCompleted={handlePuzzleCompleted}
        />
      )}
    </div>
  );
}

export default App;
