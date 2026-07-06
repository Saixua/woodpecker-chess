import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ProgressCharts({ history }) {
  if (!history || history.length === 0) return null;

  const mainCycles = history.filter(c => !c.isDrill);
  if (mainCycles.length === 0) return null;

  const data = mainCycles.map(cycle => {
     const totalPuzzles = cycle.puzzles.length;
     const accuracy = totalPuzzles > 0 ? Math.round(((totalPuzzles - cycle.fails) / totalPuzzles) * 100) : 0;
     const timeInMinutes = Math.round((cycle.totalTimeSpent / 60) * 10) / 10;
     return {
       name: `C${cycle.cycleNum}`,
       time: timeInMinutes,
       accuracy: accuracy
     };
  });

  return (
    <div style={{ width: '100%', height: 250, backgroundColor: '#161512', padding: '16px 16px 32px 0', borderRadius: '4px', border: '1px solid #333', marginTop: '16px' }}>
      <h3 style={{marginTop: 0, marginLeft: '24px', color: '#fff', fontSize: '15px', marginBottom: '16px'}}>Performance Progress</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" stroke="#888" tick={{fontSize: 12}} />
          <YAxis yAxisId="left" stroke="#3692e7" tick={{fontSize: 12}} />
          <YAxis yAxisId="right" orientation="right" stroke="#629924" tick={{fontSize: 12}} />
          <Tooltip contentStyle={{ backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '4px', fontSize: '12px' }} />
          <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
          <Line yAxisId="left" type="monotone" dataKey="time" stroke="#3692e7" strokeWidth={2} name="Time (min)" activeDot={{ r: 6 }} />
          <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#629924" strokeWidth={2} name="Accuracy (%)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
