import React, { useState, useEffect } from 'react';
import { X, Check, Download, Upload } from 'lucide-react';

export default function SettingsModal({ onClose, showDataManagement = true }) {
  const [autoAdvance, setAutoAdvance] = useState(() => localStorage.getItem('woodpeckerAutoAdvance') !== 'false');
  const [enableSoundEffects, setEnableSoundEffects] = useState(() => localStorage.getItem('woodpeckerSoundEffects') !== 'false');
  const [enableVoice, setEnableVoice] = useState(() => localStorage.getItem('woodpeckerVoice') !== 'false');
  const [showLegalMoves, setShowLegalMoves] = useState(() => localStorage.getItem('woodpeckerLegalMoves') !== 'false');
  const [enableHints, setEnableHints] = useState(() => localStorage.getItem('woodpeckerEnableHints') !== 'false');

  const toggleAutoAdvance = (val) => { setAutoAdvance(val); localStorage.setItem('woodpeckerAutoAdvance', val); };
  const toggleSoundEffects = (val) => { setEnableSoundEffects(val); localStorage.setItem('woodpeckerSoundEffects', val); };
  const toggleVoice = (val) => { setEnableVoice(val); localStorage.setItem('woodpeckerVoice', val); };
  const toggleLegalMoves = (val) => { setShowLegalMoves(val); localStorage.setItem('woodpeckerLegalMoves', val); };
  const toggleHints = (val) => { setEnableHints(val); localStorage.setItem('woodpeckerEnableHints', val); };

  const handleExport = () => {
    const data = {
      programs: JSON.parse(localStorage.getItem('woodpeckerPrograms') || '[]'),
      profile: JSON.parse(localStorage.getItem('woodpeckerProfile') || 'null')
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `woodpecker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.programs) localStorage.setItem('woodpeckerPrograms', JSON.stringify(data.programs));
        if (data.profile) localStorage.setItem('woodpeckerProfile', JSON.stringify(data.profile));
        alert('Data imported successfully! The app will now reload.');
        window.location.reload();
      } catch (err) {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    const confirmed = window.confirm('Are you sure you want to completely reset your progress? This will delete your Elo rating, history, and Spaced Repetition data. This action CANNOT be undone.');
    if (confirmed) {
      localStorage.removeItem('woodpeckerPrograms');
      localStorage.removeItem('woodpeckerProfile');
      localStorage.removeItem('woodpeckerActiveProgramId');
      window.location.reload();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth: '400px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h2 style={{margin: 0, color: '#fff'}}>Settings</h2>
          <button className="button-icon" onClick={onClose}><X size={24} color="#aaa" /></button>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '4px'}}>
            <label className="lichess-toggle" style={{width: '100%'}}>
              <input type="checkbox" checked={autoAdvance} onChange={(e) => toggleAutoAdvance(e.target.checked)} style={{display: 'none'}} />
              <div className="lichess-toggle-track">
                <div className="lichess-toggle-thumb">
                  {autoAdvance ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="#ccc" strokeWidth={3} />}
                </div>
              </div>
              <span style={{fontSize: '13px', color: '#fff'}}>Auto-advance puzzle</span>
            </label>
          </div>

          <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '4px'}}>
            <label className="lichess-toggle" style={{width: '100%'}}>
              <input type="checkbox" checked={enableSoundEffects} onChange={(e) => toggleSoundEffects(e.target.checked)} style={{display: 'none'}} />
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
              <input type="checkbox" checked={enableVoice} onChange={(e) => toggleVoice(e.target.checked)} style={{display: 'none'}} />
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
              <input type="checkbox" checked={showLegalMoves} onChange={(e) => toggleLegalMoves(e.target.checked)} style={{display: 'none'}} />
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
              <input type="checkbox" checked={enableHints} onChange={(e) => toggleHints(e.target.checked)} style={{display: 'none'}} />
              <div className="lichess-toggle-track">
                <div className="lichess-toggle-thumb">
                  {enableHints ? <Check size={14} color="#fff" strokeWidth={3} /> : <X size={14} color="#ccc" strokeWidth={3} />}
                </div>
              </div>
              <span style={{fontSize: '13px', color: '#fff'}}>Enable Hint Button</span>
            </label>
          </div>
        </div>

        {showDataManagement && (
          <>
            <h3 style={{color: '#fff', marginTop: '24px', marginBottom: '12px'}}>Data Management</h3>
            <div style={{display: 'flex', gap: '8px', flexDirection: 'column'}}>
              <button onClick={handleExport} className="btn-secondary" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
                <Download size={16} /> Export Backup
              </button>
              <label className="btn-secondary" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', textAlign: 'center'}}>
                <Upload size={16} /> Import Backup
                <input type="file" accept=".json" style={{display: 'none'}} onChange={handleImport} />
              </label>
              <button onClick={handleReset} className="btn-secondary" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: '#ff6b6b', borderColor: '#5c2b2b', backgroundColor: 'rgba(255, 107, 107, 0.1)'}}>
                <X size={16} /> Reset All Progress
              </button>
            </div>
            <div style={{marginTop: '12px', padding: '12px', backgroundColor: 'rgba(255, 107, 107, 0.05)', border: '1px solid rgba(255, 107, 107, 0.2)', borderRadius: '4px'}}>
              <p style={{color: '#ff6b6b', fontSize: '12px', margin: '0 0 4px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'}}>
                ⚠️ Danger Zone
              </p>
              <p style={{color: '#aaa', fontSize: '12px', margin: 0, lineHeight: '1.4'}}>
                Resetting will permanently wipe your Elo rating and training history. You might want to do this if you are experiencing caching issues, or if you simply want to start fresh with a clean slate.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
