import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Play, SkipForward, Flag, Check, X, ChevronLeft, ChevronRight, SkipBack, SkipForward as SkipEnd, Lightbulb } from 'lucide-react';
import { formatTheme, calculateRatingChange } from '../utils';

export default function SolvingInterface({ cycle, updateCycle, onFinish, onAbort, onPuzzleCompleted, profile }) {
  const [game, setGame] = useState(new Chess());
  
  const [reviewIndex, setReviewIndex] = useState(null);
  const activeIndex = reviewIndex !== null ? reviewIndex : cycle.currentIndex;
  const isReviewMode = reviewIndex !== null;
  
  const [currentPuzzle, setCurrentPuzzle] = useState(cycle.puzzles[activeIndex]);

  if (!currentPuzzle) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'white', flexDirection: 'column'}}>
        <h2>Error Loading Puzzle</h2>
        <p>No puzzles found in the current cycle.</p>
        <button className="button" onClick={onAbort}>Go Back</button>
      </div>
    );
  }
  
  // State for parsed moves
  const [solutionMoves, setSolutionMoves] = useState([]); // array of SAN strings
  const [solutionFens, setSolutionFens] = useState([]); // array of FENs for each position in the main line
  
  // State for puzzle progression
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0); // index in solutionMoves
  const [viewMoveIndex, setViewMoveIndex] = useState(-1); // -1 means viewing current interactive state
  
  // Timer state
  const [timeSpent, setTimeSpent] = useState(0); 
  const [totalTime, setTotalTime] = useState(cycle.totalTimeSpent); 
  const [timerActive, setTimerActive] = useState(true);
  
  const [status, setStatus] = useState('playing'); // playing, correct, failed
  const timerRef = useRef(null);

  const parseSolutionToMainLine = (sol) => {
    if (!sol) return [];
    return sol.trim().split(/\s+/).filter(t => t.length > 0);
  };
  
  const uciToMoveObj = (uci) => {
    if (!uci || uci.length < 4) return null;
    return {
      from: uci.substring(0, 2),
      to: uci.substring(2, 4),
      promotion: uci.length === 5 ? uci[4] : undefined
    };
  };

  // State for piece highlighting and move dots
  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [lastMoveSquares, setLastMoveSquares] = useState({});
  const [customArrows, setCustomArrows] = useState([]);
  const [promoSquare, setPromoSquare] = useState(null);
  const [promoMove, setPromoMove] = useState(null);
  
  const [hintState, setHintState] = useState(0); 
  const [usedHint, setUsedHint] = useState(false);

  const onPromotionPieceSelect = (promo) => {
    if (promoMove) {
      executeMove(promoMove.from, promoMove.to, promo);
    }
    setPromoSquare(null);
    setPromoMove(null);
  };

  // Audio references
  const moveSound = useRef(typeof window !== 'undefined' ? new Audio('./sounds/move.mp3') : null);
  const captureSound = useRef(typeof window !== 'undefined' ? new Audio('./sounds/capture.mp3') : null);
  const checkSound = useRef(typeof window !== 'undefined' ? new Audio('./sounds/robot/check.mp3') : null);
  const checkmateSound = useRef(typeof window !== 'undefined' ? new Audio('./sounds/robot/checkmate.mp3') : null);
  const errorSound = useRef(typeof window !== 'undefined' ? new Audio('./sounds/error.ogg') : null);
  const successSound = useRef(typeof window !== 'undefined' ? new Audio('./sounds/success.ogg') : null);

  const [enableSoundEffects, setEnableSoundEffects] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('woodpeckerSoundEffects');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const toggleSoundEffects = (val) => {
    setEnableSoundEffects(val);
    localStorage.setItem('woodpeckerSoundEffects', val.toString());
  };

  const [enableVoice, setEnableVoice] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('woodpeckerVoice');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const toggleVoice = (val) => {
    setEnableVoice(val);
    localStorage.setItem('woodpeckerVoice', val.toString());
  };

  const [showLegalMoves, setShowLegalMoves] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('woodpeckerLegalMoves');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const toggleLegalMoves = (val) => {
    setShowLegalMoves(val);
    localStorage.setItem('woodpeckerLegalMoves', val.toString());
  };

  const [enableHints, setEnableHints] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('woodpeckerEnableHints');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const toggleHints = (val) => {
    setEnableHints(val);
    localStorage.setItem('woodpeckerEnableHints', val.toString());
  };

  const playDing = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(523.25, now, 0.4);       // C5
      playTone(659.25, now + 0.1, 0.6); // E5 (Major third harmony)
    } catch (e) {
      console.warn("AudioContext failed", e);
    }
  };

  const playSound = (move, isComplete, isError = false) => {
    if (!enableSoundEffects) return;
    try {
      if (isError) {
        if (errorSound.current) {
          errorSound.current.currentTime = 0;
          errorSound.current.play().catch(e => console.warn(e));
        }
        return;
      }
      if (isComplete) {
        playDing();
      } else if (move.san && move.san.includes('#') && enableVoice) {
        if (checkmateSound.current) {
          checkmateSound.current.currentTime = 0;
          checkmateSound.current.play().catch(e => console.warn(e));
        }
      } else if (move.san && move.san.includes('+') && enableVoice) {
        if (checkSound.current) {
          checkSound.current.currentTime = 0;
          checkSound.current.play().catch(e => console.warn(e));
        }
      } else if (move.captured) {
        if (captureSound.current) {
          captureSound.current.currentTime = 0;
          captureSound.current.play().catch(e => console.warn(e));
        }
      } else {
        if (moveSound.current) {
          moveSound.current.currentTime = 0;
          moveSound.current.play().catch(e => console.warn(e));
        }
      }
    } catch (e) {
      console.warn("Audio playback failed", e);
    }
  };

  useEffect(() => {
    const p = cycle.puzzles[activeIndex];
    setCurrentPuzzle(p);
    
    let initialGame;
    try {
      initialGame = new Chess(p.fen);
    } catch (e) {
      console.error("Invalid FEN:", p.fen);
      initialGame = new Chess();
    }
    
    // Parse solution and precalculate FENs
    const tokens = parseSolutionToMainLine(p.solution || p.moves);
    const fens = [initialGame.fen()];
    const validMoves = [];
    
    const testGame = new Chess(initialGame.fen());
    for (let uci of tokens) {
       try {
          const mObj = uciToMoveObj(uci);
          const m = testGame.move(mObj);
          if (m) {
             validMoves.push({ uci, san: m.san });
             fens.push(testGame.fen());
          } else {
             break;
          }
       } catch(e) {
          console.warn("Parser stopped at move:", uci, e);
          break; 
       }
    }
    
    setSolutionMoves(validMoves);
    setSolutionFens(fens);
    setCurrentMoveIndex(0);
    setViewMoveIndex(-1);
    
    setTimeSpent(0);
    setStatus('playing');
    setTimerActive(true);
    setMoveFrom('');
    setOptionSquares({});
    setLastMoveSquares({});
    setCustomArrows([]);
    setHintState(0);
    setUsedHint(false);

    setGame(initialGame);

    let animTimeout;
    if (validMoves.length > 0 && !isLegacy) {
      animTimeout = setTimeout(() => {
        const gCopy = new Chess(initialGame.fen());
        const m = gCopy.move(uciToMoveObj(validMoves[0].uci));
        setGame(gCopy);
        setCurrentMoveIndex(1);
        if (m) {
          setLastMoveSquares({
            [m.from]: { backgroundColor: 'rgba(155, 199, 0, 0.41)' },
            [m.to]: { backgroundColor: 'rgba(155, 199, 0, 0.41)' }
          });
          playSound(m, false);
        }
      }, 600);
    } else {
      setGame(initialGame);
      setLastMoveSquares({});
    }

    return () => {
      if (animTimeout) clearTimeout(animTimeout);
    };
  }, [activeIndex, cycle.puzzles]);

  const [autoAdvance, setAutoAdvance] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('woodpeckerAutoAdvance');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  const toggleAutoAdvance = (val) => {
    setAutoAdvance(val);
    localStorage.setItem('woodpeckerAutoAdvance', val.toString());
  };

  useEffect(() => {
    if (timerActive && status === 'playing' && !isReviewMode) {
      timerRef.current = setInterval(() => {
        setTimeSpent(t => t + 1);
        setTotalTime(t => t + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, status, isReviewMode]);

  const handleNextRef = useRef();
  useEffect(() => {
    handleNextRef.current = handleNext;
  });

  useEffect(() => {
    if (status === 'correct' && autoAdvance && !isReviewMode && !cycle.isDebug) {
      const t = setTimeout(() => {
        if (handleNextRef.current) handleNextRef.current();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [status, autoAdvance, isReviewMode, cycle.isDebug]);

  function getMoveOptions(square) {
    const moves = game.moves({
      square,
      verbose: true
    });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    if (!showLegalMoves) {
      setOptionSquares({
        [square]: { background: 'rgba(20,85,30,0.5)' }
      });
      return true;
    }

    const newSquares = {};
    moves.map((move) => {
      const isCapture = game.get(move.to) && game.get(move.to).color !== game.get(square).color;
      newSquares[move.to] = {
        background: isCapture 
          ? 'radial-gradient(circle, transparent 65%, rgba(20,85,30,0.5) 65%)'
          : 'radial-gradient(circle, rgba(20,85,30,0.5) 25%, transparent 25%)',
        borderRadius: '50%'
      };
      return move;
    });
    newSquares[square] = {
      background: 'rgba(20,85,30,0.5)'
    };
    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick(square) {
    if (viewMoveIndex !== -1 && viewMoveIndex !== currentMoveIndex) {
      return; 
    }

    function hasMoveOption(targetSquare) {
      return game.moves({ verbose: true }).some(m => m.from === moveFrom && m.to === targetSquare);
    }

    if (!moveFrom) {
      const hasPiece = game.get(square);
      if (hasPiece && hasPiece.color === game.turn()) {
        setMoveFrom(square);
        getMoveOptions(square);
      }
      return;
    }

    if (!hasMoveOption(square)) {
      const hasPiece = game.get(square);
      if (hasPiece && hasPiece.color === game.turn()) {
        setMoveFrom(square);
        getMoveOptions(square);
      } else {
        setMoveFrom('');
        setOptionSquares({});
      }
      return;
    }

    if (moveFrom) {
      const moveSuccess = onDrop(moveFrom, square);
      if (moveSuccess) {
        setMoveFrom('');
      } else {
        setMoveFrom('');
      }
    }
  }

  function autoPlayOpponent(g, moveIndex) {
    if (moveIndex >= solutionMoves.length) {
       setStatus('correct');
       return;
    }
    
    setTimeout(() => {
      const oppMoveUci = solutionMoves[moveIndex]?.uci;
      if (!oppMoveUci) return;
      const gCopy = new Chess(g.fen());
      const oppMoveObj = uciToMoveObj(oppMoveUci);
      const move = gCopy.move(oppMoveObj);
      setGame(gCopy);
      
      if (move) {
        setLastMoveSquares({
          [move.from]: { backgroundColor: 'rgba(155, 199, 0, 0.41)' },
          [move.to]: { backgroundColor: 'rgba(155, 199, 0, 0.41)' }
        });
        playSound(move, false);
      }

      setCurrentMoveIndex(moveIndex + 1);
      
      if (moveIndex + 1 >= solutionMoves.length) {
         setStatus('correct');
      }
    }, 400); 
  }

  function executeMove(sourceSquare, targetSquare, promotionPiece) {
    try {
      if (!sourceSquare || !targetSquare) return false;
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: promotionPiece,
      });

      if (move === null) return false; 

      setLastMoveSquares({
        [move.from]: { backgroundColor: 'rgba(155, 199, 0, 0.41)' },
        [move.to]: { backgroundColor: 'rgba(155, 199, 0, 0.41)' }
      });

      if (status !== 'playing') {
        setGame(gameCopy);
        playSound(move, false);
        return true;
      }

      const expectedUci = solutionMoves[currentMoveIndex]?.uci;
      const expectedObj = uciToMoveObj(expectedUci);
      
      let isCorrect = expectedObj && move.from === expectedObj.from && move.to === expectedObj.to && (move.promotion || undefined) === expectedObj.promotion;
      let isAlternateCheckmate = false;

      // Allow alternate checkmates!
      if (!isCorrect && gameCopy.isCheckmate()) {
        isCorrect = true;
        isAlternateCheckmate = true;
      }
      
      if (isCorrect) {
        setGame(gameCopy);
        const nextIndex = currentMoveIndex + 1;
        setCurrentMoveIndex(nextIndex);
        
        const isComplete = isAlternateCheckmate || nextIndex >= solutionMoves.length;
        playSound(move, isComplete);
        
        if (isComplete) {
           setStatus('correct');
        } else {
           autoPlayOpponent(gameCopy, nextIndex);
        }
        return true;
      } else {
        setGame(gameCopy); // Visually play the incorrect move so the user sees what they did
        playSound(move, false, true); // Play error sound
        setStatus('failed');
        
        if (expectedObj) {
          setCustomArrows([
            [expectedObj.from, expectedObj.to, 'rgba(0, 128, 0, 0.8)']
          ]);
        }
        
        return true; // Return true so react-chessboard accepts the drop
      }
    } catch (error) {
      console.error("Execute Move error", error);
      return false; 
    }
  }

  function onDrop(sourceSquare, targetSquare) {
    if (viewMoveIndex !== -1 && viewMoveIndex !== currentMoveIndex) {
      return false; 
    }

    setMoveFrom('');
    setOptionSquares({});

    const moves = game.moves({ verbose: true });
    const validMove = moves.find(m => m.from === sourceSquare && m.to === targetSquare);
    if (!validMove) return false;

    if (validMove.promotion) {
      setPromoMove({ from: sourceSquare, to: targetSquare });
      setPromoSquare(targetSquare);
      // Return false to tell react-chessboard NOT to move the piece visually yet,
      // because we are waiting for the user to select the piece from our custom overlay.
      return false;
    }

    return executeMove(sourceSquare, targetSquare, 'q');
  }

  const handleNext = () => {
    if (isReviewMode) {
      if (reviewIndex + 1 === cycle.currentIndex) {
        setReviewIndex(null);
      } else {
        setReviewIndex(reviewIndex + 1);
      }
      return;
    }

    const isFailed = status === 'failed' || usedHint;
    const updatedCycle = { ...cycle };
    updatedCycle.totalTimeSpent = totalTime;
    updatedCycle.puzzleTimes.push({
      puzzleId: currentPuzzle.puzzle_number,
      timeSpent: timeSpent,
      failed: isFailed
    });
    if (isFailed) {
      updatedCycle.fails++;
      if (!updatedCycle.failedPuzzles) updatedCycle.failedPuzzles = [];
      updatedCycle.failedPuzzles.push(currentPuzzle);
    }
    
    if (onPuzzleCompleted && !isReviewMode) {
       onPuzzleCompleted(currentPuzzle.puzzle_id || currentPuzzle.puzzle_number || currentPuzzle.id, parseInt(currentPuzzle.rating || 1200), timeSpent, isFailed);
    }
    
    updatedCycle.currentIndex++;
    
    if (updatedCycle.currentIndex >= updatedCycle.puzzles.length) {
      onFinish(updatedCycle);
    } else {
      updateCycle(updatedCycle);
    }
  };

  const handleGiveUp = () => {
    setStatus('failed');
  };

  const handleHint = () => {
    if (!usedHint) {
       setUsedHint(true);
       setTotalTime(t => t + 5); 
    }
    if (hintState < 2) {
       setHintState(h => h + 1);
    }
  };

  const setView = (index) => {
    setViewMoveIndex(index);
    if (index >= 0 && index <= solutionFens.length - 1) {
       setGame(new Chess(solutionFens[index]));
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLegacy = !currentPuzzle.active_color;
  const fenTurn = currentPuzzle.fen ? currentPuzzle.fen.split(' ')[1] : 'w';
  
  const orientation = isLegacy 
    ? (fenTurn === 'w' ? 'white' : 'black') 
    : (currentPuzzle.active_color === 'w' ? 'white' : 'black');

  // Build pairs for the move list UI
  const visibleMoves = status === 'failed' || status === 'correct' 
    ? solutionMoves 
    : solutionMoves.slice(0, currentMoveIndex);

  const movePairs = [];
  for (let i = 0; i < visibleMoves.length; i += 2) {
    if (fenTurn === 'b' && i === 0) {
      movePairs.push({
         white: { san: '...', index: 0 },
         black: { san: visibleMoves[i].san, index: i + 1 }
      });
      i -= 1; 
    } else {
      movePairs.push({
         white: { san: visibleMoves[i].san, index: i + 1 },
         black: (i + 1 < visibleMoves.length) ? { san: visibleMoves[i+1].san, index: i + 2 } : null
      });
    }
  }

  const displayIndex = viewMoveIndex === -1 ? currentMoveIndex : viewMoveIndex;

  const getPuzzleCategory = (puzzle) => {
    const num = parseInt(puzzle.puzzle_number, 10);
    if (isNaN(num)) return 'Debug/Test';
    if (num <= 306) return 'Mate in 1';
    if (num <= 3718) return 'Mate in 2';
    if (num <= 4462) return 'Mate in 3';
    return 'Advantage';
  };

  let ratingChange = null;
  if (cycle.isDynamic && status !== 'playing' && profile) {
      const isFailed = status === 'failed' || usedHint;
      ratingChange = calculateRatingChange(profile.rating, parseInt(currentPuzzle.rating || 1200), timeSpent, isFailed);
  }

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="card">
          <h2 style={{color: '#fff', marginBottom: '8px'}}>Cycle Progress</h2>
          
          {cycle.isDynamic && profile && (
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px', backgroundColor: 'rgba(46, 160, 67, 0.1)', borderRadius: '4px', border: '1px solid var(--accent-success)'}}>
              <span style={{color: 'var(--accent-success)', fontWeight: 'bold'}}>Your Elo</span>
              <span style={{fontWeight: 'bold', color: '#fff'}}>{profile.rating}</span>
            </div>
          )}

          {currentPuzzle.rating && (
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', border: '1px solid #4a4a4a'}}>
              <span style={{color: '#aaa', fontWeight: 'bold'}}>Puzzle Rating</span>
              <span style={{fontWeight: 'bold', color: '#fff'}}>{currentPuzzle.rating}</span>
            </div>
          )}

          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
            <span style={{color: 'var(--text-muted)'}}>Puzzle</span>
            <span style={{fontWeight: 'bold'}}>{cycle.currentIndex + 1} / {cycle.puzzles.length}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
            <span style={{color: 'var(--text-muted)'}}>Accuracy</span>
            <span style={{fontWeight: 'bold', color: (cycle.fails + (status === 'failed' ? 1 : 0)) > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}}>
              {(() => {
                 const resolvedCount = cycle.currentIndex + (status !== 'playing' ? 1 : 0);
                 const currentFails = cycle.fails + (status === 'failed' ? 1 : 0);
                 if (resolvedCount === 0) return 100;
                 return Math.round(((resolvedCount - currentFails) / resolvedCount) * 100);
              })()}%
            </span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
            <span style={{color: 'var(--text-muted)'}}>Total Time</span>
            <span style={{fontWeight: 'bold', fontFamily: 'monospace', fontSize: '18px'}}>{formatTime(totalTime)}</span>
          </div>
          
          <details style={{marginBottom: '16px'}}>
            <summary style={{color: '#fff', cursor: 'pointer', padding: '12px 16px', backgroundColor: 'var(--bg-dark)', borderRadius: '4px', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <strong>⚙️ Settings</strong>
            </summary>
            <div style={{paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
              {!cycle.isDebug && (
                <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '4px'}}>
                  <label className="lichess-toggle" style={{width: '100%'}}>
                    <input 
                      type="checkbox" 
                      checked={autoAdvance} 
                      onChange={(e) => toggleAutoAdvance(e.target.checked)} 
                      style={{display: 'none'}}
                    />
                    <div className="lichess-toggle-track">
                      <div className="lichess-toggle-thumb">
                        {autoAdvance ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="#ccc" strokeWidth={3} />}
                      </div>
                    </div>
                    <span style={{fontSize: '13px', color: '#fff'}}>Auto-advance puzzle</span>
                  </label>
                </div>
              )}

              <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '4px'}}>
                <label className="lichess-toggle" style={{width: '100%'}}>
                  <input 
                    type="checkbox" 
                    checked={enableSoundEffects} 
                    onChange={(e) => toggleSoundEffects(e.target.checked)} 
                    style={{display: 'none'}}
                  />
                  <div className="lichess-toggle-track">
                    <div className="lichess-toggle-thumb">
                      {enableSoundEffects ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="#ccc" strokeWidth={3} />}
                    </div>
                  </div>
                  <span style={{fontSize: '13px', color: '#fff'}}>Sound effects</span>
                </label>
              </div>

              <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '4px'}}>
                <label className="lichess-toggle" style={{width: '100%'}}>
                  <input 
                    type="checkbox" 
                    checked={enableVoice} 
                    onChange={(e) => toggleVoice(e.target.checked)} 
                    style={{display: 'none'}}
                  />
                  <div className="lichess-toggle-track">
                    <div className="lichess-toggle-thumb">
                      {enableVoice ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="#ccc" strokeWidth={3} />}
                    </div>
                  </div>
                  <span style={{fontSize: '13px', color: '#fff'}}>Robot voice (Check/Mate)</span>
                </label>
              </div>

              <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '4px'}}>
                <label className="lichess-toggle" style={{width: '100%'}}>
                  <input 
                    type="checkbox" 
                    checked={showLegalMoves} 
                    onChange={(e) => toggleLegalMoves(e.target.checked)} 
                    style={{display: 'none'}}
                  />
                  <div className="lichess-toggle-track">
                    <div className="lichess-toggle-thumb">
                      {showLegalMoves ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="#ccc" strokeWidth={3} />}
                    </div>
                  </div>
                  <span style={{fontSize: '13px', color: '#fff'}}>Legal move hints</span>
                </label>
              </div>

              <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '4px'}}>
                <label className="lichess-toggle" style={{width: '100%'}}>
                  <input 
                    type="checkbox" 
                    checked={enableHints} 
                    onChange={(e) => toggleHints(e.target.checked)} 
                    style={{display: 'none'}}
                  />
                  <div className="lichess-toggle-track">
                    <div className="lichess-toggle-thumb">
                      {enableHints ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="#ccc" strokeWidth={3} />}
                    </div>
                  </div>
                  <span style={{fontSize: '13px', color: '#fff'}}>Enable Hint Button</span>
                </label>
              </div>
            </div>
          </details>
          
          <button className="btn-secondary" style={{width: '100%'}} onClick={onAbort}>
            Pause & Return to Menu
          </button>
        </div>
      </div>

      {/* Main Board Area */}
      <div className="main-content">
        <div className="board-container">
          <div style={{ position: 'relative' }}>
            <Chessboard 
              position={game.fen()} 
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              boardOrientation={orientation}
              customDarkSquareStyle={{ backgroundColor: 'var(--board-dark)' }}
              customLightSquareStyle={{ backgroundColor: 'var(--board-light)' }}
              customSquareStyles={{
                ...lastMoveSquares,
                ...optionSquares,
                ...(() => {
                  if (hintState > 0 && status === 'playing') {
                    const expectedUci = solutionMoves[currentMoveIndex]?.uci;
                    const expectedObj = uciToMoveObj(expectedUci);
                    if (expectedObj) {
                      const res = {};
                      if (hintState >= 1) res[expectedObj.from] = { backgroundColor: 'rgba(0, 150, 255, 0.4)' };
                      if (hintState >= 2) res[expectedObj.to] = { backgroundColor: 'rgba(0, 150, 255, 0.4)' };
                      return res;
                    }
                  }
                  return {};
                })()
              }}
              customArrows={customArrows}
              animationDuration={200}
              arePiecesDraggable={true}
            />
            {promoMove && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                zIndex: 1000, borderRadius: '4px'
              }}>
                <div style={{
                  backgroundColor: '#2a2825', padding: '20px', borderRadius: '12px',
                  display: 'flex', gap: '16px', border: '2px solid var(--accent-primary)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                }}>
                  {['q', 'r', 'b', 'n'].map(p => (
                    <button 
                      key={p}
                      onClick={() => onPromotionPieceSelect(p)}
                      style={{
                        width: '60px', height: '60px', fontSize: '40px',
                        backgroundColor: '#1e1c19', border: '1px solid #444',
                        borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        color: game.turn() === 'w' ? '#fff' : '#000',
                        textShadow: game.turn() === 'b' ? '0 0 2px #fff' : 'none'
                      }}
                    >
                      {game.turn() === 'w' 
                        ? (p === 'q' ? '♕' : p === 'r' ? '♖' : p === 'b' ? '♗' : '♘')
                        : (p === 'q' ? '♛' : p === 'r' ? '♜' : p === 'b' ? '♝' : '♞')
                      }
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="sidebar">
        <div className="card" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px'}}>
            <div>
              <h3 style={{color: '#fff', margin: '0 0 4px 0'}}>
                Current Puzzle {!(currentPuzzle.puzzle_id || currentPuzzle.puzzle_number || currentPuzzle.id)?.toString().startsWith('custom_') && (
                  <span style={{fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal'}}>(#{currentPuzzle.puzzle_id || currentPuzzle.puzzle_number || currentPuzzle.id})</span>
                )}
              </h3>
              {Array.isArray(currentPuzzle.themes) && currentPuzzle.themes.length > 0 && (
                <div style={{fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 'bold'}}>
                  Type: {formatTheme(currentPuzzle.themes[0])}
                </div>
              )}
            </div>
            <span style={{fontFamily: 'monospace', fontSize: '20px', color: 'var(--accent-color)'}}>{formatTime(timeSpent)}</span>
          </div>
          
          {/* Actions */}
          <div style={{display: 'flex', flexDirection: 'column', flex: 1}}>
            <div style={{backgroundColor: 'var(--bg-dark)', padding: '16px', borderRadius: '8px', flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)'}}>
              {status === 'playing' && (
                <>
                  <div style={{textAlign: 'center', color: 'var(--text-muted)', marginBottom: 'auto'}}>
                    <p>Make a move or click 'Give up' to reveal the solution...</p>
                  </div>
                  
                  <div style={{marginTop: 'auto'}}>
                    <div style={{textAlign: 'center', marginBottom: '16px'}}>
                      <h3 style={{fontSize: '1.25rem', marginBottom: '4px'}}>Your turn</h3>
                      <p style={{color: 'var(--text-muted)'}}>Find the best move for {game.turn() === 'w' ? 'white' : 'black'}.</p>
                    </div>
                    
                    <div style={{display: 'flex', gap: '8px', width: '100%'}}>
                      {enableHints && (
                        <button 
                          className="btn-primary" 
                          style={{flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                          onClick={handleHint}
                          disabled={hintState >= 2}
                        >
                          <Lightbulb size={16} /> Hint
                        </button>
                      )}
                      <button 
                        className="btn-danger" 
                        style={{flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                        onClick={() => {
                           setStatus('failed');
                           setGame(new Chess(solutionFens[solutionFens.length - 1]));
                           setCurrentMoveIndex(solutionMoves.length);
                           setTotalTime(t => t + 10); // Penalty
                           playSound({san: ''}, true); // play finish sound
                        }}
                      >
                        <Flag size={16} /> Give up
                      </button>
                    </div>
                  </div>
                </>
              )}

              {status === 'correct' && (
                <>
                  <div style={{textAlign: 'center', color: 'var(--accent-success)', marginBottom: 'auto'}}>
                    <Check size={32} style={{margin: '0 auto'}} />
                    <h3 style={{marginTop: '4px', marginBottom: ratingChange !== null ? '4px' : '16px'}}>Success!</h3>
                    {ratingChange !== null && (
                       <div style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: ratingChange > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}}>
                          {ratingChange > 0 ? `+${ratingChange}` : ratingChange} Rating
                       </div>
                    )}
                  </div>
                  
                  <button className="btn-primary" style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}} onClick={handleNext}>
                    <SkipForward size={16} /> {isReviewMode ? 'Next' : 'Next Puzzle'}
                  </button>
                </>
              )}

              {status === 'failed' && (
                <>
                  <div style={{textAlign: 'center', color: 'var(--accent-danger)', marginBottom: 'auto'}}>
                    <X size={32} style={{margin: '0 auto'}} />
                    <h3 style={{marginTop: '4px', marginBottom: ratingChange !== null ? '4px' : '16px'}}>Incorrect</h3>
                    {ratingChange !== null && (
                       <div style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--accent-danger)'}}>
                          {ratingChange} Rating
                       </div>
                    )}
                  </div>
                  <button className="btn-primary" style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}} onClick={handleNext}>
                    <SkipForward size={16} /> {isReviewMode ? 'Next' : 'Next Puzzle'}
                  </button>
                </>
              )}

              {/* Review Mode Navigation */}
              <div style={{marginTop: '24px', display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '24px'}}>
                <button
                  className="btn-secondary"
                  style={{flex: 1, padding: '12px 8px', fontSize: '0.9rem'}}
                  onClick={() => setReviewIndex(activeIndex > 0 ? activeIndex - 1 : 0)}
                  disabled={activeIndex === 0}
                  title="Review Previous Puzzle"
                >
                  Previous
                </button>
                
                {isReviewMode && (
                  <button
                    className="btn-primary"
                    style={{flex: 1, padding: '12px 8px', fontSize: '0.9rem'}}
                    onClick={handleNext}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Move List / Notation */}
          <div style={{
            flex: 1, 
            backgroundColor: 'var(--bg-dark)', 
            borderRadius: '4px', 
            overflowY: 'auto',
            marginBottom: '16px',
            fontSize: '14px',
            fontFamily: 'monospace',
            color: 'var(--text-muted)'
          }}>
             {visibleMoves.length === 0 ? (
                <div style={{padding: '16px', textAlign: 'center', opacity: 0.5}}>
                   Make a move or click 'Give up' to reveal the solution...
                </div>
             ) : (
             <table style={{width: '100%', borderCollapse: 'collapse'}}>
               <tbody>
                 {movePairs.map((pair, rowIdx) => (
                   <tr key={rowIdx} style={{backgroundColor: rowIdx % 2 === 0 ? 'transparent' : '#1e1c19'}}>
                     <td style={{padding: '4px 8px', width: '30px', color: '#666'}}>{rowIdx + 1}.</td>
                     <td 
                        style={{
                           padding: '4px 8px', 
                           cursor: pair.white ? 'pointer' : 'default',
                           backgroundColor: pair.white?.index === displayIndex ? 'var(--accent-hover)' : 'transparent',
                           color: pair.white?.index === displayIndex ? '#fff' : 'inherit'
                        }}
                        onClick={() => pair.white && setView(pair.white.index)}
                     >
                        {pair.white?.san || '...'}
                     </td>
                     <td 
                        style={{
                           padding: '4px 8px', 
                           cursor: pair.black ? 'pointer' : 'default',
                           backgroundColor: pair.black?.index === displayIndex ? 'var(--accent-hover)' : 'transparent',
                           color: pair.black?.index === displayIndex ? '#fff' : 'inherit'
                        }}
                        onClick={() => pair.black && setView(pair.black.index)}
                     >
                        {pair.black?.san || ''}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
             )}
          </div>

          {/* Interactive Viewer Controls */}
          {status !== 'playing' && (
             <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
                <button className="btn-secondary" style={{padding: '8px'}} onClick={() => setView(0)} disabled={displayIndex <= 0}>
                   <SkipBack size={16} />
                </button>
                <button className="btn-secondary" style={{padding: '8px'}} onClick={() => setView(displayIndex - 1)} disabled={displayIndex <= 0}>
                   <ChevronLeft size={16} />
                </button>
                <button className="btn-secondary" style={{padding: '8px'}} onClick={() => setView(displayIndex + 1)} disabled={displayIndex >= solutionMoves.length}>
                   <ChevronRight size={16} />
                </button>
                <button className="btn-secondary" style={{padding: '8px'}} onClick={() => setView(solutionMoves.length)} disabled={displayIndex >= solutionMoves.length}>
                   <SkipEnd size={16} />
                </button>
             </div>
          )}

        </div>
      </div>
    </div>
  );
}
